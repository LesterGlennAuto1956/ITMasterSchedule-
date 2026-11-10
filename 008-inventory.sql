// Microsoft (Entra ID) sign-in and session helpers shared by functions/_middleware.js and functions/api.
// People sign in with their Microsoft 365 work account; the app keeps its own short session.
// Session cookies hold a random token; the database stores only its SHA-256 hash.
//
// Settings (Pages project > Settings > Variables and secrets):
//   MS_TENANT_ID           Directory (tenant) ID (shared with the email settings)
//   MS_LOGIN_CLIENT_ID     Application (client) ID of the "IT Master Tool Sign-in" app
//   MS_LOGIN_CLIENT_SECRET its client secret (add as a Secret)
//   INITIAL_MANAGERS       Microsoft emails that are always allowed in as managers, comma-separated

export const COOKIE = "it_session";
export const STATE_COOKIE = "it_oauth";
export const IDLE_MS = 4 * 60 * 60 * 1000;     // signed out after 4 hours of inactivity
export const MAX_MS = 12 * 60 * 60 * 1000;     // and always after 12 hours
export const STATE_MS = 10 * 60 * 1000;        // time allowed to finish the Microsoft sign-in

const enc = new TextEncoder();
export const b64url = u8 => { let s = ""; for (const b of u8) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

export async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export const newToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
export async function pkce() {
  const verifier = newToken();
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
  return { verifier, challenge };
}
export function decodeJwtPayload(jwt) {
  const p = String(jwt).split(".")[1];
  if (!p) throw new Error("Malformed token");
  let s = p.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))));
}
export function readCookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}
const secureFlag = request => new URL(request.url).protocol === "https:" ? "; Secure" : "";
// Lax (not Strict) so the cookie survives the redirect back from Microsoft. Cross-site
// writes are still blocked by the Origin check in _middleware.js.
export const cookie = (request, name, value, maxAgeSec) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag(request)}`;
export const sessionCookie = (token, request) => cookie(request, COOKIE, token, MAX_MS / 1000);
export const clearCookie = (request, name = COOKIE) => cookie(request, name, "", 0);

export function loginSettings(env) {
  const missing = ["MS_TENANT_ID", "MS_LOGIN_CLIENT_ID", "MS_LOGIN_CLIENT_SECRET"].filter(k => !env[k]);
  return { configured: missing.length === 0, missing, authority: (env.MS_AUTHORITY || "https://login.microsoftonline.com").replace(/\/$/, "") };
}
export const initialManagers = env => (env.INITIAL_MANAGERS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);

export async function createSession(db, email) {
  const token = newToken(), now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE last_seen < ?1 OR created_at < ?2").bind(now - IDLE_MS, now - MAX_MS),
    db.prepare("DELETE FROM oauth_states WHERE created_at < ?1").bind(now - STATE_MS),
    db.prepare("INSERT INTO sessions (token_hash, username, created_at, last_seen) VALUES (?1, ?2, ?3, ?3)").bind(await sha256Hex(token), email, now),
  ]);
  return token;
}
export async function getSession(db, request) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const th = await sha256Hex(token);
  const row = await db.prepare(`SELECT s.created_at, s.last_seen, a.email, a.display_name, a.role
    FROM sessions s JOIN accounts a ON a.email = s.username WHERE s.token_hash = ?1`).bind(th).first();
  if (!row) return null;
  const now = Date.now();
  if (now - row.last_seen > IDLE_MS || now - row.created_at > MAX_MS) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(th).run();
    return null;
  }
  if (now - row.last_seen > 60000) await db.prepare("UPDATE sessions SET last_seen = ?2 WHERE token_hash = ?1").bind(th, now).run();
  return { tokenHash: th, email: row.email, username: row.email, name: row.display_name, role: row.role, isManager: row.role === "manager" };
}
