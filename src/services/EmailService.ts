import { ImapFlow } from "imapflow";
import { simpleParser, AddressObject } from "mailparser";
import { IAccount } from "../models/account.model";
import { log } from "../utils/logger";

const ELASTIC_URL = "http://127.0.0.1:9200";
const INDEX_NAME = "emails";

export class EmailService {
  private activeConnections: Map<string, ImapFlow> = new Map();

  constructor() {
    this.ensureIndexExists();
  }

  private async ensureIndexExists() {
    try {
      const res = await fetch(`${ELASTIC_URL}/${INDEX_NAME}`);
      if (res.status === 404) {
        const createRes = await fetch(`${ELASTIC_URL}/${INDEX_NAME}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mappings: {
              properties: {
                ownerId: { type: "keyword" },
                account: { type: "keyword" },
                folder: { type: "keyword" },
                from: { type: "text" },
                to: { type: "keyword" },
                subject: { type: "text" },
                date: { type: "date" },
                body: { type: "text" },
                snippet: { type: "text" },
                labels: { type: "keyword" },
                suggestedReply: { type: "text" },
                flags: { type: "keyword" },
                fetchedAt: { type: "date" },
              },
            },
          }),
        });

        if (!createRes.ok) {
          const text = await createRes.text();
          throw new Error(`Failed to create index: ${text}`);
        }

        log("Created Elasticsearch index: emails");
      }
    } catch (err) {
      log("Error ensuring Elasticsearch index exists:", err);
    }
  }

  async startImap(acc: IAccount) {
    const accId = acc._id.toString();
    if (this.activeConnections.has(accId)) return;

    const client = new ImapFlow({
      host: acc.host,
      port: acc.port,
      secure: true,
      auth: { user: acc.user, pass: acc.password },
    });

    const connectAndListen = async () => {
      try {
        await client.connect();
        log(`IMAP connected for ${acc.user}`);
        await client.mailboxOpen("Inbox");

        const messages = client.fetch(
          { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          { envelope: true, uid: true, flags: true, source: true }
        );

        for await (const msg of messages) {
          await this.indexEmail(acc, msg);
        }

        client.on("exists", async () => {
          try {
            const uids = await client.search({ seen: false });
if (!uids  || uids.length === 0) return;

            const newMessages = client.fetch(uids, {
              envelope: true,
              uid: true,
              flags: true,
              source: true,
            });

            for await (const msg of newMessages) {
              await this.indexEmail(acc, msg);
              await client.messageFlagsAdd(msg.uid, ["\\Seen"]);
            }
          } catch (err) {
            log("Error fetching new messages:", err);
          }
        });

        while (true) {
          try {
            await client.idle();
          } catch (err) {
            log("Idle error, reconnecting...", err);
            break;
          }
        }
      } catch (err) {
        log(`IMAP connection error for ${acc.user}:`, err);
      } finally {
        try {
          await client.logout();
        } catch {}
        this.activeConnections.delete(accId);
        setTimeout(connectAndListen, 5000);
      }
    };

    this.activeConnections.set(accId, client);
    connectAndListen();
  }

  async getEmails(ownerId?: string, size = 50) {
    try {
      const query = ownerId
        ? { query: { term: { ownerId } }, size, sort: [{ fetchedAt: { order: "desc" } }] }
        : { query: { match_all: {} }, size, sort: [{ fetchedAt: { order: "desc" } }] };

      const res = await fetch(`${ELASTIC_URL}/${INDEX_NAME}/_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Elasticsearch search failed: ${text}`);
      }

      const data: any = await res.json();

      // Map _id from Elasticsearch to id in GraphQL
      return data.hits?.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      })) || [];
    } catch (err) {
      log("Error fetching emails from Elasticsearch", err);
      return [];
    }
  }

  private async indexEmail(acc: IAccount, msg: any) {
    try {
      const rawBody = msg.source?.toString("utf8") || "";
      const parsed = await simpleParser(rawBody);

      const formatAddresses = (addr?: AddressObject | AddressObject[]): string[] => {
        if (!addr) return [];
        if (Array.isArray(addr)) {
          return addr.flatMap(a => a.value.map(v => v.address).filter((x): x is string => !!x));
        }
        return addr.value.map(v => v.address).filter((x): x is string => !!x);
      };

  const flags: string[] = Array.isArray(msg.flags)
  ? (msg.flags as (string | number)[]).map((f: string | number) => String(f))
  : [];


      const emailDoc = {
        ownerId: acc._id.toString(),
        account: acc.user,
        folder: "Inbox",
        subject: parsed.subject || "(No Subject)",
        from: formatAddresses(parsed.from).join(", "),
        to: formatAddresses(parsed.to),
        date: parsed.date?.toISOString() || new Date().toISOString(),
        body: parsed.text || parsed.html || "",
        snippet: (parsed.text || parsed.html || "").slice(0, 200),
        labels: [],
        suggestedReply: null,
        flags,
        fetchedAt: new Date().toISOString(),
      };

      const docId = `${acc._id}-${msg.uid}`;

      const res = await fetch(`${ELASTIC_URL}/${INDEX_NAME}/_doc/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailDoc),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to index email UID ${msg.uid}: ${text}`);
      }

      log(`Indexed email UID ${msg.uid} for ${acc.user}`);
    } catch (err) {
      log("Elasticsearch indexing error:", err);
    }
  }
}
