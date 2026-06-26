import type { Clue } from "./types";

export function normalizeClue(c: Partial<Clue> | undefined): Clue {
  const clue: Clue = {
    question: typeof c?.question === "string" ? c.question : "",
    answer: typeof c?.answer === "string" ? c.answer : "",
  };
  const promptType = c?.promptType;
  if (promptType === "image" || promptType === "audio") {
    clue.promptType = promptType;
  }
  const imageUrl = typeof c?.imageUrl === "string" ? c.imageUrl.trim() : "";
  const audioUrl = typeof c?.audioUrl === "string" ? c.audioUrl.trim() : "";
  if (imageUrl) clue.imageUrl = imageUrl;
  if (audioUrl) clue.audioUrl = audioUrl;
  if (!clue.promptType) {
    if (audioUrl) clue.promptType = "audio";
    else if (imageUrl) clue.promptType = "image";
    else clue.promptType = "text";
  }
  return clue;
}

export function clueHasContent(clue: Clue): boolean {
  return !!(
    clue.question?.trim() ||
    clue.imageUrl?.trim() ||
    clue.audioUrl?.trim()
  );
}
