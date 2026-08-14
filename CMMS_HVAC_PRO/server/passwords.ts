import { hash, verify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32
};

export const isArgon2Hash = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("$argon2id$");

export const isLegacyBcryptHash = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("$2");

export async function hashPin(pin: string) {
  return hash(pin, ARGON2_OPTIONS);
}

export async function verifyPin(storedHash: unknown, pin: string) {
  if (isArgon2Hash(storedHash)) {
    return verify(storedHash, pin);
  }

  if (isLegacyBcryptHash(storedHash)) {
    return bcrypt.compareSync(pin, storedHash);
  }

  return process.env.NODE_ENV !== "production" && typeof storedHash === "string"
    ? storedHash === pin
    : false;
}

export function needsArgon2Upgrade(storedHash: unknown) {
  return !isArgon2Hash(storedHash);
}
