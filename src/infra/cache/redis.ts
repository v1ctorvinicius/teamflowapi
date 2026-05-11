import { createClient, type RedisClientType } from "redis";
import { config } from "../../config/env.ts";

let client: RedisClientType | null = null;

export function getRedisClient(): RedisClientType {
  if (!client) {
    client = createClient({
      url: `redis://${config.redis.host}:${config.redis.port}`,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error("[Redis] Max reconnect attempts reached");
            return new Error("Redis reconnect failed");
          }
          return Math.min(retries * 100, 3000);
        },
      },
    }) as RedisClientType;

    client.on("error", (err) => console.error("[Redis] Client error:", err));
    client.on("connect", () => console.log("[Redis] Connected"));
    client.on("reconnecting", () => console.log("[Redis] Reconnecting..."));
  }

  return client;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedisClient();
  if (!redis.isOpen) {
    await redis.connect();
  }
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
    client = null;
    console.log("[Redis] Connection closed");
  }
}

export const redisClient = getRedisClient();
