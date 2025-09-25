import { QdrantRAGService } from "../services/QdrantService";
import { v4 as uuidv4 } from "uuid";

const trainingPoints = [
  {
    id: uuidv4(),
    vector: [0.001, -0.002, 0.003, 0.004, 0.005, -0.006, 0.007, -0.008, 0.009, 0.010],
    payload: {
      email: "Hi, Your resume has been shortlisted. When will be a good time for you to attend the technical interview?",
      reply: "Thank you for shortlisting my profile! I'm available for a technical interview. You can book a slot here: https://cal.com/example"
    }
  },
  {
    id: uuidv4(),
    vector: [-0.001, 0.002, -0.003, 0.004, -0.005, 0.006, -0.007, 0.008, -0.009, 0.010],
    payload: {
      email: "We have booked your meeting for next Tuesday.",
      reply: "Thanks for confirming the meeting. Looking forward to it!"
    }
  },
  {
    id: uuidv4(),
    vector: [0.005, 0.004, -0.003, -0.002, 0.001, 0.000, -0.001, 0.002, -0.003, 0.004],
    payload: {
      email: "I am currently out of office and will return next week.",
      reply: "Thank you for your message. I will respond when you return."
    }
  },
  {
    id: uuidv4(),
    vector: [0.002, 0.003, 0.004, -0.002, 0.001, -0.001, 0.002, 0.003, -0.004, 0.005],
    payload: {
      email: "Can you provide the latest project report?",
      reply: "Sure! I will send you the latest project report by the end of the day."
    }
  },
  {
    id: uuidv4(),
    vector: [-0.003, 0.002, 0.001, -0.004, 0.003, -0.002, 0.005, -0.001, 0.004, -0.005],
    payload: {
      email: "Please confirm your attendance for the workshop.",
      reply: "I confirm my attendance for the workshop. Thank you for the invite!"
    }
  },
  {
    id: uuidv4(),
    vector: [0.004, -0.003, 0.002, 0.001, -0.005, 0.003, -0.002, 0.004, -0.001, 0.002],
    payload: {
      email: "Your subscription will expire soon.",
      reply: "Thanks for the reminder! I will renew my subscription shortly."
    }
  },
  {
    id: uuidv4(),
    vector: [0.003, 0.001, -0.002, 0.004, -0.003, 0.002, 0.001, -0.004, 0.003, 0.002],
    payload: {
      email: "Could you share the meeting minutes from yesterday?",
      reply: "Yes, I will share the meeting minutes with you shortly."
    }
  },
  {
    id: uuidv4(),
    vector: [-0.002, 0.003, 0.001, -0.004, 0.002, 0.001, -0.003, 0.004, 0.002, -0.001],
    payload: {
      email: "Please update me on the client feedback.",
      reply: "I have received the client feedback and will update you shortly."
    }
  }
];

const BATCH_SIZE = 2;
const DELAY_MS = 500;      

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function addTrainingDataWithPredefinedEmbeddings() {
  for (let i = 0; i < trainingPoints.length; i += BATCH_SIZE) {
    const batch = trainingPoints.slice(i, i + BATCH_SIZE);

    for (const point of batch) {
      try {
        await QdrantRAGService.upsertPoint(point.id, point.vector, point.payload);
        console.log("Upserted point for email:", point.payload.email.slice(0, 50));
      } catch (err) {
        console.error(
          `Error adding training data for email: ${point.payload.email.slice(0, 50)}`,
          err
        );
      }
    }

    if (i + BATCH_SIZE < trainingPoints.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log("Training data processing completed.");
}

async function main() {
  await QdrantRAGService.initCollection();
  await addTrainingDataWithPredefinedEmbeddings();
}

main().catch(console.error);
