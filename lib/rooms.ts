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
import type { GameSettings, Room } from "./types";

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
  };
  await store.setRoom(room);
  return { code, hostSecret };
}

export async function getRoom(code: string): Promise<Room | null> {
  const room = await getStore().getRoom(code);
  if (!room) return null;
  room.game = normalizeGameState(room.game);
  return room;
}

export async function saveRoom(room: Room) {
  room.game = normalizeGameState(room.game);
  pruneGame(room);
  await getStore().setRoom(room);
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
  | { type: "showQuestion" }
  | { type: "showAnswer" }
  | { type: "adjustScore"; index: number; delta: number }
  | { type: "setScore"; index: number; value: number }
  | { type: "resetScores" }
  | { type: "resetGame" }
  | { type: "newGame" };

export async function handleAction(
  code: string,
  msg: ActionMessage,
  auth: { hostSecret?: string; playerId?: string }
): Promise<{ ok: boolean; error?: string; room?: Room }> {
  const room = await getRoom(code);
  if (!room) return { ok: false, error: "Room not found" };

  const isHost = !!auth.hostSecret && auth.hostSecret === room.hostSecret;
  const isPlayer = !!auth.playerId && room.players.some((p) => p.id === auth.playerId);

  switch (msg.type) {
    case "updateSettings": {
      if (!isHost) return { ok: false, error: "Host only" };
      const incoming = msg.settings || {};
      const oldPlayers = room.players;
      room.settings = normalizeSettings({ ...room.settings, ...incoming });
      room.players = oldPlayers;
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

    case "adjustScore": {
      if (!isHost) return { ok: false, error: "Host only" };
      const p = room.players[msg.index];
      if (p) p.score += Number(msg.delta) || 0;
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
      resetClueState(room);
      room.players.forEach((p) => (p.score = 0));
      break;
    }

    default:
      return { ok: false, error: "Unknown action" };
  }

  await saveRoom(room);
  return { ok: true, room };
}
