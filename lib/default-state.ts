import type { GameSettings, Room } from "./types";
import { normalizeClue } from "./clue";

export function defaultSettings(): GameSettings {
  const values = [200, 400, 600, 800, 1000];
  const sample: Record<string, [string, string][]> = {
    "World Capitals": [
      ["This city on the Seine is the capital of France", "Paris"],
      ["Capital of Japan, the world's most populous metro area", "Tokyo"],
      ["This Australian capital is neither Sydney nor Melbourne", "Canberra"],
      ["Capital of Canada, on the Ottawa River", "Ottawa"],
      ["This city is the capital of Kazakhstan (renamed in 2019)", "Astana"],
    ],
    Science: [
      ["The chemical symbol for this element is 'O'", "Oxygen"],
      ["This planet is known as the Red Planet", "Mars"],
      ["The powerhouse of the cell", "The mitochondria"],
      ["This force keeps planets in orbit around the Sun", "Gravity"],
      ["The speed of light is roughly this many km per second", "300,000"],
    ],
    Movies: [
      ["This 1997 film featured Jack and Rose on a doomed ship", "Titanic"],
      ["Director of 'Jaws', 'E.T.' and 'Jurassic Park'", "Steven Spielberg"],
      ["In 'The Matrix', Neo chooses this color pill", "Red"],
      ["This animated film features a clownfish named Marlin", "Finding Nemo"],
      ["The highest-grossing film of all time (2009 sci-fi epic)", "Avatar"],
    ],
    History: [
      ["This wall fell in 1989", "The Berlin Wall"],
      ["First president of the United States", "George Washington"],
      ["The Titanic sank in this year", "1912"],
      ["This ancient wonder still stands in Giza, Egypt", "The Great Pyramid"],
      ["This empire was ruled by Julius Caesar", "The Roman Empire"],
    ],
    Sports: [
      ["Number of players on a soccer team on the field per side", "11"],
      ["This sport uses a shuttlecock", "Badminton"],
      ["The Olympics are held every this many years (summer)", "4 years"],
      ["This American sport's championship is the 'World Series'", "Baseball"],
      ["This racket sport has a tournament called Wimbledon", "Tennis"],
    ],
    Potpourri: [
      ["The number of days in a leap year", "366"],
      ["This hot drink is made from roasted beans", "Coffee"],
      ["The largest planet in our solar system", "Jupiter"],
      ["This currency is used across most of the European Union", "The Euro"],
      ["The tallest land animal", "The giraffe"],
    ],
  };

  const categories = Object.entries(sample).map(([name, clues]) => ({
    name,
    clues: clues.map(([question, answer]) => ({ question, answer })),
  }));

  return {
    title: "JEOPARDY!",
    rows: values.length,
    values,
    categories,
  };
}

export function defaultGame() {
  return {
    revealed: {} as Record<string, boolean>,
    active: null as { cat: number; row: number } | null,
    buzzes: [] as { playerId: string; at: number }[],
    showQuestionToPlayers: true,
    showAnswerToPlayers: false,
    audioCache: {} as Record<string, { percent: number; ready: boolean }>,
    audioPlayAt: null as number | null,
    audioPaused: false,
    audioPositionMs: 0,
    audioControlRev: 0,
    goldenUsed: {} as Record<string, boolean>,
  };
}

export function normalizeGameState(
  game: Partial<ReturnType<typeof defaultGame>>
): ReturnType<typeof defaultGame> {
  const base = defaultGame();
  const g = { ...base, ...game };
  g.buzzes = Array.isArray(g.buzzes)
    ? g.buzzes.filter((b) => b && typeof b.playerId === "string")
    : [];
  g.showQuestionToPlayers = g.showQuestionToPlayers !== false;
  g.showAnswerToPlayers = !!g.showAnswerToPlayers;
  g.audioCache =
    g.audioCache && typeof g.audioCache === "object" ? g.audioCache : {};
  g.audioPlayAt =
    typeof g.audioPlayAt === "number" ? g.audioPlayAt : null;
  g.audioPaused = !!g.audioPaused;
  g.audioPositionMs =
    typeof g.audioPositionMs === "number" && g.audioPositionMs >= 0
      ? g.audioPositionMs
      : 0;
  g.audioControlRev =
    typeof g.audioControlRev === "number" && g.audioControlRev >= 0
      ? g.audioControlRev
      : 0;
  g.goldenUsed =
    g.goldenUsed && typeof g.goldenUsed === "object" ? g.goldenUsed : {};
  return g;
}

export function normalizeSettings(settings: Partial<GameSettings>): GameSettings {
  const base = defaultSettings();
  const st: GameSettings = {
    title: typeof settings.title === "string" ? settings.title : base.title,
    rows: Math.max(1, Math.min(10, parseInt(String(settings.rows), 10) || base.rows)),
    values: Array.isArray(settings.values) ? settings.values.slice() : base.values.slice(),
    categories: Array.isArray(settings.categories) ? settings.categories : base.categories,
    goldenBuzzerEnabled: !!settings.goldenBuzzerEnabled,
  };

  st.values = Array.from({ length: st.rows }, (_, i) =>
    Number.isFinite(+st.values[i]) ? +st.values[i] : (i + 1) * 200
  );

  if (!st.categories.length) st.categories = base.categories;

  st.categories = st.categories.map((cat) => {
    const clues = Array.isArray(cat.clues) ? cat.clues : [];
    return {
      name: typeof cat.name === "string" ? cat.name : "",
      clues: Array.from({ length: st.rows }, (_, i) => normalizeClue(clues[i])),
    };
  });

  return st;
}

export function pruneGame(room: Room) {
  room.game = normalizeGameState(room.game);
  const cats = room.settings.categories.length;
  const rows = room.settings.rows;
  const revealed: Record<string, boolean> = {};
  for (const key of Object.keys(room.game.revealed || {})) {
    const [c, r] = key.split("-").map(Number);
    if (c < cats && r < rows) revealed[key] = true;
  }
  room.game.revealed = revealed;
  if (room.game.active) {
    const { cat, row } = room.game.active;
    if (!(cat < cats && row < rows)) {
      room.game.active = null;
      room.game.buzzes = [];
      room.game.showQuestionToPlayers = true;
    }
  }
  // Drop buzzes from players who left
  const ids = new Set(room.players?.map((p) => p.id) || []);
  room.game.buzzes = room.game.buzzes.filter((b) => ids.has(b.playerId));
  const cache = room.game.audioCache || {};
  room.game.audioCache = Object.fromEntries(
    Object.entries(cache).filter(([id]) => ids.has(id))
  );
  const goldenUsed = room.game.goldenUsed || {};
  room.game.goldenUsed = Object.fromEntries(
    Object.entries(goldenUsed).filter(([id]) => ids.has(id))
  );
}
