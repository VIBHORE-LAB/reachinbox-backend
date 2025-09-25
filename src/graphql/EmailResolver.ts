import { MyContext } from "../server";
import { EmailService } from "../services/EmailService";
import { IAccount } from "../models/account.model";

const emailService = new EmailService();

export const emailResolvers = {
  Query: {
    fetchEmails: async (_: any, args: { size?: number }, context: MyContext) => {
      try {
        const size = args.size || 50;
        const ownerId = context.userId || undefined;
        const emails = await emailService.getEmails(ownerId, size);

        return (emails || []).map((email: any) => ({
          id: email.id || "",
          ownerId: email.ownerId || null,
          account: email.account || "",
          folder: email.folder || "Inbox",
          from: email.from || "",
          to: email.to || [],
          subject: email.subject || "",
          date: email.date || new Date().toISOString(),
          body: email.body || "",
          snippet: email.snippet || "",
          labels: email.labels || [],
          suggestedReply: email.suggestedReply || null,
          fetchedAt: email.fetchedAt || new Date().toISOString(),
          flags: email.flags || [],
          processed: email.processed,
        }));
      } catch (err) {
        console.error("Error in fetchEmails resolver:", err);
        return [];
      }
    },
  },

  Mutation: {
sendSuggestedReply: async (_: any, args: { emailId: string }, context: MyContext) => {
  try {
    const sent = await emailService.sendEmail(args.emailId);
    return sent;
  } catch (err) {
    console.error("Error sending suggested reply:", err);
    return false;
  }
},
SuggestedReply: async (_: any, args: { emailId: string }, context: MyContext) => {
    try {
      const suggestedReply = await emailService.generateSuggestedReply(args.emailId);

      if (!suggestedReply) {
        console.error(`Failed to generate suggested reply for email ID ${args.emailId}`);
        return false;
      }

      console.log(`Suggested reply generated for email ID ${args.emailId}`);
      return true;
    } catch (err) {
      console.error("Error generating suggested reply:", err);
      return false;
    }
  },
},

  }

