# J&J (SWOOP)

A browser-based implementation of **J&J** — a shedding card game for 2–4 players, built with React and TypeScript.

**[Play online](https://moshjorrison.github.io/jj-swoop/)** *(after GitHub Pages is enabled)*

## Features

- **2–4 players** with two standard decks (jokers in 4-player games)
- **VS AI** — play against computer opponents
- **Hot-seat** — pass the device between players
- Full rules in-app, plus [RULES.md](./RULES.md) in the repo
- Animated plays, round scoring, and game-over screen

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

Production builds use base path `/jj-swoop/` for GitHub Pages. Change `repoName` in [vite.config.ts](./vite.config.ts) if you rename the repository.

## Deploy to GitHub Pages

1. Create a public repo named `jj-swoop` on GitHub.
2. Push this project to the `main` branch.
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually). The site will be live at `https://<your-username>.github.io/jj-swoop/`.

## Project structure

| Path | Purpose |
|------|---------|
| `src/GameTable.tsx` | Main game UI and animations |
| `src/gameState.ts` | State transitions (play, flip, formality, rounds) |
| `src/gameLogic.ts` | Rules: legal plays, clears, scoring |
| `src/ai.ts` | AI opponent logic |
| `src/deck.ts` | Shuffle, deal, sideline reshuffle |
| `src/SetupScreen.tsx` | Mode and player setup |
| `RULES.md` | Full game rules |

## License

MIT — use and modify freely.
