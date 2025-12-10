# ChessCoach Backend - Code Statistics

## Project Status

| Component | Status |
|-----------|--------|
| Game Fetching (Chess.com API) | Complete |
| Stockfish Integration | Complete |
| Move Classification (11 categories) | Complete |
| Book Move Detection (Lichess API) | Complete |
| Per-Player Statistics | Complete |
| Analysis Queue System | Complete |
| LLM Coaching Layer | Not Started |

---

## Move Classification System

| Classification | Description | Detection |
|----------------|-------------|-----------|
| brilliant | Sacrifice that's best move | EPL ≤2% + sacrifice + competitive |
| great | Critical swing move | EPL ≤2% + outcome change |
| best | Engine's top move | EPL <0.1% |
| excellent | Nearly optimal | EPL 0-2% |
| good | Solid move | EPL 2-5% |
| book | Opening theory | Lichess master DB |
| inaccuracy | Suboptimal | EPL 5-10% |
| mistake | Significant error | EPL 10-20% |
| miss | Missed tactic | Best gives +1.5, played stays neutral |
| blunder | Severe error | EPL 20%+ |
| missed_mate | Lost forced mate | Had mate, lost it |

---

## Files by Lines of Code

| # | File | Category | Lines |
|---|------|----------|-------|
| 1 | `services/analysis/game-analyzer.ts` | Analysis | 375 |
| 2 | `services/stockfish.service.ts` | Service | 259 |
| 3 | `services/queue.service.ts` | Service | 248 |
| 4 | `models/Analysis.ts` | Model | 243 |
| 5 | `services/chesscom.service.ts` | Service | 223 |
| 6 | `controllers/games-fetch.controller.ts` | Controller | 190 |
| 7 | `controllers/analysis-queue.controller.ts` | Controller | 166 |
| 8 | `types/index.ts` | Types | 162 |
| 9 | `services/analysis/move-classifier.ts` | Analysis | 132 |
| 10 | `services/utils/position-utils.ts` | Utility | 123 |
| 11 | `controllers/analysis-results.controller.ts` | Controller | 123 |
| 12 | `services/utils/opening-book.ts` | Utility | 120 |
| 13 | `server.ts` | Core | 107 |
| 14 | `services/utils/evaluation-utils.ts` | Utility | 98 |
| 15 | `services/analysis/stats-aggregator.ts` | Analysis | 95 |
| 16 | `controllers/games-query.controller.ts` | Controller | 91 |
| 17 | `models/Game.ts` | Model | 79 |
| 18 | `models/ChatHistory.ts` | Model | 65 |
| 19 | `services/analysis/index.ts` | Analysis | 52 |
| 20 | `services/utils/thresholds.ts` | Utility | 50 |
| 21 | `config/database.ts` | Config | 49 |
| 22 | `services/utils/index.ts` | Utility | 39 |
| 23 | `routes/analysis.routes.ts` | Routes | 32 |
| 24 | `routes/games.routes.ts` | Routes | 28 |
| 25 | `models/index.ts` | Model | 8 |

---

## Summary by Category

| Category | Files | Total Lines |
|----------|-------|-------------|
| Analysis | 4 | 654 |
| Services | 3 | 730 |
| Controllers | 4 | 570 |
| Utility | 5 | 430 |
| Models | 4 | 395 |
| Types | 1 | 162 |
| Core | 1 | 107 |
| Routes | 2 | 60 |
| Config | 1 | 49 |

---

## Directory Structure

```
backend/src/
├── config/
│   └── database.ts
├── controllers/
│   ├── analysis-queue.controller.ts
│   ├── analysis-results.controller.ts
│   ├── games-fetch.controller.ts
│   └── games-query.controller.ts
├── models/
│   ├── Analysis.ts
│   ├── ChatHistory.ts
│   ├── Game.ts
│   └── index.ts
├── routes/
│   ├── analysis.routes.ts
│   └── games.routes.ts
├── services/
│   ├── analysis/
│   │   ├── game-analyzer.ts      # Main analysis loop
│   │   ├── move-classifier.ts    # EPL-based classification
│   │   ├── stats-aggregator.ts   # Stats retrieval
│   │   └── index.ts
│   ├── utils/
│   │   ├── evaluation-utils.ts   # Win probability math
│   │   ├── opening-book.ts       # Lichess API integration
│   │   ├── position-utils.ts     # Material, sacrifice, phase
│   │   ├── thresholds.ts         # Classification thresholds
│   │   └── index.ts
│   ├── chesscom.service.ts       # Chess.com API
│   ├── queue.service.ts          # Bull queue management
│   └── stockfish.service.ts      # Stockfish engine wrapper
├── types/
│   └── index.ts
└── server.ts
```

---

**Total: 25 files, 3,157 lines of TypeScript**
