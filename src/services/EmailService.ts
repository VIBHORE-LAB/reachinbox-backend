import { ImapFlow } from "imapflow";
import { simpleParser, AddressObject } from "mailparser";
import { IAccount } from "../models/account.model";
import { log } from "../utils/logger";
import AiService from "./AIService";
import NotificationService from "./NotificationService";

const ELASTIC_URL = "http://127.0.0.1:9200";
const INDEX_NAME = "emails";

export class EmailService {
  private activeConnections: Map<string, { client: ImapFlow; lastUid: number }> = new Map();

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
                processed: { type: "boolean" }, // ✅ Added
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

      let lastUid = 0;
      const status = await client.status("Inbox", { uidNext: true });
      if (status.uidNext) lastUid = status.uidNext - 1;

      const messages = client.fetch(
        { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        { envelope: true, uid: true, flags: true, source: true }
      );

      for await (const msg of messages) {
        await this.indexEmail(acc, msg);
        if (msg.uid > lastUid) lastUid = msg.uid;
      }

      client.on("exists", async () => {
        try {
          const uids = await client.search({ uid: `${lastUid + 1}:*` });
          if (uids && uids.length > 0) {
            for await (const msg of client.fetch(uids, {
              envelope: true,
              uid: true,
              flags: true,
              source: true,
            })) {
              await this.indexEmail(acc, msg);
              lastUid = msg.uid;
            }
          }
        } catch (err) {
          log("Error fetching new messages:", err);
        }
      });

      client.on("close", () => {
        log(`IMAP connection closed for ${acc.user}`);
        this.activeConnections.delete(accId);
        setTimeout(connectAndListen, 5000); // reconnect after 5s
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

  this.activeConnections.set(accId, { client, lastUid: 0 });
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

      return (
        data.hits?.hits.map((hit: any) => ({
          id: hit._id,
          ...hit._source,
        })) || []
      );
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

      const emailDoc: any = {
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
        processed: false,
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

      // ✅ Auto classify
      if (!emailDoc.processed) {
        const classification = await AiService.classifyEmail(
          emailDoc.body,
          emailDoc.subject,
          emailDoc.from
        );

        emailDoc.labels = [classification.label];
        emailDoc.processed = true;

        await fetch(`${ELASTIC_URL}/${INDEX_NAME}/_doc/${docId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emailDoc),
        });

        if (classification.label === "Interested") {
          NotificationService.notifyInterestedEmail(emailDoc);
        }
      }

      log(`Indexed email UID ${msg.uid} for ${acc.user}`);
    } catch (err) {
      log("Elasticsearch indexing error:", err);
    }
  }

  public async processUnprocessedEmails(ownerId?: string) {
    let processedCount = 0;
    try {
      const query = ownerId
        ? { query: { bool: { must: [{ term: { ownerId } }, { term: { processed: false } }] } }, size: 1000 }
        : { query: { term: { processed: false } }, size: 1000 };

      const res = await fetch(`${ELASTIC_URL}/${INDEX_NAME}/_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });

      const data: any = await res.json();
      const unprocessed = data.hits?.hits || [];

      for (const hit of unprocessed) {
        const emailDoc = hit._source;
        const classification = await AiService.classifyEmail(
          emailDoc.body,
          emailDoc.subject,
          emailDoc.from
        );
        emailDoc.labels = [classification.label];
        emailDoc.processed = true;

        await fetch(`${ELASTIC_URL}/${INDEX_NAME}/_doc/${hit._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emailDoc),
        });

        if (classification.label === "Interested") {
          NotificationService.notifyInterestedEmail(emailDoc);
        }

        processedCount++;
      }
    } catch (err) {
      log("Error processing unprocessed emails:", err);
    }

    log(`Processed ${processedCount} unprocessed emails.`);
    return processedCount;
  }
}
