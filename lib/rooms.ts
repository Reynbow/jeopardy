import { randomBytes } from "crypto";
import { generateRoomCode } from "./codes";
import {
  defaultGame,
  defaultSettings,
  normalizeGameState,
  normalizeSettings,
  pruneGame,
} from "./default-state";
import { getStore } from "./store";
import {
  collectMediaUrls,
  removeUnusedMedia,
  syncRoomMedia,
} from "./media";
import type { GameSettings, Player, Room } from "./types";

function newHostSecret() {
  return randomBytes(24).toString("hex");
}

function newPlayerId() {
  return randomBytes(12).toString("hex");
}

function resetClueState(room: Room) {
  room.game.buzzes = [];
  room.game.showQuestionToPlayers = true;
  room.game.showAnswerToPlayers = false;
  room.game.activeImageIndex = 0;
  room.game.audioCache = {};
  room.game.audioPlayAt = null;
  room.game.audioPaused = false;
  room.game.audioPositionMs = 0;
  room.game.audioControlRev = 0;
}

function activeClueHasAudio(room: Room): boolean {
  const active = room.game.active;
  if (!active) return false;
  const clue = room.settings.categories[active.cat]?.clues[active.row];
  return !!((clue?.audioUrl || "").trim());
}

function activeClueHasSecondImage(room: Room): boolean {
  const active = room.game.active;
  if (!active) return false;
  const clue = room.settings.categories[active.cat]?.clues[active.row];
  return !!((clue?.imageUrl || "").trim()) && !!((clue?.imageUrl2 || "").trim());
}

export async function createRoom(): Promise<{ code: string; hostSecret: string }> {
  const store = getStore();
  let code = generateRoomCode();
  for (let i = 0; i < 20; i++) {
    const existing = await store.getRoom(code);
    if (!existing) break;
    code = generateRoomCode();
  }

  const hostSecret = newHostSecret();
  const room: Room = {
    code,
    hostSecret,
    settings: defaultSettings(),
    game: defaultGame(),
    players: [],
    createdAt: Date.now(),
    revision: 0,
  };
  await store.setRoom(room);
  return { code, hostSecret };
}

export async function getRoom(code: string): Promise<Room | null> {
  const room = await getStore().getRoomFresh(code);
  if (!room) return null;
  if (typeof room.revision !== "number") room.revision = 0;
  room.game = normalizeGameState(room.game);
  return room;
}

function mergePlayerLists(fresh: Player[], local: Player[]): Player[] {
  const merged = new Map(fresh.map((p) => [p.id, p]));
  for (const p of local) {
    merged.set(p.id, p);
  }
  return Array.from(merged.values());
}

export async function saveRoom(
  room: Room,
  options: { syncMedia?: boolean; playersTouched?: boolean } = {}
) {
  room.game = normalizeGameState(room.game);
  pruneGame(room);

  const store = getStore();
  const fresh = await store.getRoomFresh(room.code);
  if (fresh && !options.playersTouched) {
    room.players = mergePlayerLists(fresh.players, room.players);
    room.revision = Math.max(fresh.revision ?? 0, room.revision ?? 0);
  }

  room.revision = (room.revision ?? 0) + 1;

  if (options.syncMedia) {
    const prev = fresh ?? (await store.getRoomFresh(room.code));
    await removeUnusedMedia(room.code, prev, room);
    await syncRoomMedia(room.code, collectMediaUrls(room));
  }

  await store.setRoom(room);
}

export async function joinRoom(
  code: string,
  name: string,
  clientId?: string
): Promise<{ playerId: string; room: Room } | null> {
  const room = await getRoom(code);
  if (!room) return null;

  const trimmed = name.trim().slice(0, 32);
  if (!trimmed) return null;

  const existing = clientId
    ? room.players.find((p) => p.id === clientId)
    : undefined;

  if (existing) {
    existing.name = trimmed;
    await saveRoom(room);
    return { playerId: existing.id, room };
  }

  const playerId = newPlayerId();
  room.players.push({ id: playerId, name: trimmed, score: 0 });
  await saveRoom(room);
  return { playerId, room };
}

function inBounds(room: Room, cat: number, row: number) {
  return (
    Number.isInteger(cat) &&
    Number.isInteger(row) &&
    cat >= 0 &&
    cat < room.settings.categories.length &&
    row >= 0 &&
    row < room.settings.rows
  );
}

export type ActionMessage =
  | { type: "updateSettings"; settings: Partial<GameSettings> }
  | { type: "reveal"; cat: number; row: number }
  | { type: "closeClue" }
  | { type: "buzz" }
  | { type: "goldenBuzz" }
  | { type: "showQuestion" }
  | { type: "showAnswer" }
  | { type: "setActiveImage"; index: number }
  | { type: "adjustScore"; index: number; delta: number; playerId?: string }
  | { type: "setScore"; index: number; value: number }
  | { type: "resetScores" }
  | { type: "resetGame" }
  | { type: "newGame" }
  | { type: "kickPlayer"; targetPlayerId: string }
  | { type: "reportAudioCache"; percent: number; ready: boolean }
  | { type: "startAudio" }
  | { type: "pauseAudio" }
  | { type: "restartAudio" };

export type ActionResult = {
  ok: boolean;
  error?: string;
  room?: Room;
  /** Player session is no longer valid — client should leave the game. */
  kicked?: boolean;
  /** Action succeeded without persisting (e.g. stale audio cache report). */
  skipSave?: boolean;
};

function playerMissing(
  room: Room,
  auth: { hostSecret?: string; playerId?: string }
): ActionResult | null {
  if (!auth.playerId || auth.hostSecret) return null;
  if (room.players.some((p) => p.id === auth.playerId)) return null;
  return { ok: false, error: "Player not in room", kicked: true };
}

export async function handleAction(
  code: string,
  msg: ActionMessage,
  auth: { hostSecret?: string; playerId?: string }
): Promise<ActionResult> {
  const room = await getRoom(code);
  if (!room) return { ok: false, error: "Room not found" };

  const missing = playerMissing(room, auth);
  if (missing) return missing;

  const isHost = !!auth.hostSecret && auth.hostSecret === room.hostSecret;
  const isPlayer = !!auth.playerId && room.players.some((p) => p.id === auth.playerId);
  let playersTouched = false;

  switch (msg.type) {
    case "updateSettings": {
      if (!isHost) return { ok: false, error: "Host only" };
      const incoming = msg.settings || {};
      room.settings = normalizeSettings({ ...room.settings, ...incoming });
      break;
    }

    case "reveal": {
      if (!isHost) return { ok: false, error: "Host only" };
      const { cat, row } = msg;
      if (inBounds(room, cat, row)) {
        room.game.revealed[`${cat}-${row}`] = true;
        room.game.active = { cat, row };
        resetClueState(room);
      }
      break;
    }

    case "closeClue": {
      if (!isHost) return { ok: false, error: "Host only" };
      room.game.active = null;
      resetClueState(room);
      break;
    }

    case "buzz": {
      if (!isPlayer) return { ok: false, error: "Players only" };
      if (!room.game.active) return { ok: false, error: "No active clue" };
      if (room.game.buzzes.some((b) => b.playerId === auth.playerId)) {
        break;
      }
      room.game.buzzes.push({ playerId: auth.playerId!, at: Date.now() });
      if (room.game.buzzes.length === 1) {
        room.game.showQuestionToPlayers = false;
      }
      break;
    }

    case "goldenBuzz": {
      if (!isPlayer) return { ok: false, error: "Players only" };
      if (!room.settings.goldenBuzzerEnabled) {
        return { ok: false, error: "Golden buzzer disabled" };
      }
      if (!room.game.active) return { ok: false, error: "No active clue" };
      if (room.game.goldenUsed[auth.playerId!]) {
        return { ok: false, error: "Golden buzzer already used" };
      }
      if (room.game.buzzes.some((b) => b.playerId === auth.playerId)) {
        break;
      }
      room.game.buzzes.push({
        playerId: auth.playerId!,
        at: Date.now(),
        golden: true,
      });
      room.game.goldenUsed[auth.playerId!] = true;
      if (room.game.buzzes.length === 1) {
        room.game.showQuestionToPlayers = false;
      }
      break;
    }

    case "showQuestion": {
      if (!isHost) return { ok: false, error: "Host only" };
      if (!room.game.active) return { ok: false, error: "No active clue" };
      room.game.showQuestionToPlayers = true;
      break;
    }

    case "showAnswer": {
      if (!isHost) return { ok: false, error: "Host only" };
      if (!room.game.active) return { ok: false, error: "No active clue" };
      room.game.showAnswerToPlayers = true;
      break;
    }

    case "setActiveImage": {
      if (!isHost) return { ok: false, error: "Host only" };
      if (!room.game.active) return { ok: false, error: "No active clue" };
      const index = msg.index === 1 ? 1 : 0;
      if (index === 1 && !activeClueHasSecondImage(room)) {
        return { ok: false, error: "No second image" };
      }
      room.game.activeImageIndex = index;
      break;
    }

    case "adjustScore": {
      if (!isHost) return { ok: false, error: "Host only" };
      const p =
        typeof msg.playerId === "string"
          ? room.players.find((pl) => pl.id === msg.playerId)
          : room.players[msg.index];
      if (p) {
        let delta = Number(msg.delta) || 0;
        const goldenBuzz = room.game.buzzes.some(
          (b) => b.playerId === p.id && b.golden
        );
        if (goldenBuzz) {
          delta *= 2;
        }
        p.score += delta;
        if (room.game.active && delta !== 0) {
          room.game.showQuestionToPlayers = true;
          if (delta > 0) {
            room.game.showAnswerToPlayers = true;
          }
        }
      }
      break;
    }

    case "setScore": {
      if (!isHost) return { ok: false, error: "Host only" };
      const p = room.players[msg.index];
      if (p) p.score = Number(msg.value) || 0;
      break;
    }

    case "resetScores": {
      if (!isHost) return { ok: false, error: "Host only" };
      room.players.forEach((p) => (p.score = 0));
      break;
    }

    case "resetGame": {
      if (!isHost) return { ok: false, error: "Host only" };
      room.game.revealed = {};
      room.game.active = null;
      resetClueState(room);
      break;
    }

    case "newGame": {
      if (!isHost) return { ok: false, error: "Host only" };
      room.game.revealed = {};
      room.game.active = null;
      room.game.goldenUsed = {};
      resetClueState(room);
      room.players.forEach((p) => (p.score = 0));
      break;
    }

    case "kickPlayer": {
      if (!isHost) return { ok: false, error: "Host only" };
      const idx = room.players.findIndex((p) => p.id === msg.targetPlayerId);
      if (idx === -1) return { ok: false, error: "Player not found" };
      room.players.splice(idx, 1);
      playersTouched = true;
      break;
    }

    case "reportAudioCache": {
      if (!isPlayer) return { ok: false, error: "Players only" };
      if (!room.game.active || !activeClueHasAudio(room)) {
        return { ok: true, room, skipSave: true };
      }
      const percent = Math.max(0, Math.min(100, Math.round(Number(msg.percent) || 0)));
      room.game.audioCache[auth.playerId!] = {
        percent,
        ready: !!msg.ready,
      };
      break;
    }

    case "startAudio": {
      if (!isHost) return { ok: false, error: "Host only" };
      if (!room.game.active || !activeClueHasAudio(room)) {
        return { ok: false, error: "No audio clue active" };
      }
      room.game.audioPaused = false;
      room.game.audioPositionMs = 0;
      room.game.audioPlayAt = Date.now() + 3000;
      room.game.audioControlRev = (room.game.audioControlRev || 0) + 1;
      break;
    }

    case "pauseAudio": {
      if (!isHost) return { ok: false, error: "Host only" };
      if (!room.game.active || !activeClueHasAudio(room)) {
        return { ok: false, error: "No audio clue active" };
      }
      if (!room.game.audioPlayAt || room.game.audioPaused) {
        return { ok: false, error: "Audio is not playing" };
      }
      const now = Date.now();
      room.game.audioPaused = true;
      room.game.audioPositionMs =
        now > room.game.audioPlayAt ? now - room.game.audioPlayAt : 0;
      room.game.audioControlRev = (room.game.audioControlRev || 0) + 1;
      break;
    }

    case "restartAudio": {
      if (!isHost) return { ok: false, error: "Host only" };
      if (!room.game.active || !activeClueHasAudio(room)) {
        return { ok: false, error: "No audio clue active" };
      }
      room.game.audioPaused = false;
      room.game.audioPositionMs = 0;
      room.game.audioPlayAt = Date.now() + 3000;
      room.game.audioControlRev = (room.game.audioControlRev || 0) + 1;
      break;
    }

    default:
      return { ok: false, error: "Unknown action" };
  }

  const syncMedia = msg.type === "updateSettings";
  if (playersTouched) {
    await saveRoom(room, { syncMedia, playersTouched: true });
  } else {
    await saveRoom(room, { syncMedia });
  }
  return { ok: true, room };
}
