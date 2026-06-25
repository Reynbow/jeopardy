import type { Room } from "./types";
import type { ClientState } from "./types";
import { normalizeClue } from "./clue";

function activeClueAnswer(room: Room): string | null {
  const active = room.game.active;
  if (!active) return null;
  const clue = room.settings.categories[active.cat]?.clues[active.row];
  return clue?.answer?.trim() || null;
}

export function toClientState(room: Room, isHost: boolean): ClientState {
  const settings = isHost
    ? room.settings
    : {
        ...room.settings,
        categories: room.settings.categories.map((cat) => ({
          name: cat.name,
          clues: cat.clues.map((c) => {
            const clue = normalizeClue(c);
            return { ...clue, answer: "" };
          }),
        })),
      };

  const activeAnswer =
    !isHost && room.game.showAnswerToPlayers && room.game.active
      ? activeClueAnswer(room)
      : null;

  return {
    settings,
    game: room.game,
    players: room.players,
    revision: room.revision ?? 0,
    serverTime: Date.now(),
    activeAnswer,
  };
}
