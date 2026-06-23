export interface Clue {
  question: string;
  answer: string;
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

export interface GameState {
  revealed: Record<string, boolean>;
  active: { cat: number; row: number } | null;
  buzzes: BuzzEntry[];
  /** When false, players cannot see the clue question text (after a buzz). */
  showQuestionToPlayers: boolean;
  /** When true, players can see the answer on the question screen. */
  showAnswerToPlayers: boolean;
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
}

export interface ClientState {
  settings: GameSettings;
  game: GameState;
  players: Player[];
  /** Answer text for the active clue, only sent to players when host reveals it. */
  activeAnswer?: string | null;
}
