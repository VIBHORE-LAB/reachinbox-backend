import OpenAI from "openai";
import { QdrantRAGService } from "./QdrantService";
import * as dotenv from "dotenv";

dotenv.config();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) throw new Error("OPEN AI Key not found");

const openaiClient = new OpenAI({ apiKey: OPENAI_KEY });

const AiService = {
  async classifyEmail(body: string, subject: string, from: string) {
    const prompt = `
Classify the following email into one of these categories:
- Interested
- Meeting Booked
- Not Interested
- Spam
- Out of Office

Return strictly in JSON format like: {"label":"...", "confidence":0.0}

Email content:
body: ${body}
subject: ${subject}
from: ${from}
    `;

    const resp = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    try {
      return JSON.parse(resp.choices[0].message?.content || "{}");
    } catch {
      return { label: "Unknown", confidence: 0 };
    }
  },

  async embedText(text: string) {
    const resp = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return resp.data[0].embedding as number[];
  },

  async generateReply(emailBody: string, emailSubject: string, from: string) {
    const nameMatch = from.match(/^([^@]+)/);
    const name = nameMatch ? nameMatch[1] : "there";

    const embedding = await AiService.embedText(
      `${emailSubject}\n${emailBody}\nFrom: ${from}`
    );

    const examples = await QdrantRAGService.querySimilar(embedding, 3);

    const exampleText = examples
  ?.map(
    (ex: any) =>
      `Email: ${ex.payload?.email ?? ""}\nReply: ${ex.payload?.reply ?? ""}\n---`
  )
  .join("\n");
    const ragPrompt = `
You are an AI assistant. Given the following examples of emails and suggested replies:

${exampleText}

Generate an appropriate reply for this new email:

Email body:
${emailBody}
Subject:
${emailSubject}
From:
${name}

Reply:
    `;

    const resp = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: ragPrompt }],
    });

    return resp.choices[0].message?.content?.trim() || "";
  },
};

export default AiService;
