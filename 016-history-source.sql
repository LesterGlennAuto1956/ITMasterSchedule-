// Sends email through Microsoft 365 / Exchange Online with Microsoft Graph.
// Uses an Entra app (client credentials) that Exchange only allows to send as ONE mailbox.
// Settings (Pages project > Settings > Variables and secrets):
//   MS_TENANT_ID       Directory (tenant) ID
//   MS_CLIENT_ID       Application (client) ID
//   MS_CLIENT_SECRET   client secret value (add as a Secret)
//   MAIL_FROM          mailbox to send from, e.g. it-schedule@lesterglenn.com
//   NOTIFY_EMAILS      who gets time off emails, comma-separated

let cached = { token: null, exp: 0 };

export function mailSettings(env) {
  const to = (env.NOTIFY_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
  const missing = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MAIL_FROM", "NOTIFY_EMAILS"].filter(k => !env[k]);
  return { configured: missing.length === 0 && to.length > 0, missing, to, from: env.MAIL_FROM || "" };
}

async function getToken(env) {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.MS_CLIENT_ID, client_secret: env.MS_CLIENT_SECRET, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(`Microsoft sign-in failed: ${d.error_description || d.error || r.status}`);
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return cached.token;
}

export async function sendMail(env, { subject, html }) {
  const s = mailSettings(env);
  if (!s.configured) throw new Error(`Email isn't set up yet. Missing: ${s.missing.join(", ") || "NOTIFY_EMAILS"}`);
  const token = await getToken(env);
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(s.from)}/sendMail`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: { subject, body: { contentType: "HTML", content: html }, toRecipients: s.to.map(a => ({ emailAddress: { address: a } })) },
      saveToSentItems: false,
    }),
  });
  if (r.status !== 202) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`Exchange refused the email (${r.status}): ${d.error?.message || "no details"}`);
  }
}

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function emailLayout(title, rows, footerLink) {
  const tr = rows.filter(r => r[1] !== "" && r[1] != null).map(([k, v]) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#576877;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#14222e">${esc(v)}</td></tr>`).join("");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px">
  <div style="background:#0772bc;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-size:16px;font-weight:600">${esc(title)}</div>
  <div style="border:1px solid #d3dde6;border-top:0;border-radius:0 0 8px 8px;padding:12px 18px">
    <table style="border-collapse:collapse;font-size:14px">${tr}</table>
    ${footerLink ? `<p style="margin:14px 0 4px"><a href="${esc(footerLink)}" style="color:#0772bc">Open the Time Off Tracker</a></p>` : ""}
  </div>
  <p style="color:#8696a4;font-size:12px">Sent automatically by the IT Master Tool. Replies to this email aren't monitored.</p></div>`;
}
