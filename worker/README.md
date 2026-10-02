# Coach worker

A tiny Cloudflare Worker that sits between the app and the Anthropic API. The app sends still frames plus context; the worker adds the fixed coaching prompt, calls the model, and returns one structured review. The API key lives only here.

What it enforces:
- **POST only, JSON only.** CORS allows just `ALLOWED_ORIGINS` (the GitHub Pages origin by default).
- **`familyId` required** (24 characters, same format as the join code) — it's the rate-limit key, nothing else.
- **20 reviews per family per day** (KV namespace `RATE`; without the binding, per-instance memory).
- **The system prompt is fixed** in `src/core.js`. The app can't send a prompt, so there is no chat.
- **Max 20 frames, ≤350 KB each**, base64 JPEG. Never video.

## One-time setup (about 10 minutes)

```bash
cd worker
npm install
npx wrangler login                       # opens the browser → allow
npx wrangler kv namespace create RATE    # prints an id → paste it into wrangler.toml under [[kv_namespaces]]
npx wrangler secret put ANTHROPIC_API_KEY  # paste the key from console.anthropic.com → API Keys
npx wrangler deploy                      # prints https://sofia-spotlight-coach.<account>.workers.dev
```

Then put that URL in the app: `js/firebase-config.js` → `coachConfig.url`, bump the version, push. (Done 2026-10-01: https://sofia-spotlight-coach.sofia-spotlight-coach.workers.dev, KV `RATE` bound.)

No terminal? The secret can also be set in the Cloudflare dashboard: Workers & Pages → sofia-spotlight-coach → Settings → Variables and Secrets → Add → type Secret, name `ANTHROPIC_API_KEY`.

## Rotating the key
Create a new key in the Anthropic console, run `npx wrangler secret put ANTHROPIC_API_KEY` again (or replace it in the dashboard), then delete the old key in the console. No app change needed.

## Cost
One review sends up to 20 images at 768 px (about 1,000 tokens each) plus a short prompt and gets ~300 tokens back. On `claude-opus-5-5` that is roughly 10 cents per review; `claude-sonnet-5-5` (set `MODEL` in `wrangler.toml`) about half. With the 20-per-day cap the worst case is a couple of dollars a day; a normal week of two or three reviews is well under $2 a month. Watch it at console.anthropic.com → Usage. The worker itself runs on Cloudflare's free plan.

## Local test
```bash
npx wrangler dev        # http://localhost:8787
```
Add `,http://localhost:8080` to `ALLOWED_ORIGINS` in `wrangler.toml` while testing and set `coachConfig.url` to the dev URL.
