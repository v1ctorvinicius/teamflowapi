//src/config/env.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");

// DEV ONLY
if (process.env.NODE_ENV !== "production" && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=");
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

// Configuração completa
export const config = {
  nodeEnv: requireEnv("NODE_ENV"),
  port: parseInt(process.env.PORT || "10000", 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:3000"],
  dbSSL: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true',
  database: {
    host: requireEnv("DB_HOST"),
    port: parseInt(requireEnv("DB_PORT"), 10),
    name: requireEnv("DB_NAME"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
  },
  redis: {
    host: process.env.REDIS_HOST || "",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    privateKey: requireEnv("JWT_PRIVATE_KEY"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
};
