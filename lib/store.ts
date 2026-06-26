import { Redis } from "@upstash/redis";
import type { Room } from "./types";
import { ROOM_TTL_SEC } from "./constants";

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

function hasRedisEnv() {
  return (
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

let store: Store | null = null;

function cloneRoom(room: Room): Room {
  return JSON.parse(JSON.stringify(room)) as Room;
}

/** In-process read-through cache — avoids a Redis round-trip per poll on warm instances. */
function cachedStore(inner: Store): Store {
  const g = globalThis as unknown as { __jeopardyRoomCache?: Map<string, Room> };
  if (!g.__jeopardyRoomCache) g.__jeopardyRoomCache = new Map();
  const cache = g.__jeopardyRoomCache;

  return {
    async getRoom(code) {
      const hit = cache.get(code);
      if (hit) return cloneRoom(hit);
      const data = await inner.getRoom(code);
      if (data) cache.set(code, cloneRoom(data));
      return data;
    },
    async setRoom(room) {
      cache.set(room.code, cloneRoom(room));
      await inner.setRoom(room);
    },
  };
}

export function getStore(): Store {
  if (!store) {
    const base = hasRedisEnv() ? redisStore() : memoryStore();
    store = cachedStore(base);
  }
  return store;
}
