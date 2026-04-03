import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

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

/**
 * Verify the provided password against the stored hash.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.APP_PASSWORD_HASH || DEV_PASSWORD_HASH;
  return bcrypt.compare(password, hash);
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
    secure: process.env.NODE_ENV === "production",
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
