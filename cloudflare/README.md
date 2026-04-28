# Cloudflare + LiveKit Prototype

This branch keeps the current Node server intact and adds an edge-native prototype:

- `cloudflare/worker.js` — Worker entrypoint + `MahjongRoom` Durable Object.
- `wrangler.toml` — Durable Object binding + static asset serving.
- `/api/rooms` — creates a 4-character room code.
- `/ws/:room` — WebSocket endpoint for that room's Durable Object.
- `/api/livekit-token` — mints a short-lived LiveKit token for `mahjong-ROOM`.

## Local dev

```bash
npm install
npx wrangler dev
```

## Required secrets for voice

```bash
npx wrangler secret put LIVEKIT_API_KEY
npx wrangler secret put LIVEKIT_API_SECRET
npx wrangler secret put LIVEKIT_URL
```

`LIVEKIT_URL` should look like `wss://your-project.livekit.cloud`.

## Current status

This is a prototype scaffold. The Durable Object implements the core room protocol but should be soak-tested against the existing Playwright scripts after the client is switched from the legacy root WebSocket to `/ws/:room`.
