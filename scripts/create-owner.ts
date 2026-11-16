/**
 * Developer CLI: create a manufacturer OWNER account.
 * Public signup is disabled on purpose — owner accounts are provisioned here.
 *
 * Usage:
 *   npm run create-owner -- owner@brand.com "StrongPass123" "Brand Name"
 *
 * Requires the FIREBASE_ADMIN_* values in .env.local.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { adminAuth, adminDb } from "../src/lib/firebase-admin";
import type { ManufacturerDoc } from "../src/lib/types";

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();

  if (!email || !password) {
    console.error('Usage: npm run create-owner -- <email> <password> ["Name"]');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Invalid email address.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  let uid: string;
  try {
    uid = (await adminAuth().getUserByEmail(email)).uid;
    console.log("Existing Firebase user found — updating its account record.");
  } catch {
    const user = await adminAuth().createUser({
      email,
      password,
      displayName: name || email.split("@")[0],
      emailVerified: false,
    });
    uid = user.uid;
  }

  const now = Date.now();
  const doc: ManufacturerDoc = {
    name: name || email.split("@")[0],
    email,
    role: "owner",
    ownerId: uid,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await adminDb().doc(`manufacturers/${uid}`).set(doc, { merge: true });

  console.log("");
  console.log("Owner account ready.");
  console.log(`  email : ${email}`);
  console.log(`  uid   : ${uid}`);
  console.log("");
  console.log("Sign in at /login");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
