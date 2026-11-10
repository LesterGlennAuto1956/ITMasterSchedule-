// Runs before every request. Requires a Microsoft sign-in session for everything
// except the sign-in page, and keeps non-managers out of /timeoff.
// Required setup: D1 binding named DB, plus the Microsoft sign-in settings in lib/auth.js.
import { getSession } from "../lib/auth.js";

const json = (d, status) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
function page(status, title, body) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 20px;color:#14222e"><h1 style="font-size:1.4rem">${title}</h1><p>${body}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PUBLIC_API = new Set(["/api/auth/microsoft", "/api/auth/callback", "/api/auth/status"]);

export async function onRequest({ request, env, data, next }) {
  const url = new URL(request.url), p = url.pathname;
  if (!env.DB) return page(500, "Setup isn't finished", "The D1 database binding named DB hasn't been added to this Pages project yet.");

  // Block requests that come from other websites.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "Request blocked" }, 403);
  }

  let user = null;
  try { user = await getSession(env.DB, request); }
  catch (e) { return page(500, "Setup isn't finished", "The database tables are missing. Run schema.sql in the D1 Console."); }
  data.user = user;
  const isLoginPage = p === "/login" || p.startsWith("/login/");
  const isPublic = isLoginPage || p === "/login.js" || p === "/app.css" || PUBLIC_API.has(p);

  let res;
  if (!user) {
    if (isPublic) res = await next();
    else if (p.startsWith("/api/")) return json({ error: "Not signed in" }, 401);
    else return Response.redirect(`${url.origin}/login/?next=${encodeURIComponent(p + url.search)}`, 302);
  } else if (isLoginPage) {
    return Response.redirect(`${url.origin}/`, 302);
  } else {
    res = await next();
  }
  const out = new Response(res.body, res);
  out.headers.set("X-Frame-Options", "SAMEORIGIN");
  out.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("Referrer-Policy", "same-origin");
  if ((out.headers.get("content-type") || "").includes("text/html")) out.headers.set("Cache-Control", "no-store");
  return out;
}
