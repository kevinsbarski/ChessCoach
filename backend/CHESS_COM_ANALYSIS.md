# Chess.com-Style Game Analysis Implementation

## Overview

ChessCoach implements Chess.com-style game analysis using the Expected Points Model for move classification.

---

## Expected Points Model

Converts centipawn evaluations into win probabilities (0.0 to 1.0):

```typescript
Win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * centipawns)) - 1)
```

**Why:** Going from +1.0 to +0.5 in a balanced position is more significant than the same change when already winning heavily.

---

## Move Classifications (11 Categories)

| Classification | Symbol | Description | EPL Threshold |
|---------------|--------|-------------|---------------|
| **brilliant** | !! | Material sacrifice that's best/nearly best in competitive position | <= 2% |
| **great** | ! | Critical move changing game outcome | <= 2% |
| **best** | | Optimal engine move | < 0.1% |
| **excellent** | | Nearly optimal | 0-2% |
| **good** | | Solid move | 2-5% |
| **book** | | Move from opening theory | N/A |
| **inaccuracy** | ?! | Suboptimal | 5-10% |
| **mistake** | ? | Significantly weakening | 10-20% |
| **miss** | | Missed opportunity | N/A |
| **blunder** | ?? | Severe error | 20%+ |
| **missed_mate** | | Failed to find forced mate | N/A |

---

## Classification Logic

### Brilliant Moves
Requires ALL:
1. Material sacrifice (2+ points)
2. Best or nearly best move (<=2% EPL)
3. Competitive position (20-80% win probability)
4. Not already winning (<=75% win probability)
5. Endgame: must be ONLY good move

### Great Moves
Critical moments that change outcome:
- Converting Losing -> Equal (win% < 25% -> 25-75%)
- Converting Equal -> Winning (25-75% -> >75%)

### Error Classification (EPL-based)
```typescript
BLUNDER_EPL: 0.20    // 20%+ win chance lost
MISTAKE_EPL: 0.10    // 10-20% win chance lost
INACCURACY_EPL: 0.05 // 5-10% win chance lost
```

### Position-Aware Adjustment
In decisive positions (>80% or <20% win probability), errors are treated leniently to prevent "blunder inflation" in already-lost games.

---

## API Response

```json
{
  "summary": {
    "totalMoves": 40,
    "white": {
      "moves": 20,
      "brilliant": 1,
      "great": 1,
      "best": 4,
      "excellent": 6,
      "good": 5,
      "inaccuracies": 2,
      "mistakes": 1,
      "blunders": 0,
      "avgExpectedPointsLost": 0.068
    },
    "black": {
      "moves": 20,
      "brilliant": 0,
      "great": 1,
      "best": 3,
      "excellent": 7,
      "good": 6,
      "inaccuracies": 2,
      "mistakes": 1,
      "blunders": 0,
      "avgExpectedPointsLost": 0.072
    },
    "avgExpectedPointsLost": 0.070,
    "numberOfCriticalMoments": 4
  }
}
```

### Per-Move Analysis
```json
{
  "moveNumber": 15,
  "move": "Rxe4",
  "classification": "brilliant",
  "winChanceBefore": 0.52,
  "winChanceAfter": 0.65,
  "expectedPointsLost": 0.0,
  "isSacrifice": true,
  "gamePhase": "middlegame",
  "isCritical": true
}
```

---

## Game Phase Detection

| Phase | Criteria |
|-------|----------|
| **Opening** | Moves 1-12 |
| **Middlegame** | Move 13+ with material > 13 points |
| **Endgame** | Material <= 13 points |

---

## File Structure

```
backend/src/
├── services/
│   ├── analysis/
│   │   ├── game-analyzer.ts     # Main analysis loop
│   │   ├── move-classifier.ts   # Classification logic
│   │   ├── stats-aggregator.ts  # Stats retrieval
│   │   └── index.ts             # Exports
│   └── utils/
│       ├── thresholds.ts        # EPL thresholds
│       ├── evaluation-utils.ts  # Win probability conversion
│       ├── position-utils.ts    # Material, sacrifice, phase
│       └── index.ts
├── types/index.ts               # TypeScript interfaces
└── models/Analysis.ts           # MongoDB schema
```

---

## Not Yet Implemented

| Feature | Status |
|---------|--------|
| Book Move Database | Structure ready, needs Lichess/master games integration |
| Rating-Based Adjustments | Not implemented |
| Miss Detection | Type exists, logic not implemented |

---

## Testing

```bash
# Fetch games
curl -X POST http://localhost:5000/api/games/fetch/USERNAME

# Analyze a game
curl -X POST http://localhost:5000/api/analysis/game/GAME_ID?depth=balanced

# Get results
curl http://localhost:5000/api/analysis/game/GAME_ID
```
