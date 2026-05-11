// scripts/generate_hash_password.js

import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error('❌ Usage: node scripts/generate_hash_password.js "your-password"');
  process.exit(1);
}

if (password.length < 8) {
  console.error("❌ Password must be at least 8 characters");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");

const passwordHash = `${salt}:${hash}`;

console.log("\n🔐 Generated password hash:\n");
console.log(passwordHash);

console.log("\n📋 SQL:\n");

console.log(`
INSERT INTO users (
  email,
  password_hash,
  name,
  role,
  created_at,
  updated_at
)
VALUES (
  'admin@teamflow.dev',
  '${passwordHash}',
  'Admin',
  'ADMIN',
  NOW(),
  NOW()
);
`);