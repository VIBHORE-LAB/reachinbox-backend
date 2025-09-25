import { EmailService } from "../services/EmailService";

const emailService = new EmailService();

export const emailResolvers = {
  Query: {
    fetchEmails: async (_: any, args: { size?: number }, context: { userId?: string }) => {
      try {
        const size = args.size || 50;
        const ownerId = context.userId;
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
        }));
      } catch (err) {
        console.error("Error in fetchEmails resolver:", err);
        return [];
      }
    },
  },
};
