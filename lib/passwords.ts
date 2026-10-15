import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derivedKey.toString("base64")}`;
}

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, cost, blockSize, parallelization, salt, storedHash] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !salt || !storedHash) return false;
  const derivedKey = scryptSync(password, salt, 64, { N: Number(cost), r: Number(blockSize), p: Number(parallelization) });
  const expectedKey = Buffer.from(storedHash, "base64");
  return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
}
