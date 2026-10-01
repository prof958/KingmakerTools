import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "kt-session";
const SESSION_DURATION = 60 * 60 * 24 * 30; // 30 days in seconds

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

// Dev-mode fallback hash for password "kingmaker" (bcrypt cost 10).
// bcrypt hashes contain $ signs which conflict with dotenv-expand variable
// substitution, so we keep a hardcoded fallback for local development.
const DEV_PASSWORD_HASH =
  "$2b$10$NUZIOIHwNzqXZreTb2hR6eNO28z9RqRocIqW4ByU3W6rmTknMNzyW";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Verify the provided password. APP_PASSWORD_HASH (bcrypt) wins when set;
 * otherwise a plain APP_PASSWORD is accepted, which is what the self-hosting
 * docker-compose.yml uses so nobody has to generate a hash full of `$` signs.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.APP_PASSWORD_HASH;
  const plain = process.env.APP_PASSWORD;
  if (!hash && plain) {
    return timingSafeEqual(sha256(password), sha256(plain));
  }
  return bcrypt.compare(password, hash || DEV_PASSWORD_HASH);
}

/**
 * Create a session JWT and set it as a cookie.
 */
export async function createSession(): Promise<void> {
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Browsers drop Secure cookies over plain http (except on localhost), so a
    // self-hosted install reached at http://<lan-ip>:3000 sets SECURE_COOKIES=false.
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.SECURE_COOKIES !== "false",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Validate the current session from cookies.
 * Returns true if the user has a valid session.
 */
export async function validateSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return false;

    const { payload } = await jwtVerify(token, getSecret());
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

/**
 * Destroy the current session.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Hash a password (utility for generating APP_PASSWORD_HASH).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
