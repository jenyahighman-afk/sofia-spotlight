// Daily reminder: web-push subscriptions live in KV (binding REMIND); a cron every 15 minutes sends the day's line to each
// subscription whose local time has come, unless that family already did the plan today (the app pings /remind/done).
// Build 3: only on the plan's days, a line for the kind of day, and a second nudge later in the evening (h2 / m2) if the
// plan still isn't done — never more than two a day.
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { validateSubscribe, dueSlot, subKey, doneKey, payloadFor, FAMILY_RE, localClock } from "./remind-core.js";

const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...headers } });
const ready = (env) => !!(env.REMIND && env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY);
const vapid = (env) => ({ subject: env.VAPID_SUBJECT || "https://jenyahighman-afk.github.io/sofia-spotlight/", publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY });

// POST /remind/subscribe | /remind/unsubscribe | /remind/done
export async function handleRemind(path, body, env, cors){
  if (!ready(env)) return json({ error: "Reminders aren't set up on the worker yet (REMIND namespace and VAPID keys)." }, 503, cors);
  if (path === "/remind/subscribe") {
    const v = validateSubscribe(body); if (!v.ok) return json({ error: v.error }, v.status, cors);
    const old = await env.REMIND.get(subKey(v.sub.endpoint), "json");
    await env.REMIND.put(subKey(v.sub.endpoint), JSON.stringify({ ...v.sub, lastSent: old ? old.lastSent : "", lastSent2: old ? old.lastSent2 || "" : "", at: Date.now() }));
    return json({ ok: true, h: v.sub.h, m: v.sub.m, tz: v.sub.tz, days: v.sub.days || null, second: Number.isInteger(v.sub.h2) ? { h: v.sub.h2, m: v.sub.m2 } : null }, 200, cors);
  }
  if (path === "/remind/unsubscribe") { const endpoint = String((body || {}).endpoint || ""); if (endpoint) await env.REMIND.delete(subKey(endpoint)); return json({ ok: true }, 200, cors); }
  if (path === "/remind/done") {
    const familyId = String((body || {}).familyId || ""); if (!FAMILY_RE.test(familyId)) return json({ error: "A valid familyId is required." }, 400, cors);
    const tz = String((body || {}).tz || ""); const { date } = localClock(new Date(), tz);
    await env.REMIND.put(doneKey(familyId, date), "1", { expirationTtl: 2 * 86400 }); return json({ ok: true, date }, 200, cors);
  }
  return json({ error: "Unknown reminder route." }, 404, cors);
}

// The cron: send to every due subscription. Gone endpoints (404/410) are dropped. Returns what happened, for the logs.
export async function sendDue(env, now = new Date()){
  const out = { checked: 0, sent: 0, skippedDone: 0, dropped: 0, failed: 0 }; if (!ready(env)) return { ...out, error: "not set up" };
  let cursor; do {
    const page = await env.REMIND.list({ prefix: "sub:", cursor }); cursor = page.list_complete ? undefined : page.cursor;
    for (const k of page.keys) {
      const sub = await env.REMIND.get(k.name, "json"); if (!sub) continue; out.checked++;
      const due = dueSlot(sub, now); if (!due) continue; const { slot, date } = due; const stamp = slot === 2 ? { lastSent2: date } : { lastSent: date };
      if (await env.REMIND.get(doneKey(sub.familyId, date))) { out.skippedDone++; await env.REMIND.put(k.name, JSON.stringify({ ...sub, ...stamp })); continue; }
      try {
        const payload = await buildPushPayload({ data: payloadFor(sub, date, slot), options: { ttl: 3600, urgency: "normal" } }, { endpoint: sub.endpoint, expirationTime: null, keys: sub.keys }, vapid(env));
        const res = await fetch(sub.endpoint, payload);
        if (res.status === 404 || res.status === 410) { await env.REMIND.delete(k.name); out.dropped++; continue; }
        if (res.status >= 400) { out.failed++; console.warn("push failed", res.status, await res.text().catch(() => "")); continue; }
        await env.REMIND.put(k.name, JSON.stringify({ ...sub, ...stamp })); out.sent++;
      } catch (e) { out.failed++; console.warn("push error", e && e.message); }
    }
  } while (cursor);
  return out;
}
