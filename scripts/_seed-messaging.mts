import "dotenv/config";
import { ensureMessagingSetup } from "../src/lib/messaging/config";

const { config } = await ensureMessagingSetup();
console.log("messaging seeded", {
  notifySms: config.notifySms,
  notifyWhatsapp: config.notifyWhatsapp,
  notifyEmail: config.notifyEmail,
});
