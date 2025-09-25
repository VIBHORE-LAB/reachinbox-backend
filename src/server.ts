// src/server.ts
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./graphql/schema";
import { resolvers } from "./graphql";
import { connectMongoose } from "./config/mongoose";
import { log } from "./utils/logger";
import { startAllDemoAccounts } from "./graphql/EmailInitializer";
const PORT = process.env.PORT || 4000;

export interface MyContext {
  userId: string | null;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  await connectMongoose();
  await startAllDemoAccounts();

  const server = new ApolloServer<MyContext>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware<MyContext>(server, {
      context: async ({ req }) => {
        const userId = (req as any).user?._id?.toString() || null;
        return { userId };
      },
    })
  );

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(PORT, () => resolve());
    httpServer.on("error", reject);
  });

  log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
