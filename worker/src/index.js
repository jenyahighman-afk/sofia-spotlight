// Sofia's Spotlight coach worker: a small Cloudflare Worker that turns still frames + context into one structured review.
// - POST only, JSON in / JSON out. CORS restricted to ALLOWED_ORIGINS (the GitHub Pages origin by default).
// - Holds ANTHROPIC_API_KEY as a Worker secret. The app never sees it.
// - The system prompt is fixed here (worker/src/core.js); the app cannot send its own prompt or chat.
// - 20 reviews per family per day (KV namespace RATE; falls back to per-isolate memory if the binding is missing).
import Anthropic from "@anthropic-ai/sdk";
import { validateRequest, buildUserContent, parseReview, checkAndCount, memoryStore, corsHeaders, parseOrigins, SYSTEM_PROMPT, REVIEW_SCHEMA } from "./core.js";

const DEFAULT_ORIGINS = "https://jenyahighman-afk.github.io";
const DEFAULT_MODEL = "claude-opus-5-5";
let memory = null;

const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...headers } });

export async function review(req, env){
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.MODEL || DEFAULT_MODEL;
  // Structured output pins the JSON shape; effort low keeps a 20-frame review quick and cheap. Server-side fallbacks so a
  // safety-classifier decline (rare on practice footage) is re-run on the default fallback model inside the same call.
  const response = await client.beta.messages.create({
    model, max_tokens: 1200,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: REVIEW_SCHEMA } },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserContent(req) }],
  });
  if (response.stop_reason === "refusal") return { error: "The coach couldn't review these frames. Try a clearer clip in good light.", status: 422 };
  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  const parsed = parseReview(text);
  if (!parsed) return { error: "The coach's reply wasn't readable. Try again.", status: 502 };
  return { review: parsed, model: response.model, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens, cached: response.usage.cache_read_input_tokens || 0 } };
}

export default {
  async fetch(request, env){
    const allowed = parseOrigins(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "POST only." }, 405, cors);
    if (!allowed.includes(origin)) return json({ error: "This origin isn't allowed." }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "The coach isn't set up yet (no API key on the worker)." }, 503, cors);
    let body; try { body = await request.json(); } catch (e) { return json({ error: "Send JSON." }, 400, cors); }
    const v = validateRequest(body); if (!v.ok) return json({ error: v.error }, v.status, cors);
    const store = env.RATE || (memory ||= memoryStore());
    const rate = await checkAndCount(store, v.req.familyId);
    if (!rate.allowed) return json({ error: `That's ${rate.limit} reviews today — the daily limit. More tomorrow.`, used: rate.used, limit: rate.limit }, 429, cors);
    try {
      const r = await review(v.req, env);
      if (r.error) return json({ error: r.error }, r.status, cors);
      return json({ ...r, used: rate.used, limit: rate.limit }, 200, cors);
    } catch (e) {
      const status = e && e.status;
      const msg = status === 401 ? "The worker's API key was rejected." : status === 429 ? "The coach is busy right now. Try again in a minute." : status === 400 ? "The frames were rejected (" + (e.message || "bad request").slice(0, 120) + ")." : "The coach didn't answer. Try again.";
      return json({ error: msg }, status && status >= 400 && status < 600 ? status : 502, cors);
    }
  },
};
