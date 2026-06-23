const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_RE.test(code);
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}
