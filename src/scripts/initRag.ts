import { QdrantRAGService } from "../services/QdrantService";

const trainingData = [
  {
    email: "Hi, Your resume has been shortlisted. When will be a good time for you to attend the technical interview?",
    reply: "Thank you for shortlisting my profile! I'm available for a technical interview. You can book a slot here: https://cal.com/example"
  },
  {
    email: "We have booked your meeting for next Tuesday.",
    reply: "Thanks for confirming the meeting. Looking forward to it!"
  },
  {
    email: "I am currently out of office and will return next week.",
    reply: "Thank you for your message. I will respond when you return."
  },
  {
    email: "Can you provide the latest project report?",
    reply: "Sure! I will send you the latest project report by the end of the day."
  },
  {
    email: "Please confirm your attendance for the workshop.",
    reply: "I confirm my attendance for the workshop. Thank you for the invite!"
  },
  {
    email: "Your subscription will expire soon.",
    reply: "Thanks for the reminder! I will renew my subscription shortly."
  }
];

async function main() {
  await QdrantRAGService.initCollection();
  await QdrantRAGService.addTrainingData(trainingData);
}

main().catch(console.error);
