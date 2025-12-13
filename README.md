# ChessCoach 🎯

AI-powered chess coach that analyzes your Chess.com games and finds patterns in your play.

## What it does

- Fetches your games from Chess.com
- Analyzes each move with Stockfish engine
- Finds patterns across all your games (not just one)
- AI coach answers questions about YOUR weaknesses

## The Problem

Chess.com tells you "you had 3 blunders" but not WHY you keep making them.

After 50 games of the same analysis, you still don't know your real problem.

## The Solution

Instead of analyzing one game at a time, this system:
1. Analyzes hundreds of games
2. Aggregates the data into patterns
3. Lets you chat with an AI that knows YOUR stats

**Example questions you can ask:**
- "What openings am I best at?"
- "Which phase of the game do I struggle with?"
- "Am I better as white or black?"

## Tech Stack

- **Backend:** Node.js + TypeScript + Express
- **Database:** MongoDB
- **Engine:** Stockfish (depth 20-30)
- **AI:** Claude (Anthropic)
- **Opening Book:** Polyglot (15,000 GM positions)

## Status

🚧 Work in progress - core functionality works, more features coming.

## Run locally

```bash
cd backend
npm install
npm run coach
```

Requires: MongoDB, Stockfish binary, Anthropic API key

---

*Built because I wanted to beat someone at chess. Still working on that part.*
