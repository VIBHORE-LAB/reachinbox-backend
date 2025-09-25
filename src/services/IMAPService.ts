import { Types } from "mongoose";
import AccountModel, { IAccount } from "../models/account.model";
import { log } from "../utils/logger";

export type AccountInput = {
  host?: string;
  port?: number;
  user: string;
  password: string;
};

const inMemoryDemoAccounts: IAccount[] = [];

export const AccountService = {
  async createUserAccount(input: AccountInput, ownerId: Types.ObjectId): Promise<IAccount> {
    try {
      const acc = new AccountModel({
        ...input,
        demo: false,
        owner: ownerId,
      });
      await acc.save();
      return acc;
    } catch (error) {
      log("Error creating user account", error);
      throw new Error("Failed to create account");
    }
  },

  async listUserAccounts(ownerId: Types.ObjectId): Promise<IAccount[]> {
    try {
      return await AccountModel.find({ owner: ownerId });
    } catch (error) {
      log("Error listing user accounts", error);
      throw new Error("Failed to list accounts");
    }
  },

  async loadDemoAccounts(): Promise<IAccount[]> {
    try {
      if (inMemoryDemoAccounts.length > 0) return inMemoryDemoAccounts;

      const demoAccounts: IAccount[] = [];

      const demoUsers = [
        { user: process.env.DEMO_IMAP_USER1, pass: process.env.DEMO_IMAP_PASS1 },
        { user: process.env.DEMO_IMAP_USER2, pass: process.env.DEMO_IMAP_PASS2 },
      ];

      demoUsers.forEach((demo) => {
        if (demo.user) {
          demoAccounts.push({
            _id: new Types.ObjectId(),
            host: process.env.DEMO_IMAP_HOST || "imap.gmail.com",
            port: parseInt(process.env.DEMO_IMAP_PORT || "993"),
            user: demo.user,
            password: demo.pass || "",
            demo: true,
            owner: new Types.ObjectId(),
            createdAt: new Date(),
          } as IAccount);
        }
      });

      inMemoryDemoAccounts.push(...demoAccounts);
      return demoAccounts;
    } catch (error) {
      log("Error loading demo accounts", error);
      throw new Error("Failed to load demo accounts");
    }
  },

  async findAccountById(id: string): Promise<IAccount | null> {
    try {
      if (!Types.ObjectId.isValid(id)) return null;
      return await AccountModel.findById(id);
    } catch (error) {
      log("Error finding account by id", error);
      throw new Error("Failed to find account");
    }
  },
};
