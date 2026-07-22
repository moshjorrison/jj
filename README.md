# J&J

A browser-based implementation of **J&J** — a shedding card game for 2–4 players, built with React and TypeScript.

**[Play online](https://moshjorrison.github.io/jj/)**

## Features

- **2–4 players** with two standard decks (jokers in 4-player games)
- **VS AI** — play against computer opponents
- **Hot-seat** — pass the device between players
- **Online** — play across phones/computers with room codes (4–10 players)
- Full rules in-app, plus [RULES.md](./RULES.md) in the repo
- Animated plays, round scoring, and game-over screen

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Online multiplayer (local dev)

```bash
npm install
npm run dev:all
```

This runs the Vite app and WebSocket server (`ws://localhost:3001`) together.

## Online multiplayer (production)

Online play needs a WebSocket server in addition to GitHub Pages:

1. Deploy the server to [Render](https://render.com) using [render.yaml](./render.yaml) (free tier).
2. Copy the Render service URL (e.g. `wss://jj-multiplayer.onrender.com`).
3. Add a GitHub repo secret `VITE_WS_URL` with that URL.
4. Re-run the **Deploy to GitHub Pages** workflow so the client picks up the URL.

Players create a room, share the invite link, and join from any device.

## Build

```bash
npm run build
npm run preview
```

Production builds use base path `/jj/` for GitHub Pages. Change `repoName` in [vite.config.ts](./vite.config.ts) if you rename the repository.

## Deploy to GitHub Pages

1. Push this project to the `main` branch of [moshjorrison/jj](https://github.com/moshjorrison/jj).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually). The site will be live at `https://moshjorrison.github.io/jj/`.

## Project structure

| Path | Purpose |
|------|---------|
| `src/GameTable.tsx` | Main game UI and animations |
| `src/gameState.ts` | State transitions (play, flip, formality, rounds) |
| `src/gameLogic.ts` | Rules: legal plays, clears, scoring |
| `src/ai.ts` | AI opponent logic |
| `src/deck.ts` | Shuffle, deal, sideline reshuffle |
| `src/SetupScreen.tsx` | Mode and player setup |
| `server/` | WebSocket multiplayer server |
| `src/multiplayer/` | Online lobby, protocol, client hook |
| `RULES.md` | Full game rules |

## License

MIT — use and modify freely.
