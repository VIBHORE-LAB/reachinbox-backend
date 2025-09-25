import { EmailService } from "../services/EmailService";
import { AccountService } from "../services/IMAPService";
const emailService = new EmailService();

export async function startAllDemoAccounts() {
  const demoAccounts = await AccountService.loadDemoAccounts();
  for (const acc of demoAccounts) {
    emailService.startImap(acc);
  }
}
