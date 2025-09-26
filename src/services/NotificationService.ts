import fetch from "node-fetch";
import * as dotenv from "dotenv";

dotenv.config();
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK || "";
const EXTERNAL_WEBHOOK = process.env.EXTERNAL_WEBHOOK || "";

const NotificationService = {
  async notifyInterestedEmail(email: { subject: string; from: string; to: string[]; body: string }) {
    const payload = {
      text: `📨 *New Interested Email*\nFrom: ${email.from}\nTo: ${email.to.join(", ")}\nSubject: ${email.subject}\nBody snippet: ${email.body.slice(0, 200)}`
    };

    try {
      if (SLACK_WEBHOOK) {
        await fetch(SLACK_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (EXTERNAL_WEBHOOK) {
        await fetch(EXTERNAL_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(email)
        });
      }
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  }
};

export default NotificationService;
