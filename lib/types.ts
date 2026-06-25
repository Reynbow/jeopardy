export interface Clue {
  question: string;
  answer: string;
  /** Optional image shown with the clue (URL from upload or external link). */
  imageUrl?: string;
  /** Optional audio played with the clue (URL from upload or external link). */
  audioUrl?: string;
}

export interface Category {
  name: string;
  clues: Clue[];
}

export interface GameSettings {
  title: string;
  rows: number;
  values: number[];
  categories: Category[];
}

export interface BuzzEntry {
  playerId: string;
  at: number;
}

export interface AudioCacheEntry {
  percent: number;
  ready: boolean;
}

export interface GameState {
  revealed: Record<string, boolean>;
  active: { cat: number; row: number } | null;
  buzzes: BuzzEntry[];
  /** When false, players cannot see the clue question text (after a buzz). */
  showQuestionToPlayers: boolean;
  /** When true, players can see the answer on the question screen. */
  showAnswerToPlayers: boolean;
  /** Per-player audio preload progress for the active audio clue. */
  audioCache: Record<string, AudioCacheEntry>;
  /** Server timestamp (ms) when synced audio playback should start. */
  audioPlayAt: number | null;
}

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface Room {
  code: string;
  hostSecret: string;
  settings: GameSettings;
  game: GameState;
  players: Player[];
  createdAt: number;
  revision: number;
}

export interface ClientState {
  settings: GameSettings;
  game: GameState;
  players: Player[];
  revision: number;
  /** Server time (ms) for syncing scheduled audio playback. */
  serverTime: number;
  /** Answer text for the active clue, only sent to players when host reveals it. */
  activeAnswer?: string | null;
}
