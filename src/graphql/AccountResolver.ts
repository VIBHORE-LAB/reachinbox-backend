import { AccountService } from "../services/IMAPService";
import { EmailService } from "../services/EmailService";
import { Types } from "mongoose";
import { MyContext } from "../server";

const emailService = new EmailService();

export const accountResolvers = {
  Query: {
    listAccounts: async (_: any, __: any, context: MyContext) => {
      if (!context.userId) throw new Error("Not authenticated");
      const accounts = await AccountService.listUserAccounts(new Types.ObjectId(context.userId));
      return accounts.map(acc => ({
        id: acc._id.toString(),
        host: acc.host,
        port: acc.port,
        user: acc.user,
        demo: acc.demo,
        createdAt: acc.createdAt.toISOString(),
      }));
    },
  },

  Mutation: {
    addAccount: async (_: any, { input }: { input: any }, context: MyContext) => {
      if (!context.userId) throw new Error("Not authenticated");
      const acc = await AccountService.createUserAccount(input, new Types.ObjectId(context.userId));
      await emailService.startImap(acc);
      return {
        id: acc._id.toString(),
        host: acc.host,
        port: acc.port,
        user: acc.user,
        demo: acc.demo,
        createdAt: acc.createdAt.toISOString(),
      };
    },

    startImap: async (_: any, { demo, input }: { demo: boolean; input?: any }, context: MyContext) => {
      let accountsToStart: any[] = [];

      if (demo) {
        accountsToStart = await AccountService.loadDemoAccounts();
      } else {
        if (!context.userId) throw new Error("Not authenticated");
        if (!input) throw new Error("Account input is required when demo is false");

        const acc = await AccountService.createUserAccount(input, new Types.ObjectId(context.userId));
        accountsToStart.push(acc);
      }

      for (const acc of accountsToStart) {
        await emailService.startImap(acc);
      }

      return accountsToStart.map(acc => ({
        id: acc._id.toString(),
        host: acc.host,
        port: acc.port,
        user: acc.user,
        demo: acc.demo,
        createdAt: acc.createdAt.toISOString(),
      }));
    },
  },
};
