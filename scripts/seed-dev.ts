/**
 * DEVELOPER-ONLY seed script (never exposed in the running app).
 * Creates a local dev owner account, a "Milo" product (prefix ML) and a
 * batch of 10 unused codes.
 *
 * Usage:  npm run seed:dev
 * Requires the FIREBASE_ADMIN_* values in .env.local (see README).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { ensureDevOwner, seedDevData, DEV_EMAIL, DEV_PASSWORD } from "../src/lib/seed";
import { verifyUrl } from "../src/lib/code-utils";

async function main() {
  const { uid, created } = await ensureDevOwner();
  const result = await seedDevData(uid);

  console.log("");
  console.log("Dev data ready.");
  console.log(`  Product : ${result.productName} (id: ${result.productId})`);
  console.log(`  Batch   : ${result.batchId}`);
  console.log(`  Codes   : ${result.codes.length}${created ? " (new dev user created)" : ""}`);
  console.log("");
  console.log("Dashboard login (dev only):");
  console.log(`  email    : ${DEV_EMAIL}`);
  console.log(`  password : ${DEV_PASSWORD}`);
  console.log("");
  console.log("Test codes (first visit = genuine, second visit = already used):");
  for (const code of result.codes) {
    console.log(`  ${verifyUrl(code)}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
