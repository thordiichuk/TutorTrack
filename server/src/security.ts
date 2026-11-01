import { randomBytes, scrypt as scryptCb, createHash, timingSafeEqual, randomInt } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, LEN = 64;

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, LEN, { N, r: R, p: P });
  return `scrypt$${N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(pw, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: R, p: P });
  return timingSafeEqual(key, expected);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const normCode = (x: string) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const fmtCode = (x: string) => normCode(x).replace(/(.{4})(?=.)/g, "$1-");
export function newInviteCode() {
  let s = "";
  for (let i = 0; i < 16; i++) s += B32[randomInt(32)];
  return s;
}

export const passwordOk = (p: string) => p.length >= 8 && p.length <= 200 && /\p{L}/u.test(p) && /\d/.test(p);
