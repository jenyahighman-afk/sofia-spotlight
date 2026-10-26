// Coach worker core: request validation, the fixed system prompt, message building, rate limiting and response parsing.
// No SDK imports here so tests/coach-worker.test.js can exercise it in Node without installing the worker's dependencies.

export const FAMILY_RE = /^[A-Z2-9]{24}$/;
export const TAGS = ["feet", "knees", "eyes", "arms", "memory", "timing", "spacing", "energy", "other"];
export const MAX_FRAMES = 20, MAX_FRAME_BYTES = 350 * 1024, DAILY_LIMIT = 20;

// Verbatim from the session brief, plus (1.22.0) the rules that keep the review on the dancer and behind her teacher.
// Never edited by the app; the app cannot send its own prompt.
export const BODY_RULE = "Only comment on body parts that appear in the pose data with visibility ≥ 0.6. Ignore background objects, mats, mirrors, reflections and other people. If unsure, say nothing about that body part.";
export const SYSTEM_PROMPT = "You are a kind, specific dance coach reviewing still frames from a 9-year-old dancer's practice. Judge only what is visible. Praise one real thing first. Give exactly one fix, phrased as an action she can do this week, in words a 9-year-old understands. Check feet (pointed), knees (straight when they should be), eyes (up and focused), arms (long, shoulders down). Never comment on body shape, weight, or appearance. Never diagnose injury; if anything looks painful say 'stop and tell your teacher or parent'. Never suggest stretching past the current range. If frames are unclear, say what to film next time. "
  + "The frames are crops around the dancer, made on the phone. " + BODY_RULE + " "
  + "Her teachers' corrections outrank you: when a teacher's open correction fits what you see, make it the fix. If your fix is about something different from the teacher's corrections, set askTeacher to true. When the request says Memory + knees is active, give no new tricks and no stretching advice. "
  + "When a cue table is given, name moves by their time in the music (for example 'at 1:18 donut roll'), and list in missed any steps that looked missed, out of order or unsure (empty if none). "
  + "Reply ONLY with JSON: {\"loved\":\"…\",\"fix\":\"…\",\"tag\":\"feet|knees|eyes|arms|memory|timing|spacing|energy|other\",\"feet\":\"✓ or note\",\"knees\":\"✓ or note\",\"eyes\":\"✓ or note\",\"arms\":\"✓ or note\",\"try\":\"optional drill or empty\",\"missed\":\"missed or unsure steps, or empty\",\"askTeacher\":false}.";

export const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { loved: { type: "string" }, fix: { type: "string" }, tag: { type: "string", enum: TAGS }, feet: { type: "string" }, knees: { type: "string" }, eyes: { type: "string" }, arms: { type: "string" }, try: { type: "string" }, missed: { type: "string" }, askTeacher: { type: "boolean" } },
  required: ["loved", "fix", "tag", "feet", "knees", "eyes", "arms", "try", "missed", "askTeacher"],
};

const str = (v, max) => String(v == null ? "" : v).slice(0, max);

// Returns { ok: true, req } or { ok: false, status, error }.
export function validateRequest(body){
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Send JSON." };
  const familyId = str(body.familyId, 40);
  if (!FAMILY_RE.test(familyId)) return { ok: false, status: 400, error: "A valid familyId is required." };
  const frames = Array.isArray(body.frames) ? body.frames : [];
  if (!frames.length) return { ok: false, status: 400, error: "No frames. Film or pick a clip or a photo first." };
  if (frames.length > MAX_FRAMES) return { ok: false, status: 400, error: `Too many frames (max ${MAX_FRAMES}).` };
  for (const f of frames) {
    if (typeof f !== "string" || !/^[A-Za-z0-9+/=]+$/.test(f)) return { ok: false, status: 400, error: "Frames must be base64 JPEG." };
    if (f.length * 0.75 > MAX_FRAME_BYTES) return { ok: false, status: 400, error: "A frame is too large — resize to 768px." };
  }
  const kind = body.kind === "photo" ? "photo" : "video";
  const corrections = (Array.isArray(body.corrections) ? body.corrections : []).map(c => str(c, 160)).filter(Boolean).slice(0, 12);
  const pose = body.pose && typeof body.pose === "object" ? Object.fromEntries(Object.entries(body.pose).slice(0, 12).map(([k, v]) => [str(k, 40), str(v, 80)])) : null;
  // 1.22.0: frame times (s from the start of the clip), the dance's cue table, the teacher's pinned notes, Memory + knees,
  // and per-frame pose numbers (joints seen at ≥ 0.6 only, made on the phone by js/dancer.js).
  const times = (Array.isArray(body.times) ? body.times : []).slice(0, frames.length).map(t => Number.isFinite(+t) && t !== null ? Math.round(+t * 10) / 10 : null);
  const cues = (Array.isArray(body.cues) ? body.cues : []).map(c => str(c, 90)).filter(Boolean).slice(0, 40);
  const pinned = (Array.isArray(body.pinned) ? body.pinned : []).filter(p => p && p.text).slice(0, 4).map(p => ({ text: str(p.text, 200), tag: TAGS.includes(p.tag) ? p.tag : "other", by: str(p.by, 40) || "teacher" }));
  const poseFrames = (Array.isArray(body.poseFrames) ? body.poseFrames : []).slice(0, frames.length).map(cleanFrameReport);
  return { ok: true, req: { familyId, kind, frames, times, dance: str(body.dance, 120), style: str(body.style, 40), map: str(body.map, 600), trick: str(body.trick, 120), corrections, pose, cues, pinned, memoryKnees: body.memoryKnees === true, poseFrames } };
}

// One frame's pose report, bounded: time, average visibility, the parts seen (≥ 0.6) and the numbers.
const PART = /^(head|(left|right) (shoulder|elbow|wrist|hip|knee|ankle|foot))$/;
export function cleanFrameReport(r){
  const o = r && typeof r === "object" ? r : {}; const out = { t: Number.isFinite(+o.t) && o.t !== null ? Math.round(+o.t * 10) / 10 : null, vis: Math.max(0, Math.min(1, +o.vis || 0)), parts: (Array.isArray(o.parts) ? o.parts : []).map(x => str(x, 20)).filter(x => PART.test(x)).slice(0, 15) };
  for (const k of ["kneeLeft", "kneeRight", "footLeft", "footRight"]) if (Number.isFinite(+o[k]) && o[k] !== null && o[k] !== "") out[k] = Math.round(+o[k]);
  for (const k of ["kneeOverToeLeft", "kneeOverToeRight"]) if (["over toes", "falls in", "out"].includes(o[k])) out[k] = o[k];
  return out;
}
const mmss = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1).replace(/\.0$/, ""); };
// The single user turn: frames first, then the context the brief lists (dance name/style, music map, open corrections, trick).
export function buildUserContent(req){
  const content = req.frames.map(data => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }));
  const lines = [
    `These are ${req.frames.length} still frames from ${req.kind === "photo" ? "photos" : "a practice video"}, in time order.`,
    req.dance ? `Dance: ${req.dance}${req.style ? ` (${req.style})` : ""}.` : (req.style ? `Style: ${req.style}.` : ""),
    req.trick ? `She is working on this trick: ${req.trick}.` : "",
    req.map ? `Where the big moments land in the music: ${req.map}` : "",
    req.pinned && req.pinned.length ? `Teacher corrections that outrank you (homework, pinned):\n- ${req.pinned.map(p => `${p.text} (${p.by}, ${p.tag})`).join("\n- ")}` : "",
    req.corrections.length ? `Other open corrections from her teachers:\n- ${req.corrections.join("\n- ")}` : (req.pinned && req.pinned.length ? "" : "Open corrections: none recorded."),
    req.memoryKnees ? "Memory + knees is active (her teacher's rule until the solo is memorized): no new tricks, no stretching advice. Look at knees over toes and at whether she knows what comes next." : "",
    req.cues && req.cues.length ? `Cue table (time in the music → move; ★ = key trick):\n${req.cues.join("\n")}` : "",
    req.times && req.times.some(t => t !== null) ? `Frame times, seconds from the start of the clip (they match the music when the clip starts with it): ${req.times.map((t, i) => `frame ${i + 1} ${t === null ? "?" : mmss(t)}`).join(", ")}.` : "",
    req.poseFrames && req.poseFrames.length ? `Pose data per frame (only joints seen with visibility ≥ 0.6; knee and foot angles in degrees, 180 = straight / fully pointed):\n${req.poseFrames.map((r, i) => `frame ${i + 1}: seen ${r.parts.length ? r.parts.join(", ") : "nothing clearly"}${["kneeLeft", "kneeRight", "footLeft", "footRight", "kneeOverToeLeft", "kneeOverToeRight"].filter(k => r[k] !== undefined).map(k => `; ${k} ${r[k]}`).join("")}`).join("\n")}` : "",
    req.pose ? `On-device pose summary (from a skeleton tool, may be noisy): ${Object.entries(req.pose).map(([k, v]) => `${k}: ${v}`).join("; ")}.` : "",
    BODY_RULE,
  ].filter(Boolean);
  content.push({ type: "text", text: lines.join("\n") });
  return content;
}

// Pull the review JSON out of a model reply; tolerate code fences or stray text around it.
// `req` (optional): the validated request. Its pinned teacher notes back up askTeacher: a fix on any other tag is flagged.
export function parseReview(text, req = null){
  let s = String(text || "").trim(); const m = /\{[\s\S]*\}/.exec(s); if (m) s = m[0];
  let j; try { j = JSON.parse(s); } catch (e) { return null; }
  if (!j || typeof j !== "object") return null;
  const out = { loved: str(j.loved, 400), fix: str(j.fix, 400), tag: TAGS.includes(j.tag) ? j.tag : "other", feet: str(j.feet, 200) || "✓", knees: str(j.knees, 200) || "✓", eyes: str(j.eyes, 200) || "✓", arms: str(j.arms, 200) || "✓", try: str(j.try, 400), missed: str(j.missed, 400), askTeacher: j.askTeacher === true };
  const pinTags = req && Array.isArray(req.pinned) ? req.pinned.map(p => p.tag) : [];
  if (pinTags.length && !pinTags.includes(out.tag) && !(pinTags.includes("memory") && out.tag === "timing")) out.askTeacher = true;
  if (!out.loved || !out.fix) return null;
  return out;
}

export const dayKey = (familyId, now = new Date()) => `rate:${familyId}:${now.toISOString().slice(0, 10)}`;
export const secondsToMidnightUTC = (now = new Date()) => Math.max(60, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000));

// Rate limit: 20 reviews per family per UTC day. `store` is a KV namespace (get/put) or the in-memory fallback.
export async function checkAndCount(store, familyId, now = new Date(), limit = DAILY_LIMIT){
  const key = dayKey(familyId, now); const used = parseInt((await store.get(key)) || "0", 10) || 0;
  if (used >= limit) return { allowed: false, used, limit };
  await store.put(key, String(used + 1), { expirationTtl: secondsToMidnightUTC(now) });
  return { allowed: true, used: used + 1, limit };
}
export function memoryStore(){ const m = new Map(); return { async get(k){ const e = m.get(k); if (!e) return null; if (e.exp && Date.now() > e.exp) { m.delete(k); return null; } return e.v; }, async put(k, v, o = {}){ m.set(k, { v, exp: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); } }; }

export function corsHeaders(origin, allowed){
  const ok = allowed.includes(origin);
  return { "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "null", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}
export const parseOrigins = (s) => String(s || "").split(",").map(x => x.trim()).filter(Boolean);
