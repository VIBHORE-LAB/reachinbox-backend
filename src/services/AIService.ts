import OpenAI from "openai";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if(!OPENAI_KEY) throw new Error("OPEN AI Key not found");
const openaiClient = OPENAI_KEY ? new OpenAI({apiKey: OPENAI_KEY}) : null;

const AiService = {

    async classifyEmail(body: string, subject: string, from:string){
        if(!openaiClient) {
            return {label: "Unkown"};
        }

        const prompt = `
        Classify the following email into one of these categories:
- Interested
- Meeting Booked
- Not Interested
- Spam
- Out of Office

Return strictly in JSON format like: {"label":"...", "confidence":0.0}

Email content:
body: ${body},
subject: ${subject}
from: ${from}
        `;


    const resp = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    } as any);

    try {
      return JSON.parse(resp.choices[0].message?.content || '{}');
    } catch {
      return { label: "Unknown" };
    }
  },

  async embedText(text: string) {
    if (!openaiClient) return Array(1536).fill(0); 
    const resp = await openaiClient.embeddings.create({
      model: "text-embedding-3-large",
      input: text
    } as any);

    return resp.data[0].embedding as number[];
  }
};

export default AiService;
