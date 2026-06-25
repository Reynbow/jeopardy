import type { Clue } from "./types";

export function normalizeClue(c: Partial<Clue> | undefined): Clue {
  const clue: Clue = {
    question: typeof c?.question === "string" ? c.question : "",
    answer: typeof c?.answer === "string" ? c.answer : "",
  };
  const imageUrl = typeof c?.imageUrl === "string" ? c.imageUrl.trim() : "";
  const audioUrl = typeof c?.audioUrl === "string" ? c.audioUrl.trim() : "";
  if (imageUrl) clue.imageUrl = imageUrl;
  if (audioUrl) clue.audioUrl = audioUrl;
  return clue;
}

export function clueHasContent(clue: Clue): boolean {
  return !!(
    clue.question?.trim() ||
    clue.imageUrl?.trim() ||
    clue.audioUrl?.trim()
  );
}
