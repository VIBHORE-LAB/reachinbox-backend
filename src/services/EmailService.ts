import { ImapFlow } from "imapflow";
import { simpleParser, AddressObject } from "mailparser";
import { IAccount } from "../models/account.model";
import { log } from "../utils/logger";
import AiService from "./AIService";
import NotificationService from "./NotificationService";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";

dotenv.config();

const ELASTIC_URL = process.env.ELASTIC_URL!;
const ELASTIC_USER = process.env.ELASTIC_USER!;
const ELASTIC_PASS = process.env.ELASTIC_PASS!;
const INDEX_NAME = "emails";

const DEMO_ACCOUNTS = [
  {
    user: process.env.DEMO_IMAP_USER1,
    pass: process.env.DEMO_IMAP_PASS1,
    host: "smtp.gmail.com",
    port: 465,
  },
  {
    user: process.env.DEMO_IMAP_USER2,
    pass: process.env.DEMO_IMAP_PASS2,
    host: "smtp.gmail.com",
    port: 465,
  },
];

// Helper for Elasticsearch fetch with Basic Auth
const getAuthHeader = () =>
  "Basic " + Buffer.from(`${ELASTIC_USER}:${ELASTIC_PASS}`).toString("base64");

const fetchElastic = (url: string, options: any = {}) =>
  fetch(`${ELASTIC_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
      ...(options.headers || {}),
    },
  });

export class EmailService {
  private activeConnections: Map<string, { client: ImapFlow; lastUid: number }> = new Map();

  constructor() {
    this.ensureIndexExists();
  }

  private async ensureIndexExists() {
    try {
      const res = await fetchElastic(`/${INDEX_NAME}`);
      if (res.status === 404) {
        const createRes = await fetchElastic(`/${INDEX_NAME}`, {
          method: "PUT",
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
                processed: { type: "boolean" },
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

  public async startImap(acc: IAccount) {
    const accId = acc._id.toString();
    if (this.activeConnections.has(accId)) return;

    const connectAndListen = async () => {
      const client = new ImapFlow({
        host: acc.host,
        port: acc.port,
        secure: true,
        auth: { user: acc.user, pass: acc.password },
      });

      try {
        await client.connect();
        log(`IMAP connected for ${acc.user}`);
        await client.mailboxOpen("Inbox");

        let lastUid = 0;

        try {
          const res = await fetchElastic(`/${INDEX_NAME}/_search`, {
            method: "POST",
            body: JSON.stringify({
              size: 1,
              query: { term: { ownerId: acc._id.toString() } },
              sort: [{ fetchedAt: { order: "desc" } }],
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as any;
            if (data.hits?.hits?.length > 0) {
              const lastDocId = data.hits.hits[0]._id;
              const parts = lastDocId.split("-");
              lastUid = parseInt(parts[parts.length - 1], 10) || 0;
            }
          }
        } catch (err) {
          log("Failed to fetch last indexed UID, starting from 0", err);
        }

        this.activeConnections.set(accId, { client, lastUid });

        const fetchNewMessages = async () => {
          try {
            const uids = (await client.search({ uid: `${lastUid + 1}:*` })) || [];
            if (uids.length > 0) {
              for await (const msg of client.fetch(uids, { envelope: true, uid: true, flags: true, source: true })) {
                await this.indexEmail(acc, msg);
                lastUid = msg.uid;
                this.activeConnections.set(accId, { client, lastUid });
              }
            }
          } catch (err) {
            log("Error fetching new messages:", err);
          }
        };

        await fetchNewMessages();

        const idleLoop = async () => {
          try {
            await client.idle();
            log(`IDLE state ended for ${acc.user}`);
            await fetchNewMessages();
            setImmediate(idleLoop);
          } catch (err) {
            log(`IDLE error for ${acc.user}:`, err);
            setTimeout(idleLoop, 5000);
          }
        };

        client.on("exists", async () => {
          log(`New email detected for ${acc.user}`);
          await fetchNewMessages();
        });

        idleLoop();

        client.on("close", () => {
          log(`IMAP connection closed for ${acc.user}`);
          this.activeConnections.delete(accId);
          setTimeout(connectAndListen, 5000);
        });

      } catch (err) {
        log(`IMAP connection error for ${acc.user}:`, err);
        this.activeConnections.delete(accId);
        setTimeout(connectAndListen, 5000);
      }
    };

    connectAndListen();
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

      const docId = `${acc._id}-${msg.uid}`;

      const existing = await fetchElastic(`/${INDEX_NAME}/_doc/${docId}`);
      if (existing.ok) {
        const existingDoc = (await existing.json()) as { _source?: { processed?: boolean } };
        if (existingDoc._source?.processed) return;
      }

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

      const classification = await AiService.classifyEmail(
        emailDoc.body,
        emailDoc.subject,
        emailDoc.from
      );

      if (classification) {
        emailDoc.labels = [classification.label];
        emailDoc.processed = true;

        if (classification.label === "Interested") {
          NotificationService.notifyInterestedEmail(emailDoc);
        }
      }

      const res = await fetchElastic(`/${INDEX_NAME}/_doc/${docId}`, {
        method: "PUT",
        body: JSON.stringify(emailDoc),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to index email UID ${msg.uid}: ${text}`);
      }

      log(`Indexed & processed email UID ${msg.uid} for ${acc.user}`);
    } catch (err) {
      log("Elasticsearch indexing error:", err);
    }
  }

  public async getEmails(ownerId?: string, size = 50) {
    try {
      const query = ownerId
        ? { query: { term: { ownerId } }, size, sort: [{ fetchedAt: { order: "desc" } }] }
        : { query: { match_all: {} }, size, sort: [{ fetchedAt: { order: "desc" } }] };

      const res = await fetchElastic(`/${INDEX_NAME}/_search`, {
        method: "POST",
        body: JSON.stringify(query),
      });

      if (!res.ok) throw new Error(await res.text());

      const data: any = await res.json();

      return data.hits?.hits.map((hit: any) => ({ id: hit._id, ...hit._source })) || [];
    } catch (err) {
      log("Error fetching emails from Elasticsearch", err);
      return [];
    }
  }

  public async generateSuggestedReply(emailId: string) {
    try {
      const res = await fetchElastic(`/${INDEX_NAME}/_doc/${emailId}`);
      if (!res.ok) throw new Error(await res.text());
      const data: any = await res.json();
      const emailDoc = data._source;

      const suggestedReply = await AiService.generateReply(
        emailDoc.body,
        emailDoc.subject,
        emailDoc.from
      );

      emailDoc.suggestedReply = suggestedReply;

      await fetchElastic(`/${INDEX_NAME}/_doc/${emailId}`, {
        method: "PUT",
        body: JSON.stringify(emailDoc),
      });

      log(`Suggested reply generated for email ID ${emailId}`);
      return suggestedReply;
    } catch (err) {
      log("Error generating suggested reply:", err);
      return null;
    }
  }

  public async sendEmail(emailId: string) {
    try {
      const res = await fetchElastic(`/${INDEX_NAME}/_doc/${emailId}`);
      if (!res.ok) throw new Error(await res.text());
      const data: any = await res.json();
      const emailDoc = data._source;

      if (!emailDoc.suggestedReply) {
        emailDoc.suggestedReply = await AiService.generateReply(
          emailDoc.body,
          emailDoc.subject,
          emailDoc.from
        );
        await fetchElastic(`/${INDEX_NAME}/_doc/${emailId}`, {
          method: "PUT",
          body: JSON.stringify(emailDoc),
        });
      }

      const matchedAccount = DEMO_ACCOUNTS.find(acc => emailDoc.to.includes(acc.user));
      if (!matchedAccount) throw new Error("Cannot send email: no matching demo account");

      const transporter = nodemailer.createTransport({
        host: matchedAccount.host,
        port: matchedAccount.port,
        secure: true,
        auth: {
          user: matchedAccount.user!,
          pass: matchedAccount.pass!,
        },
      });

      await transporter.sendMail({
        from: matchedAccount.user,
        to: emailDoc.from,
        subject: `Re: ${emailDoc.subject}`,
        text: emailDoc.suggestedReply,
      });

      log(`Email sent successfully to ${emailDoc.from} for email ID ${emailId}`);
      return true;
    } catch (err) {
      log("Error sending email:", err);
      throw err;
    }
  }
}
