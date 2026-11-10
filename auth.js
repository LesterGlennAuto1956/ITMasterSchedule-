// The data API both apps use. The signed-in user comes from _middleware.js.
// PTO details, allowances, and login management are only available to managers.
// D1 binding required: variable name DB (Pages project > Settings > Bindings).
import { createSession, sessionCookie, clearCookie, cookie, readCookie, pkce, newToken, decodeJwtPayload,
  loginSettings, initialManagers, STATE_COOKIE, STATE_MS } from "../../lib/auth.js";
import { sendMail, mailSettings, emailLayout } from "../../lib/mail.js";

const TYPES = ["Vacation", "Sick", "Called Out", "Personal", "Other"];
const EQUIPMENT = ["Scissor Lift", "Fork Lift", "Fork Lift Basket"];
const SL_LOCATIONS = ["Lester Glenn Mazda of Toms River", "Lester Glenn Hyundai of Toms River", "Lester Glenn Chevy of Toms River", "Lester Glenn GMC of Toms River", "Lester Glenn Subaru of Toms River", "Lester Glenn Collision of Toms River", "Lester Glenn Chrysler of Toms River", "Lester Glenn Honda of Sea Girt", "Lester Glenn Ford of Ocean", "Lester Glenn Chevy of Freehold", "Lester Glenn Chevy of Old Bridge", "Lester Glenn Corporate of Toms River", "Lester Glenn Warranty of Toms River", "Lester Glenn Service BDC of Toms River", "Lester Glenn Marketing", "Lester Glenn Used Car Dept", "Other location"];
const INV_CATEGORIES = ["Monitors", "Keyboards", "Mouse", "PCs", "Laptops", "Tablets", "iPad", "iPhone", "Printers", "IP Phones", "Conference Device", "Web Cams", "USB Headsets", "IP Phone Headsets", "Cables", "Networking", "Misc"];
const INV_LOCATIONS = ["Lester Glenn Mazda of Toms River", "Lester Glenn Hyundai of Toms River", "Lester Glenn Chevy of Toms River", "Lester Glenn GMC of Toms River", "Lester Glenn Subaru of Toms River", "Lester Glenn Collision of Toms River", "Lester Glenn Chrysler of Toms River", "Lester Glenn Honda of Sea Girt", "Lester Glenn Ford of Ocean", "Lester Glenn Chevy of Freehold", "Lester Glenn Chevy of Old Bridge", "Lester Glenn Corporate of Toms River", "Lester Glenn Warranty of Toms River", "Lester Glenn Service BDC of Toms River", "Lester Glenn Marketing", "Lester Glenn Used Car Dept", "Other location"];
const DEPARTMENTS = ["Finance", "Sales", "Sales BDC", "Service", "Service BDC", "Marketing", "IT Dept", "Corporate", "Warranty", "Shop", "Parts"];
const PROJECT_STATUS = ["Planned", "In progress", "On hold", "Done"];
const LOCATIONS = ["Lester Glenn Mazda of Toms River", "Lester Glenn Hyundai of Toms River", "Lester Glenn Chevy of Toms River", "Lester Glenn GMC of Toms River", "Lester Glenn Subaru of Toms River", "Lester Glenn Collision of Toms River", "Lester Glenn Chrysler of Toms River", "Lester Glenn Honda of Sea Girt", "Lester Glenn Ford of Ocean", "Lester Glenn Chevy of Freehold", "Lester Glenn Chevy of Old Bridge", "Lester Glenn Corporate of Toms River", "Lester Glenn Warranty of Toms River", "Lester Glenn Service BDC of Toms River", "Lester Glenn Marketing", "Lester Glenn Used Car Dept", "Remote"];
const PROJECT_LOCATIONS = [...LOCATIONS, "Other location"];
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ error: msg }, status);
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
const text = (v, max) => String(v ?? "").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const withCookie = (res, ...cookies) => { for (const c of cookies) res.headers.append("Set-Cookie", c); return res; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function htmlPage(status, title, body) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 20px;color:#14222e"><h1 style="font-size:1.4rem">${esc(title)}</h1><p>${body}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
const safeNext = n => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") && !n.startsWith("/api")) ? n : "/";

async function handleAuth(action, method, request, env, user, db, url) {
  if (action === "status" && method === "GET") {
    const ls = loginSettings(env);
    return json({ configured: ls.configured, missing: ls.missing, user: user ? { email: user.email, name: user.name, role: user.role } : null });
  }

  // Step 1: send the browser to Microsoft.
  if (action === "microsoft" && method === "GET") {
    const ls = loginSettings(env);
    if (!ls.configured) return htmlPage(500, "Microsoft sign-in isn't set up yet", `Add these settings to the Cloudflare Pages project, then retry the deployment: ${esc(ls.missing.join(", "))}.`);
    const state = newToken(), nonce = newToken(), { verifier, challenge } = await pkce();
    await db.prepare("INSERT INTO oauth_states (state, nonce, verifier, next, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(state, nonce, verifier, safeNext(url.searchParams.get("next")), Date.now()).run();
    const auth = new URL(`${ls.authority}/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/authorize`);
    auth.search = new URLSearchParams({
      client_id: env.MS_LOGIN_CLIENT_ID, response_type: "code", response_mode: "query",
      redirect_uri: `${url.origin}/api/auth/callback`, scope: "openid profile email",
      state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account",
    }).toString();
    return withCookie(new Response(null, { status: 302, headers: { Location: auth.toString(), "cache-control": "no-store" } }),
      cookie(request, STATE_COOKIE, state, STATE_MS / 1000));
  }

  // Step 2: Microsoft sends the browser back here with a one-time code.
  if (action === "callback" && method === "GET") {
    const again = `<a href="/login/">Try signing in again</a>.`;
    const fail = (title, msg) => withCookie(htmlPage(403, title, `${msg} ${again}`), clearCookie(request, STATE_COOKIE));
    if (url.searchParams.get("error")) return fail("Microsoft sign-in didn't finish", esc(url.searchParams.get("error_description") || url.searchParams.get("error")));
    const ls = loginSettings(env);
    const state = url.searchParams.get("state"), code = url.searchParams.get("code");
    if (!state || !code || readCookie(request, STATE_COOKIE) !== state) return fail("Sign-in expired", "This sign-in link was already used or came from a different browser.");
    const st = await db.prepare("SELECT * FROM oauth_states WHERE state = ?1").bind(state).first();
    await db.prepare("DELETE FROM oauth_states WHERE state = ?1").bind(state).run();
    if (!st || Date.now() - st.created_at > STATE_MS) return fail("Sign-in expired", "That took too long.");

    const tr = await fetch(`${ls.authority}/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.MS_LOGIN_CLIENT_ID, client_secret: env.MS_LOGIN_CLIENT_SECRET, grant_type: "authorization_code",
        code, redirect_uri: `${url.origin}/api/auth/callback`, code_verifier: st.verifier, scope: "openid profile email" }),
    });
    const tok = await tr.json().catch(() => ({}));
    if (!tr.ok || !tok.id_token) { console.error("Token exchange failed", tok.error, tok.error_description); return fail("Microsoft sign-in failed", esc(tok.error_description || tok.error || "No details.")); }

    // The ID token came straight from Microsoft's token endpoint over HTTPS in exchange for our
    // client secret, so we check its claims rather than its signature (OpenID Connect 3.1.3.7).
    let c;
    try { c = decodeJwtPayload(tok.id_token); } catch (_) { return fail("Microsoft sign-in failed", "The sign-in response couldn't be read."); }
    const tenant = String(env.MS_TENANT_ID).toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    if (c.aud !== env.MS_LOGIN_CLIENT_ID || String(c.tid).toLowerCase() !== tenant || c.nonce !== st.nonce || !(c.exp > now)
        || String(c.iss).toLowerCase() !== `https://login.microsoftonline.com/${tenant}/v2.0` && !env.MS_AUTHORITY) {
      return fail("Microsoft sign-in failed", "The sign-in response didn't match this organization.");
    }
    const email = String(c.email || c.preferred_username || "").toLowerCase();
    if (!EMAIL.test(email)) return fail("Microsoft sign-in failed", "Your Microsoft account didn't share an email address.");

    let acct = await db.prepare("SELECT * FROM accounts WHERE email = ?1").bind(email).first();
    if (!acct && initialManagers(env).includes(email)) {
      await db.prepare("INSERT INTO accounts (email, display_name, role, created_at) VALUES (?1, ?2, 'manager', ?3)").bind(email, c.name || email, Date.now()).run();
      acct = { email };
    }
    if (!acct) {
      return withCookie(htmlPage(403, "You don't have access yet",
        `You're signed in to Microsoft as <b>${esc(email)}</b>, but you haven't been added to the IT Schedule. Ask an IT manager to add you under Time Off → Logins.`),
        clearCookie(request, STATE_COOKIE));
    }
    await db.prepare("UPDATE accounts SET last_login = ?2, ms_oid = ?3, display_name = COALESCE(NULLIF(?4, ''), display_name) WHERE email = ?1")
      .bind(email, Date.now(), c.oid || null, c.name || "").run();
    const token = await createSession(db, email);
    return withCookie(new Response(null, { status: 302, headers: { Location: `${url.origin}${st.next}`, "cache-control": "no-store" } }),
      sessionCookie(token, request), clearCookie(request, STATE_COOKIE));
  }

  if (action === "logout" && method === "POST") {
    if (user) await db.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(user.tokenHash).run();
    return withCookie(json({ ok: true }), clearCookie(request));
  }
  return fail("Not found", 404);
}

async function handleUsers(rid, method, body, user, db) {
  if (!user.isManager) return fail("Only managers can manage logins", 403);
  const managers = async () => (await db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE role = 'manager'").first()).n;
  if (method === "GET") {
    const r = await db.prepare("SELECT email, display_name, role, last_login FROM accounts ORDER BY display_name").all();
    return json(r.results.map(u => ({ email: u.email, name: u.display_name, role: u.role, lastLogin: u.last_login })));
  }
  if (method === "POST") {
    const email = text(body.email, 120).toLowerCase(), name = text(body.name, 80), role = body.role === "manager" ? "manager" : "staff";
    if (!EMAIL.test(email)) return fail("Enter the person's Microsoft work email address.");
    if (!name) return fail("Enter the person's name.");
    if (await db.prepare("SELECT 1 FROM accounts WHERE email = ?1").bind(email).first()) return fail("That person already has access.", 409);
    await db.prepare("INSERT INTO accounts (email, display_name, role, created_at) VALUES (?1, ?2, ?3, ?4)").bind(email, name, role, Date.now()).run();
    return json({ ok: true });
  }
  let id = String(rid || "");
  try { id = decodeURIComponent(id).toLowerCase(); } catch (_) { return fail("Unknown login", 404); }
  const target = id ? await db.prepare("SELECT * FROM accounts WHERE email = ?1").bind(id).first() : null;
  if (!target) return fail("Unknown login", 404);
  if (method === "PUT") {
    const updates = [];
    if (body.name != null) { const n = text(body.name, 80); if (!n) return fail("Enter the person's name."); updates.push(db.prepare("UPDATE accounts SET display_name = ?2 WHERE email = ?1").bind(id, n)); }
    if (body.role != null) {
      const role = body.role === "manager" ? "manager" : "staff";
      if (target.role === "manager" && role !== "manager" && (await managers()) <= 1) return fail("There has to be at least one manager.");
      updates.push(db.prepare("UPDATE accounts SET role = ?2 WHERE email = ?1").bind(id, role));
    }
    if (updates.length) await db.batch(updates);
    return json({ ok: true });
  }
  if (method === "DELETE") {
    if (id === user.email) return fail("You can't remove your own access.");
    if (target.role === "manager" && (await managers()) <= 1) return fail("There has to be at least one manager.");
    await db.batch([db.prepare("DELETE FROM sessions WHERE username = ?1").bind(id), db.prepare("DELETE FROM accounts WHERE email = ?1").bind(id)]);
    return json({ ok: true });
  }
  return fail("Not found", 404);
}

// ---- 4-digit PINs that confirm who is adding or signing out inventory ----
const hex = u => [...u].map(b => b.toString(16).padStart(2, "0")).join("");
async function hashPin(pin, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 50000, hash: "SHA-256" }, key, 256);
  return { hash: hex(new Uint8Array(bits)), salt: hex(salt) };
}
function sameText(a, b) { let r = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return r === 0; }
// Returns an error message, or null when the PIN matches. Five wrong tries lock that person for 15 minutes.
async function verifyPerson(db, name, pin, allowViewers = false) {
  let table = "employees";
  let e = await db.prepare("SELECT id, pin_hash, pin_salt, pin_fails, pin_locked_until FROM employees WHERE name = ?1").bind(name).first();
  if (!e && allowViewers) { e = await db.prepare("SELECT id, pin_hash, pin_salt, pin_fails, pin_locked_until FROM pto_viewers WHERE name = ?1").bind(name).first(); table = "pto_viewers"; }
  if (!e) return "Choose a name from the team list.";
  if (!e.pin_hash) return `${name} doesn't have a PIN yet. A manager can set one by editing them on the Schedule page.`;
  const now = Date.now();
  if ((e.pin_locked_until || 0) > now) return `Too many wrong PINs for ${name}. Try again in ${Math.ceil((e.pin_locked_until - now) / 60000)} minutes.`;
  if (!/^\d{4}$/.test(String(pin || ""))) return `Enter ${name}'s 4-digit PIN.`;
  const { hash } = await hashPin(String(pin), e.pin_salt);
  if (!sameText(hash, e.pin_hash)) {
    const fails = (e.pin_fails || 0) + 1;
    await db.prepare(`UPDATE ${table} SET pin_fails = ?2, pin_locked_until = ?3 WHERE id = ?1`).bind(e.id, fails >= 5 ? 0 : fails, fails >= 5 ? now + 15 * 60000 : 0).run();
    return `That PIN isn't right for ${name}.`;
  }
  if (e.pin_fails) await db.prepare(`UPDATE ${table} SET pin_fails = 0 WHERE id = ?1`).bind(e.id).run();
  return null;
}

// Projects reserve inventory: stock is deducted when a project is saved, given back when an item
// is removed or the project is deleted, and kept as "used" once the project is completed.
async function applyReservations(db, oldItems, newItems, done, user) {
  const prev = new Map((oldItems || []).map(x => [x.itemId, x])), out = [], now = new Date().toISOString();
  for (const x of newItems) {
    const o = prev.get(x.itemId); prev.delete(x.itemId);
    const pr = o ? Number(o.reserved || 0) : 0;
    if (o && o.used) { out.push({ itemId: x.itemId, name: o.name || x.name, qty: x.qty, reserved: pr, used: true }); continue; }
    const it = await db.prepare("SELECT name, qty FROM inventory WHERE id = ?1").bind(x.itemId).first();
    if (!it) { out.push({ itemId: x.itemId, name: x.name, qty: x.qty, reserved: pr, used: !!done }); continue; }
    const r = Math.max(0, Math.min(x.qty, it.qty + pr)), d = r - pr;
    if (d) await db.prepare("UPDATE inventory SET qty = MAX(0, qty - ?2), updated_at = ?3, updated_by = ?4 WHERE id = ?1").bind(x.itemId, d, now, user.name).run();
    out.push({ itemId: x.itemId, name: it.name, qty: x.qty, reserved: r, used: !!done });
  }
  for (const o of prev.values())
    if (!o.used && Number(o.reserved)) await db.prepare("UPDATE inventory SET qty = qty + ?2, updated_at = ?3, updated_by = ?4 WHERE id = ?1").bind(o.itemId, Number(o.reserved), now, user.name).run();
  return out;
}

function cleanSchedule(s) {
  if (!s || typeof s !== "object") return null;
  const out = {};
  for (const k of DAYS) {
    const v = s[k];
    out[k] = v && TIME.test(v.start) && TIME.test(v.end) && v.start !== v.end ? { start: v.start, end: v.end } : null;
  }
  return out;
}
async function employeeExists(db, id) {
  return !!(await db.prepare("SELECT 1 FROM employees WHERE id = ?1").bind(id).first());
}

function fmtDay(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
// Builds and sends the "time off logged" email. Runs after the save, so a mail problem never blocks logging time off.
async function notifyPto(env, db, origin, user, entry) {
  if (!mailSettings(env).configured) return;
  try {
    const emp = await db.prepare("SELECT name FROM employees WHERE id = ?1").bind(entry.employeeId).first();
    const year = entry.start.slice(0, 4);
    const allow = await db.prepare("SELECT allowance FROM allowances WHERE employee_id = ?1").bind(entry.employeeId).first();
    const used = await db.prepare("SELECT COALESCE(SUM(days), 0) AS d FROM pto WHERE employee_id = ?1 AND substr(start_date, 1, 4) = ?2").bind(entry.employeeId, year).first();
    const others = await db.prepare(`SELECT DISTINCT e.name FROM pto p JOIN employees e ON e.id = p.employee_id
      WHERE p.employee_id != ?1 AND p.start_date <= ?3 AND p.end_date >= ?2 ORDER BY e.name`).bind(entry.employeeId, entry.start, entry.end).all();
    const dates = entry.start === entry.end ? fmtDay(entry.start) : `${fmtDay(entry.start)} – ${fmtDay(entry.end)}`;
    const remaining = allow ? `${Math.round((allow.allowance - used.d) * 10) / 10} of ${allow.allowance} days left in ${year}` : "";
    const name = emp ? emp.name : "A team member";
    await sendMail(env, {
      subject: `Time off logged: ${name}, ${entry.type}, ${dates}`,
      html: emailLayout(`${name}: ${entry.type}`, [
        ["Dates", dates],
        ["Days charged", String(entry.days)],
        ["Note", entry.note],
        ["Balance", remaining],
        ["Also out then", others.results.map(r => r.name).join(", ")],
        ["Logged by", user.name],
      ], `${origin}/timeoff/`),
    });
  } catch (err) {
    console.error("Time off email failed:", err.message);
  }
}

export async function onRequest({ request, env, data, params, waitUntil }) {
  const user = data.user;
  const db = env.DB;
  if (!db) return fail("The database isn't connected yet (add the D1 binding named DB).", 500);
  const url = new URL(request.url);
  const [resource, rid, sub] = params.path || [];
  const method = request.method;
  let body = null;
  if (method === "POST" || method === "PUT") {
    body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") { if (resource === "auth") body = {}; else return fail("Invalid request body"); }
  }

  try {
    if (resource === "auth") return await handleAuth(rid, method, request, env, user, db, url);
    if (!user) return fail("Not signed in", 401);
    if (resource === "users") return await handleUsers(rid, method, body || {}, user, db);

    // ---- Email notifications (managers) ----
    if (resource === "notify") {
      if (!user.isManager) return fail("Only managers can do that", 403);
      if (rid === "test" && method === "POST") {
        try {
          await sendMail(env, { subject: "Test: IT Master Tool time off emails are working",
            html: emailLayout("Time off emails are working", [["Sent by", user.name], ["What happens next", "Managers on this list get an email each time time off is logged."]], `${url.origin}/timeoff/`) });
          return json({ ok: true, to: mailSettings(env).to });
        } catch (err) { return fail(err.message, 502); }
      }
    }

    // ---- Everything the page needs in one call ----
    if (resource === "state" && method === "GET") {
      const [emps, shifts, remote, pto, locs, projects, equip, inv, orders, signouts] = await db.batch([
        db.prepare("SELECT * FROM employees ORDER BY name"),
        db.prepare("SELECT * FROM shifts"),
        db.prepare("SELECT * FROM remote"),
        db.prepare("SELECT * FROM pto"),
        db.prepare("SELECT * FROM day_locations"),
        db.prepare("SELECT * FROM projects ORDER BY start_date"),
        db.prepare("SELECT * FROM equipment_status"),
        db.prepare("SELECT id, name, category, location, qty, min_qty, tag, notes, cost, updated_at, (image IS NOT NULL AND image != '') AS has_image FROM inventory ORDER BY name"),
        db.prepare("SELECT * FROM orders ORDER BY order_date DESC"),
        db.prepare("SELECT * FROM inventory_signouts ORDER BY at DESC LIMIT 300"),
      ]);
      const out = {
        me: { email: user.email, name: user.name, role: user.role, isManager: user.isManager },
        links: { schedule: "/", timeoff: "/timeoff/" },
        employees: emps.results.map(e => ({ id: e.id, name: e.name, role: e.role || "", location: e.location || "", hasPin: !!e.pin_hash, schedule: e.schedule ? JSON.parse(e.schedule) : null })),
        projects: projects.results.map(p => ({ id: p.id, name: p.name, start: p.start_date, end: p.end_date, status: p.status, location: p.location || "", notes: p.notes || "",
          people: p.people ? JSON.parse(p.people) : [], updates: p.updates ? JSON.parse(p.updates) : [], supplies: p.supplies ? JSON.parse(p.supplies) : [], equipment: p.equipment ? JSON.parse(p.equipment) : [], department: p.department || "", inventoryItems: p.inventory_items ? JSON.parse(p.inventory_items) : [], completedAt: p.completed_at || null, completedBy: p.completed_by || null, createdAt: p.created_at })),
        inventory: inv.results.map(x => ({ id: x.id, name: x.name, category: x.category || "", location: x.location || "", qty: x.qty, min: x.min_qty, tag: x.tag || "", notes: x.notes || "",
          cost: x.cost, image: x.has_image ? `/api/inventory/${encodeURIComponent(x.id)}/image?v=${encodeURIComponent(x.updated_at || "")}` : "" })),
        orders: orders.results.map(o => ({ id: o.id, itemId: o.item_id, itemName: o.item_name, qty: o.qty, cost: o.cost, vendor: o.vendor || "", status: o.status,
          orderDate: o.order_date, eta: o.eta || "", orderNumber: o.order_number || "", notes: o.notes || "", receivedAt: o.received_at, receivedBy: o.received_by || "" })),
        // (empty until migrations/019-time-off-viewers.sql has been run)
        viewers: await db.prepare("SELECT id, name, (pin_hash IS NOT NULL) AS has_pin FROM pto_viewers ORDER BY name").all()
          .then(r => r.results.map(v => ({ id: v.id, name: v.name, hasPin: !!v.has_pin }))).catch(() => []),
        monthRequests: await db.prepare("SELECT * FROM month_requests WHERE month >= ?1 ORDER BY date").bind(new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 7)).all()
          .then(r => r.results.map(x => ({ id: x.id, month: x.month, employeeId: x.employee_id, name: x.name, kind: x.kind, date: x.date, status: x.status, createdAt: x.created_at, reviewedBy: x.reviewed_by || "", covering: x.covering || "", saturday: x.saturday || "" }))).catch(() => []),
        signouts: signouts.results.map(x => ({ id: x.id, kind: x.kind || "out", source: x.source || "", department: x.department || "", unitCost: x.unit_cost, itemId: x.item_id, itemName: x.item_name, category: x.category || "", qty: x.qty, by: x.signed_out_by || "",
          toLocation: x.to_location || "", projectId: x.project_id || "", projectName: x.project_name || "", notes: x.notes || "", fromLocation: x.from_location || "", at: x.at, recordedBy: x.recorded_by || "" })),
        equipmentStatus: Object.fromEntries(equip.results.map(e => [e.name, { location: e.location || "", updatedAt: e.updated_at, updatedBy: e.updated_by || "" }])),
        dayLocations: locs.results.map(l => ({ employeeId: l.employee_id, date: l.date, location: l.location })),
        shifts: shifts.results.map(s => ({ employeeId: s.employee_id, date: s.date, start: s.start_time, end: s.end_time, off: !!s.off, note: s.note || "" })),
        remote: remote.results.map(r => ({ id: r.id, employeeId: r.employee_id, start: r.start_date, end: r.end_date, calledOut: !!r.called_out, note: r.note || "" })),
        // Everyone sees only that a person is out, never the type or note.
        away: pto.results.map(p => ({ id: p.id, employeeId: p.employee_id, start: p.start_date, end: p.end_date, partial: p.start_date === p.end_date && p.days < 1 })),
      };
      if (user.isManager) {
        out.pto = pto.results.map(p => ({ id: p.id, employeeId: p.employee_id, type: p.type, start: p.start_date, end: p.end_date, days: p.days, note: p.note || "" }));
        const a = await db.prepare("SELECT * FROM allowances").all();
        out.allowances = Object.fromEntries(a.results.map(x => [x.employee_id, x.allowance]));
        const m = mailSettings(env);
        out.notify = { configured: m.configured, to: m.to, from: m.from, missing: m.missing };
      }
      return json(out);
    }

    // ---- Team members ----
    if (resource === "employees") {
      if (method === "POST") {
        const name = text(body.name, 80);
        if (!name) return fail("Name is required");
        const id = body.id ? text(body.id, 40) : newId();
        const schedule = cleanSchedule(body.schedule);
        // location is only changed when it's sent ("" clears it).
        const location = body.location === undefined ? null : (LOCATIONS.includes(body.location) ? body.location : "");
        await db.prepare(`INSERT INTO employees (id, name, role, schedule, created_at, location) VALUES (?1, ?2, ?3, ?4, ?5, COALESCE(?6, ''))
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, schedule = excluded.schedule,
            location = CASE WHEN ?6 IS NULL THEN employees.location ELSE ?6 END`)
          .bind(id, name, text(body.role, 80), schedule ? JSON.stringify(schedule) : null, new Date().toISOString(), location).run();
        if (body.pin) {
          if (!user.isManager) return fail("Only managers can set PINs", 403);
          if (!/^\d{4}$/.test(String(body.pin))) return fail("The PIN must be exactly 4 digits.");
          const h = await hashPin(String(body.pin));
          await db.prepare("UPDATE employees SET pin_hash = ?2, pin_salt = ?3, pin_fails = 0, pin_locked_until = 0 WHERE id = ?1").bind(id, h.hash, h.salt).run();
        }
        if (user.isManager && body.allowance != null) {
          const allowance = Number(body.allowance);
          if (!(allowance >= 0 && allowance <= 365)) return fail("Allowance must be between 0 and 365 days");
          await db.prepare("INSERT INTO allowances (employee_id, allowance) VALUES (?1, ?2) ON CONFLICT(employee_id) DO UPDATE SET allowance = excluded.allowance").bind(id, allowance).run();
        }
        return json({ id });
      }
      if (method === "DELETE" && rid) {
        if (!user.isManager) return fail("Only managers can remove team members", 403);
        await db.batch([
          db.prepare("DELETE FROM pto WHERE employee_id = ?1").bind(rid),
          db.prepare("DELETE FROM allowances WHERE employee_id = ?1").bind(rid),
          db.prepare("DELETE FROM shifts WHERE employee_id = ?1").bind(rid),
          db.prepare("DELETE FROM remote WHERE employee_id = ?1").bind(rid),
          db.prepare("DELETE FROM day_locations WHERE employee_id = ?1").bind(rid),
          db.prepare("DELETE FROM employees WHERE id = ?1").bind(rid),
        ]);
        return json({ ok: true });
      }
    }

    // ---- One-day schedule changes ----
    if (resource === "shifts") {
      if (method === "PUT") {
        const { employeeId, date } = body;
        if (!DATE.test(date || "") || !(await employeeExists(db, employeeId))) return fail("Unknown team member or date");
        const off = !!body.off;
        if (!off && (!TIME.test(body.start || "") || !TIME.test(body.end || "") || body.start === body.end)) return fail("Enter a valid start and end time");
        await db.prepare(`INSERT INTO shifts (employee_id, date, start_time, end_time, off, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT(employee_id, date) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time, off = excluded.off, note = excluded.note`)
          .bind(employeeId, date, off ? null : body.start, off ? null : body.end, off ? 1 : 0, text(body.note, 120)).run();
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM shifts WHERE employee_id = ?1 AND date = ?2").bind(url.searchParams.get("employeeId"), url.searchParams.get("date")).run();
        return json({ ok: true });
      }
    }

    // ---- Inventory On Order ----
    if (resource === "orders") {
      if (rid && sub === "receive" && method === "POST") {
        const o = await db.prepare("SELECT * FROM orders WHERE id = ?1").bind(rid).first();
        if (!o) return fail("Unknown order", 404);
        if (!["Ordered", "Shipped"].includes(o.status)) return fail("This order isn't open.");
        const now = new Date().toISOString(), steps = [];
        if (o.item_id) {
          const item = await db.prepare("SELECT name, category, location FROM inventory WHERE id = ?1").bind(o.item_id).first();
          steps.push(db.prepare("UPDATE inventory SET qty = qty + ?2, updated_at = ?3, updated_by = ?4 WHERE id = ?1").bind(o.item_id, o.qty, now, user.name));
          if (item) steps.push(db.prepare(`INSERT INTO inventory_signouts (id, kind, source, item_id, item_name, category, qty, signed_out_by, to_location, project_id, project_name, notes, from_location, at, recorded_by)
            VALUES (?1, 'in', ?2, ?3, ?4, ?5, ?6, ?7, ?8, '', '', 'Order received', '', ?9, ?7)`)
            .bind(newId(), (o.vendor || "Vendor") + (o.order_number ? ` (order ${o.order_number})` : ""), o.item_id, item.name, item.category || "", o.qty, user.name, item.location || "", now));
        }
        steps.push(db.prepare("UPDATE orders SET status = 'Received', received_at = ?2, received_by = ?3 WHERE id = ?1").bind(rid, now, user.name));
        await db.batch(steps);
        return json({ ok: true });
      }
      if (sub) return fail("Not found", 404);
      if (method === "POST" || method === "PUT") {
        const itemName = text(body.itemName, 120);
        const itemId = body.itemId ? text(body.itemId, 40) : null;
        if (itemId && !(await db.prepare("SELECT 1 FROM inventory WHERE id = ?1").bind(itemId).first())) return fail("That inventory item no longer exists.");
        if (!itemName) return fail("Choose an inventory item or enter an item name.");
        const qty = Math.round(Number(body.qty));
        if (!(qty >= 1 && qty <= 99999)) return fail("Quantity ordered must be at least 1.");
        const cost = body.cost === null || body.cost === undefined || body.cost === "" ? null : Math.round(Number(body.cost) * 100) / 100;
        if (cost !== null && !(cost >= 0 && cost <= 1000000)) return fail("Cost must be 0 or more.");
        if (!DATE.test(body.orderDate || "")) return fail("Enter the order date.");
        const eta = body.eta ? (DATE.test(body.eta) ? body.eta : null) : "";
        if (eta === null) return fail("Check the expected delivery date.");
        // "Received" is only set through the receive step, so inventory counts stay right.
        const status = ["Ordered", "Shipped", "Cancelled"].includes(body.status) ? body.status : "Ordered";
        const vals = [itemId, itemName, qty, cost, text(body.vendor, 80), status, body.orderDate, eta, text(body.orderNumber, 120), text(body.notes, 500)];
        if (method === "POST") {
          const id = newId();
          await db.prepare("INSERT INTO orders (id, item_id, item_name, qty, cost, vendor, status, order_date, eta, order_number, notes, created_at, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)")
            .bind(id, ...vals, new Date().toISOString(), user.name).run();
          return json({ id });
        }
        if (!rid) return fail("Unknown order", 404);
        const cur = await db.prepare("SELECT status FROM orders WHERE id = ?1").bind(rid).first();
        if (!cur) return fail("Unknown order", 404);
        const keepStatus = cur.status === "Received" ? "Received" : status;
        await db.prepare("UPDATE orders SET item_id = ?2, item_name = ?3, qty = ?4, cost = ?5, vendor = ?6, status = ?7, order_date = ?8, eta = ?9, order_number = ?10, notes = ?11 WHERE id = ?1")
          .bind(rid, vals[0], vals[1], vals[2], vals[3], vals[4], keepStatus, vals[6], vals[7], vals[8], vals[9]).run();
        return json({ ok: true });
      }
      if (method === "DELETE" && rid) {
        await db.prepare("DELETE FROM orders WHERE id = ?1").bind(rid).run();
        return json({ ok: true });
      }
    }

    // ---- Inventory ----
    if (resource === "inventory") {
      // Item photo (kept out of the main data so pages load quickly)
      if (rid && sub === "image" && method === "GET") {
        const row = await db.prepare("SELECT image FROM inventory WHERE id = ?1").bind(rid).first();
        const m = row && row.image && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(row.image);
        if (!m) return fail("No image", 404);
        const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
        return new Response(bytes, { headers: { "content-type": m[1], "cache-control": "private, max-age=86400" } });
      }
      // Sign Out Inventory: take items out of stock and log who took them
      if (rid && sub === "signout" && method === "POST") {
        const qty = Math.round(Number(body.qty));
        if (!(qty >= 1 && qty <= 99999)) return fail("Quantity must be at least 1.");
        const by = text(body.by, 80);
        if (!by) return fail("Choose who is signing it out.");
        { const pe = await verifyPerson(db, by, body.pin); if (pe) return fail(pe, 403); }
        if (!DEPARTMENTS.includes(body.department)) return fail("Choose the department it's going to.");
        const item = await db.prepare("SELECT * FROM inventory WHERE id = ?1").bind(rid).first();
        if (!item) return fail("Unknown item", 404);
        const now = new Date().toISOString();
        const r = await db.prepare("UPDATE inventory SET qty = qty - ?2, updated_at = ?3, updated_by = ?4 WHERE id = ?1 AND qty >= ?2").bind(rid, qty, now, user.name).run();
        if (!r.meta.changes) return fail(`Only ${item.qty} on hand.`, 409);
        const proj = body.projectId ? await db.prepare("SELECT id, name FROM projects WHERE id = ?1").bind(text(body.projectId, 40)).first() : null;
        const to = [...INV_LOCATIONS, "Remote"].includes(body.toLocation) ? body.toLocation : "";
        const dept = DEPARTMENTS.includes(body.department) ? body.department : "";
        await db.prepare(`INSERT INTO inventory_signouts (id, item_id, item_name, category, qty, signed_out_by, to_location, project_id, project_name, notes, from_location, at, recorded_by, department, unit_cost)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`)
          .bind(newId(), rid, item.name, item.category || "", qty, by, to, proj ? proj.id : "", proj ? proj.name : "", text(body.notes, 200), item.location || "", now, user.name, dept, item.cost).run();
        return json({ ok: true, left: item.qty - qty });
      }
      // Add Inventory > More of an existing item: raise the count and log it
      if (rid && sub === "receive" && method === "POST") {
        const qty = Math.round(Number(body.qty));
        if (!(qty >= 1 && qty <= 99999)) return fail("Quantity received must be at least 1.");
        const by = text(body.by, 80);
        if (!by) return fail("Choose who is adding this stock.");
        { const pe = await verifyPerson(db, by, body.pin); if (pe) return fail(pe, 403); }
        const cost = body.cost === null || body.cost === undefined || body.cost === "" ? null : Math.round(Number(body.cost) * 100) / 100;
        if (cost !== null && !(cost >= 0 && cost <= 1000000)) return fail("Item Cost must be 0 or more.");
        const item = await db.prepare("SELECT * FROM inventory WHERE id = ?1").bind(rid).first();
        if (!item) return fail("Unknown item", 404);
        const now = new Date().toISOString();
        await db.batch([
          db.prepare("UPDATE inventory SET qty = qty + ?2, cost = COALESCE(?3, cost), updated_at = ?4, updated_by = ?5 WHERE id = ?1").bind(rid, qty, cost, now, user.name),
          db.prepare(`INSERT INTO inventory_signouts (id, kind, source, item_id, item_name, category, qty, signed_out_by, to_location, project_id, project_name, notes, from_location, at, recorded_by)
            VALUES (?1, 'in', 'Added to stock by hand', ?2, ?3, ?4, ?5, ?6, ?7, '', '', ?8, ?7, ?9, ?10)`).bind(newId(), rid, item.name, item.category || "", qty, by, item.location || "", text(body.notes, 200), now, user.name),
        ]);
        return json({ ok: true, qty: item.qty + qty });
      }
      if (rid && sub === "adjust" && method === "POST") {
        const delta = Math.round(Number(body.delta));
        if (!delta || Math.abs(delta) > 9999) return fail("Invalid amount");
        const r = await db.prepare("UPDATE inventory SET qty = MAX(0, qty + ?2), updated_at = ?3, updated_by = ?4 WHERE id = ?1").bind(rid, delta, new Date().toISOString(), user.name).run();
        return r.meta.changes ? json({ ok: true }) : fail("Unknown item", 404);
      }
      if (sub) return fail("Not found", 404);
      if (method === "POST" || method === "PUT") {
        const name = text(body.name, 120);
        if (!name) return fail("Enter the item name.");
        const qty = Math.round(Number(body.qty));
        if (!(qty >= 0 && qty <= 99999)) return fail("Quantity must be 0 or more.");
        const min = body.min === null || body.min === undefined || body.min === "" ? null : Math.min(99999, Math.max(0, Math.round(Number(body.min)) || 0));
        const category = INV_CATEGORIES.includes(body.category) ? body.category : "Misc";
        const location = INV_LOCATIONS.includes(body.location) ? body.location : "";
        const cost = body.cost === null || body.cost === undefined || body.cost === "" ? null : Math.round(Number(body.cost) * 100) / 100;
        if (cost !== null && !(cost >= 0 && cost <= 1000000)) return fail("Item Cost must be 0 or more.");
        // image: undefined = keep, "" = remove, data URL = replace (resized in the browser)
        let image = body.image;
        if (image !== undefined && image !== "") {
          if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) return fail("That image couldn't be saved. Try a JPG or PNG.");
          if (image.length > 600000) return fail("That image is too large.");
        }
        const vals = [name, category, location, qty, min, text(body.tag, 120), text(body.notes, 500), new Date().toISOString(), user.name, cost];
        if (method === "POST") {
          const addedBy = text(body.addedBy, 80);
          if (!addedBy) return fail("Choose who is adding this item.");
          { const pe = await verifyPerson(db, addedBy, body.pin); if (pe) return fail(pe, 403); }
          const id = newId(), steps = [db.prepare("INSERT INTO inventory (id, name, category, location, qty, min_qty, tag, notes, updated_at, updated_by, cost, image) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)").bind(id, ...vals, image || null)];
          if (qty > 0) steps.push(db.prepare(`INSERT INTO inventory_signouts (id, kind, source, item_id, item_name, category, qty, signed_out_by, to_location, project_id, project_name, notes, from_location, at, recorded_by, unit_cost)
            VALUES (?1, 'in', 'New item added', ?2, ?3, ?4, ?5, ?6, ?7, '', '', '', '', ?8, ?9, ?10)`).bind(newId(), id, name, category, qty, addedBy, location, vals[7], user.name, cost));
          await db.batch(steps);
          return json({ id });
        }
        if (!rid) return fail("Unknown item", 404);
        const r = await db.prepare(`UPDATE inventory SET name = ?2, category = ?3, location = ?4, qty = ?5, min_qty = ?6, tag = ?7, notes = ?8, updated_at = ?9, updated_by = ?10, cost = ?11,
            image = CASE WHEN ?12 = 'keep' THEN image WHEN ?12 = '' THEN NULL ELSE ?12 END WHERE id = ?1`).bind(rid, ...vals, image === undefined ? "keep" : image).run();
        return r.meta.changes ? json({ ok: true }) : fail("Unknown item", 404);
      }
      if (method === "DELETE" && rid) {
        await db.prepare("DELETE FROM inventory WHERE id = ?1").bind(rid).run();
        return json({ ok: true });
      }
    }

    // ---- Where is the scissor lift right now ----
    if (resource === "equipment" && rid === "scissor-lift" && method === "PUT") {
      const location = body.location ? (SL_LOCATIONS.includes(body.location) ? body.location : null) : "";
      if (location === null) return fail("Unknown location");
      await db.prepare(`INSERT INTO equipment_status (name, location, updated_at, updated_by) VALUES ('scissor-lift', ?1, ?2, ?3)
        ON CONFLICT(name) DO UPDATE SET location = excluded.location, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
        .bind(location, new Date().toISOString(), user.name).run();
      return json({ ok: true });
    }

    // ---- Time off PIN: team members see only their own time off; leads see everyone's ----
    if (resource === "timeoff" && rid === "unlock" && method === "POST") {
      const name = text(body.name, 80);
      const pe = await verifyPerson(db, name, body.pin, true); if (pe) return fail(pe, 403);
      let emp = await db.prepare("SELECT id, name, role FROM employees WHERE name = ?1").bind(name).first(), all;
      if (emp) all = /manager|cto|director|chief|vp/i.test(emp.role || "");
      else { emp = await db.prepare("SELECT id, name FROM pto_viewers WHERE name = ?1").bind(name).first(); all = true; } // Time off viewers see everyone
      const pto = all ? await db.prepare("SELECT * FROM pto").all() : await db.prepare("SELECT * FROM pto WHERE employee_id = ?1").bind(emp.id).all();
      const al = all ? await db.prepare("SELECT * FROM allowances").all() : await db.prepare("SELECT * FROM allowances WHERE employee_id = ?1").bind(emp.id).all();
      return json({
        viewer: { id: emp.id, name: emp.name, all },
        pto: pto.results.map(p => ({ id: p.id, employeeId: p.employee_id, type: p.type, start: p.start_date, end: p.end_date, days: p.days, note: p.note || "" })),
        allowances: Object.fromEntries(al.results.map(x => [x.employee_id, x.allowance])),
      });
    }

    // ---- New Month Schedule: weekend-off and day-off requests ----
    if (resource === "month-requests") {
      const leadCheck = async () => {
        const name = text(body.manager, 80), pe = await verifyPerson(db, name, body.pin, true);
        if (pe) return pe;
        const emp = await db.prepare("SELECT role FROM employees WHERE name = ?1").bind(name).first();
        if (emp && !/manager|cto|director|chief|vp/i.test(emp.role || "")) return "Only managers can review requests.";
        return null;
      };
      if (rid === "verify" && method === "POST") { const pe = await leadCheck(); return pe ? fail(pe, 403) : json({ ok: true }); }
      if (method === "POST") {
        const emp = await db.prepare("SELECT id, name FROM employees WHERE id = ?1").bind(text(body.employeeId, 40)).first();
        if (!emp) return fail("Choose your name from the list.");
        const kind = body.kind === "weekend" ? "weekend" : "day";
        if (!DATE.test(body.date || "") || !/^\d{4}-\d{2}$/.test(body.month || "")) return fail("Check the date.");
        const dup = await db.prepare("SELECT 1 FROM month_requests WHERE employee_id = ?1 AND kind = ?2 AND date = ?3").bind(emp.id, kind, body.date).first();
        if (dup) return fail("You already asked for that.");
        const id = newId();
        const covering = kind === "day" ? (body.covering === "yes" ? "yes" : body.covering === "no" ? "no" : null) : null;
        if (kind === "day" && !covering) return fail("Say whether you're covering the Saturday that week.");
        const saturday = kind === "day" && DATE.test(body.saturday || "") ? body.saturday : null;
        await db.prepare("INSERT INTO month_requests (id, month, employee_id, name, kind, date, status, created_at, created_by, covering, saturday) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'new', ?7, ?8, ?9, ?10)")
          .bind(id, body.month, emp.id, emp.name, kind, body.date, new Date().toISOString(), user.name, covering, saturday).run();
        return json({ id });
      }
      if (method === "DELETE" && rid) {
        const r = await db.prepare("SELECT status FROM month_requests WHERE id = ?1").bind(rid).first();
        if (!r) return fail("Unknown request", 404);
        if (r.status !== "new") return fail("That request was already reviewed. Ask Chris Wolf to change it.");
        await db.prepare("DELETE FROM month_requests WHERE id = ?1").bind(rid).run();
        return json({ ok: true });
      }
      if (method === "PUT" && rid) {
        const pe = await leadCheck(); if (pe) return fail(pe, 403);
        const status = ["seen", "approved", "denied"].includes(body.status) ? body.status : null;
        if (!status) return fail("Unknown status");
        await db.prepare("UPDATE month_requests SET status = ?2, reviewed_by = ?3, reviewed_at = ?4 WHERE id = ?1").bind(rid, status, text(body.manager, 80), new Date().toISOString()).run();
        return json({ ok: true });
      }
    }

    // ---- Projects calendar ----
    if (resource === "projects") {
      // Completed project button
      if (rid && sub === "complete" && method === "POST") {
        const row = await db.prepare("SELECT inventory_items FROM projects WHERE id = ?1").bind(rid).first();
        if (!row) return fail("Unknown project", 404);
        const items = (row.inventory_items ? JSON.parse(row.inventory_items) : []).map(x => ({ ...x, used: true }));
        await db.prepare("UPDATE projects SET status = 'Done', completed_at = ?2, completed_by = ?3, inventory_items = ?4 WHERE id = ?1").bind(rid, new Date().toISOString(), user.name, JSON.stringify(items)).run();
        return json({ ok: true });
      }
      // Ongoing project button: notes on where they left off and what's left
      if (rid && sub === "progress" && method === "POST") {
        const leftOff = text(body.leftOff, 1000), todo = text(body.todo, 1000);
        if (!leftOff) return fail("Describe where you left off.");
        if (!todo) return fail("List what still needs to be completed.");
        const row = await db.prepare("SELECT updates FROM projects WHERE id = ?1").bind(rid).first();
        if (!row) return fail("Unknown project", 404);
        const updates = row.updates ? JSON.parse(row.updates) : [];
        updates.push({ at: new Date().toISOString(), by: user.name, leftOff, todo });
        await db.prepare("UPDATE projects SET updates = ?2, status = 'In progress', completed_at = NULL, completed_by = NULL WHERE id = ?1")
          .bind(rid, JSON.stringify(updates.slice(-200))).run();
        return json({ ok: true });
      }
      if (sub) return fail("Not found", 404);
      if (method === "POST" || method === "PUT") {
        const name = text(body.name, 100), start = body.start, end = body.end;
        if (!name) return fail("Give the project a name.");
        if (!DATE.test(start || "") || !DATE.test(end || "") || end < start) return fail("The end date must be on or after the start date.");
        const status = PROJECT_STATUS.includes(body.status) ? body.status : "Planned";
        const location = PROJECT_LOCATIONS.includes(body.location) ? body.location : "";
        const department = DEPARTMENTS.includes(body.department) ? body.department : "";
        const people = Array.isArray(body.people) ? body.people.map(x => text(x, 40)).filter(Boolean).slice(0, 50) : [];
        const supplies = Array.isArray(body.supplies) ? body.supplies.slice(0, 100).map(x => ({
          item: text(x && x.item, 120), qty: Math.min(9999, Math.max(1, Math.round(Number(x && x.qty) || 1))), got: !!(x && x.got) })).filter(x => x.item) : [];
        const equipment = Array.isArray(body.equipment) ? EQUIPMENT.filter(e => body.equipment.includes(e)) : [];
        const inventoryItems = Array.isArray(body.inventoryItems) ? body.inventoryItems.slice(0, 50).map(x => ({
          itemId: text(x && x.itemId, 40), name: text(x && x.name, 120), qty: Math.min(99999, Math.max(1, Math.round(Number(x && x.qty) || 1))) })).filter(x => x.itemId) : [];
        if (method === "POST") {
          const id = newId();
          const reserved = await applyReservations(db, [], inventoryItems, status === "Done", user);
          await db.prepare("INSERT INTO projects (id, name, start_date, end_date, status, location, notes, people, created_at, supplies, equipment, inventory_items, department) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)")
            .bind(id, name, start, end, status, location, text(body.notes, 1000), JSON.stringify(people), new Date().toISOString(), JSON.stringify(supplies), JSON.stringify(equipment), JSON.stringify(reserved), department).run();
          return json({ id });
        }
        if (!rid) return fail("Unknown project", 404);
        const before = await db.prepare("SELECT inventory_items, supplies FROM projects WHERE id = ?1").bind(rid).first();
        if (!before) return fail("Unknown project", 404);
        const reserved = await applyReservations(db, before.inventory_items ? JSON.parse(before.inventory_items) : [], inventoryItems, status === "Done", user);
        const r = await db.prepare(`UPDATE projects SET name = ?2, start_date = ?3, end_date = ?4, status = ?5, location = ?6, notes = ?7, people = ?8, supplies = ?11, equipment = ?12, inventory_items = ?13, department = ?14,
            completed_at = CASE WHEN ?5 = 'Done' THEN COALESCE(completed_at, ?9) ELSE NULL END,
            completed_by = CASE WHEN ?5 = 'Done' THEN COALESCE(completed_by, ?10) ELSE NULL END WHERE id = ?1`)
          .bind(rid, name, start, end, status, location, text(body.notes, 1000), JSON.stringify(people), new Date().toISOString(), user.name, JSON.stringify(supplies), JSON.stringify(equipment), JSON.stringify(reserved), department).run();
        if (!r.meta.changes) return fail("Unknown project", 404);
        return json({ ok: true });
      }
      if (method === "DELETE" && rid) {
        const row = await db.prepare("SELECT inventory_items FROM projects WHERE id = ?1").bind(rid).first();
        if (row) await applyReservations(db, row.inventory_items ? JSON.parse(row.inventory_items) : [], [], false, user);
        await db.prepare("DELETE FROM projects WHERE id = ?1").bind(rid).run();
        return json({ ok: true });
      }
    }

    // ---- Starting location for a single day ----
    if (resource === "locations" && method === "PUT") {
      const { employeeId, date } = body;
      if (!DATE.test(date || "") || !(await employeeExists(db, employeeId))) return fail("Unknown team member or date");
      if (!body.location) {
        await db.prepare("DELETE FROM day_locations WHERE employee_id = ?1 AND date = ?2").bind(employeeId, date).run();
        return json({ ok: true });
      }
      if (!LOCATIONS.includes(body.location)) return fail("Unknown location");
      await db.prepare(`INSERT INTO day_locations (employee_id, date, location) VALUES (?1, ?2, ?3)
        ON CONFLICT(employee_id, date) DO UPDATE SET location = excluded.location`).bind(employeeId, date, body.location).run();
      return json({ ok: true });
    }

    // ---- Working remote ----
    if (resource === "remote") {
      if (method === "POST") {
        const { employeeId, start, end } = body;
        if (!(await employeeExists(db, employeeId))) return fail("Unknown team member");
        if (!DATE.test(start || "") || !DATE.test(end || "") || end < start) return fail("Check the dates");
        const id = newId();
        await db.prepare("INSERT INTO remote (id, employee_id, start_date, end_date, called_out, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
          .bind(id, employeeId, start, end, body.calledOut ? 1 : 0, text(body.note, 200), new Date().toISOString()).run();
        return json({ id });
      }
      if (method === "DELETE" && rid) {
        await db.prepare("DELETE FROM remote WHERE id = ?1").bind(rid).run();
        return json({ ok: true });
      }
    }

    // ---- Time off (managers only) ----
    if (resource === "pto") {
      if (!user.isManager) return fail("Only managers can change time off", 403);
      if (method === "POST") {
        const { employeeId, start, end, type } = body;
        const days = Number(body.days);
        if (!(await employeeExists(db, employeeId))) return fail("Unknown team member");
        if (!TYPES.includes(type)) return fail("Unknown time off type");
        if (!DATE.test(start || "") || !DATE.test(end || "") || end < start) return fail("Check the dates");
        if (!(days > 0 && days <= 365)) return fail("Days charged must be more than 0");
        const id = newId();
        const note = text(body.note, 200);
        await db.prepare("INSERT INTO pto (id, employee_id, type, start_date, end_date, days, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
          .bind(id, employeeId, type, start, end, days, note, new Date().toISOString()).run();
        waitUntil(notifyPto(env, db, url.origin, user, { employeeId, type, start, end, days, note }));
        return json({ id, emailed: mailSettings(env).configured });
      }
      if (method === "DELETE" && rid) {
        await db.prepare("DELETE FROM pto WHERE id = ?1").bind(rid).run();
        return json({ ok: true });
      }
    }

    return fail("Not found", 404);
  } catch (err) {
    console.error(err);
    return fail("Something went wrong on the server. Try again.", 500);
  }
}
