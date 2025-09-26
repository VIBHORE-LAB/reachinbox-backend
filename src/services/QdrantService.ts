import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import aiService from './AIService';
import * as dotenv from "dotenv";

dotenv.config();
const QDRANT_URL = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY
const COLLECTION_NAME = 'email_suggestions';
const BATCH_SIZE = 10;

const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey:apiKey });

export class QdrantRAGService {
  static async initCollection() {
    try {
     await qdrant.recreateCollection(COLLECTION_NAME, {
  vectors: { size: 1536, distance: 'Cosine' },
});

      console.log('Qdrant collection initialized');
    } catch (err) {
      console.error('Error initializing Qdrant collection:', err);
    }
  }

  static async upsertPoint(id: string, vector: number[], payload: Record<string, any>) {
    try {
      await qdrant.upsert(COLLECTION_NAME, {
        points: [{ id, vector, payload }],
      });
      console.log(`Upserted point with ID: ${id}`);
    } catch (err) {
      console.error(`Error upserting point with ID: ${id}`, err);
    }
  }

  static async addTrainingData(trainingData: { email: string; reply: string }[]) {
    let batch: { id: string; vector: number[]; payload: Record<string, any> }[] = [];
    for (const data of trainingData) {
      try {
        const embedding = await aiService.embedText(data.email);
        const pointId = uuidv4();
        batch.push({
          id: pointId,
          vector: embedding,
          payload: { email: data.email, reply: data.reply },
        });

        if (batch.length >= BATCH_SIZE) {
          await qdrant.upsert(COLLECTION_NAME, { points: batch });
          console.log(`Upserted batch of ${batch.length} points`);
          batch = [];
        }
      } catch (err) {
        console.error(`Error processing email: ${data.email.slice(0, 50)}`, err);
      }
    }

    if (batch.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points: batch });
      console.log(`Upserted final batch of ${batch.length} points`);
    }

    console.log('Training data processing completed.');
  }

static async querySimilar(vector: number[], topK = 3) {
  try {
    return await qdrant.search(COLLECTION_NAME, {
      vector,
      limit: topK,
      with_payload: true,
    });
  } catch (err) {
    console.error("Error querying similar points:", err);
    return []; 
  }
}
}
