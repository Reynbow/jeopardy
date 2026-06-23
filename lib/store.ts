import { Redis } from "@upstash/redis";
import type { Room } from "./types";

const ROOM_TTL_SEC = 60 * 60 * 24; // 24 hours

interface Store {
  getRoom(code: string): Promise<Room | null>;
  setRoom(room: Room): Promise<void>;
}

function roomKey(code: string) {
  return `jeopardy:room:${code}`;
}

function memoryStore(): Store {
  const g = globalThis as unknown as { __jeopardyRooms?: Map<string, Room> };
  if (!g.__jeopardyRooms) g.__jeopardyRooms = new Map();
  const map = g.__jeopardyRooms;

  return {
    async getRoom(code) {
      return map.get(code) ?? null;
    },
    async setRoom(room) {
      map.set(room.code, room);
    },
  };
}

function redisStore(): Store {
  const redis = Redis.fromEnv();
  return {
    async getRoom(code) {
      const data = await redis.get<Room>(roomKey(code));
      return data ?? null;
    },
    async setRoom(room) {
      await redis.set(roomKey(room.code), room, { ex: ROOM_TTL_SEC });
    },
  };
}

let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    store =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? redisStore()
        : memoryStore();
  }
  return store;
}
