import { unlink } from "fs/promises";
import path from "path";
import { Redis } from "@upstash/redis";
import { ROOM_TTL_SEC } from "./constants";
import type { Room } from "./types";

const EXPIRY_ZSET = "jeopardy:media:expiry";

function mediaKey(code: string) {
  return `jeopardy:media:${code}`;
}

function hasRedisEnv() {
  return (
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

function redis() {
  return Redis.fromEnv();
}

interface MemoryMediaEntry {
  urls: string[];
  expiresAt: number;
}

function memoryMediaMap() {
  const g = globalThis as unknown as {
    __jeopardyMedia?: Map<string, MemoryMediaEntry>;
  };
  if (!g.__jeopardyMedia) g.__jeopardyMedia = new Map();
  return g.__jeopardyMedia;
}

export function collectMediaUrls(room: Room): string[] {
  const urls = new Set<string>();
  for (const cat of room.settings.categories) {
    for (const clue of cat.clues) {
      if (clue.imageUrl?.trim()) urls.add(clue.imageUrl.trim());
      if (clue.audioUrl?.trim()) urls.add(clue.audioUrl.trim());
    }
  }
  return [...urls];
}

/** URLs we uploaded and can delete (not external links). */
export function isManagedMediaUrl(url: string): boolean {
  if (url.startsWith("/uploads/")) return true;
  return url.includes("blob.vercel-storage.com");
}

export async function deleteMediaUrl(url: string): Promise<boolean> {
  if (!isManagedMediaUrl(url)) return false;

  if (url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import("@vercel/blob");
      await del(url);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

async function deleteMediaUrls(urls: string[]): Promise<number> {
  let deleted = 0;
  for (const url of urls) {
    if (await deleteMediaUrl(url)) deleted++;
  }
  return deleted;
}

export async function syncRoomMedia(code: string, urls: string[]): Promise<void> {
  const managed = urls.filter(isManagedMediaUrl);
  const expiresAt = Date.now() + ROOM_TTL_SEC * 1000;

  if (hasRedisEnv()) {
    const r = redis();
    if (managed.length) {
      await r.set(mediaKey(code), managed, { ex: ROOM_TTL_SEC + 3600 });
    } else {
      await r.del(mediaKey(code));
    }
    await r.zadd(EXPIRY_ZSET, { score: expiresAt, member: code });
    return;
  }

  const map = memoryMediaMap();
  if (managed.length) {
    map.set(code, { urls: managed, expiresAt });
  } else {
    map.delete(code);
  }
  void cleanupExpiredMedia();
}

export async function registerUploadedMedia(
  code: string,
  url: string
): Promise<void> {
  if (!isManagedMediaUrl(url)) return;

  let urls: string[] = [];

  if (hasRedisEnv()) {
    const r = redis();
    const existing = await r.get<string[]>(mediaKey(code));
    urls = Array.isArray(existing) ? existing.slice() : [];
    if (!urls.includes(url)) urls.push(url);
  } else {
    const map = memoryMediaMap();
    const entry = map.get(code);
    urls = entry ? entry.urls.slice() : [];
    if (!urls.includes(url)) urls.push(url);
  }

  await syncRoomMedia(code, urls);
}

export async function removeUnusedMedia(
  code: string,
  previous: Room | null,
  next: Room
): Promise<void> {
  if (!previous) return;
  const oldUrls = collectMediaUrls(previous).filter(isManagedMediaUrl);
  const newUrls = new Set(collectMediaUrls(next).filter(isManagedMediaUrl));
  for (const url of oldUrls) {
    if (!newUrls.has(url)) await deleteMediaUrl(url);
  }
}

export async function cleanupExpiredMedia(): Promise<{
  rooms: number;
  files: number;
}> {
  const now = Date.now();
  let rooms = 0;
  let files = 0;

  if (hasRedisEnv()) {
    const r = redis();
    const codes = await r.zrange(EXPIRY_ZSET, 0, now, { byScore: true });
    const expired = Array.isArray(codes) ? (codes as string[]) : [];

    for (const code of expired) {
      const urls = await r.get<string[]>(mediaKey(code));
      const list = Array.isArray(urls) ? urls : [];
      files += await deleteMediaUrls(list);
      await r.del(mediaKey(code));
      await r.zrem(EXPIRY_ZSET, code);
      rooms++;
    }

    return { rooms, files };
  }

  const map = memoryMediaMap();
  for (const [code, entry] of map.entries()) {
    if (entry.expiresAt > now) continue;
    files += await deleteMediaUrls(entry.urls);
    map.delete(code);
    rooms++;
  }

  return { rooms, files };
}
