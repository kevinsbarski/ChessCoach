import mongoose, { Schema } from 'mongoose';
import { IAnalysis, IMoveAnalysis, IAnalysisSummary, IPerPlayerSummary } from '../types';

/**
 * Move Analysis Sub-Schema
 * Individual move evaluation from Stockfish (Chess.com style)
 */
const MoveAnalysisSchema = new Schema<IMoveAnalysis>(
  {
    moveNumber: {
      type: Number,
      required: true
    },
    move: {
      type: String,
      required: true
    },
    fen: {
      type: String,
      required: true
    },
    // Centipawn evaluation
    evalBefore: {
      type: Number,
      required: true
    },
    evalAfter: {
      type: Number,
      required: true
    },
    // Expected Points Model (Lichess style)
    winChanceBefore: {
      type: Number,
      required: true
    },
    winChanceAfter: {
      type: Number,
      required: true
    },
    expectedPointsLost: {
      type: Number,
      required: true
    },
    // Classification
    classification: {
      type: String,
      required: true,
      enum: ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder', 'missed_mate']
    },
    isBook: {
      type: Boolean,
      required: true,
      default: false
    },
    gamePhase: {
      type: String,
      required: true,
      enum: ['opening', 'middlegame', 'endgame']
    },
    // Engine suggestions
    bestMove: {
      type: String
    },
    bestLine: {
      type: [String]
    },
    // Special flags
    isSacrifice: {
      type: Boolean
    },
    isOnlyGoodMove: {
      type: Boolean
    },
    isCritical: {
      type: Boolean
    },
    missedTactic: {
      type: String
    }
  },
  { _id: false } // Don't create _id for sub-documents
);

/**
 * Per-Player Summary Sub-Schema
 * Statistics for individual player (White or Black)
 */
const PerPlayerSummarySchema = new Schema<IPerPlayerSummary>(
  {
    moves: { type: Number, required: true, default: 0 },
    brilliant: { type: Number, required: true, default: 0 },
    great: { type: Number, required: true, default: 0 },
    best: { type: Number, required: true, default: 0 },
    excellent: { type: Number, required: true, default: 0 },
    good: { type: Number, required: true, default: 0 },
    book: { type: Number, required: true, default: 0 },
    inaccuracies: { type: Number, required: true, default: 0 },
    mistakes: { type: Number, required: true, default: 0 },
    misses: { type: Number, required: true, default: 0 },
    blunders: { type: Number, required: true, default: 0 },
    missedMates: { type: Number, required: true, default: 0 },
    avgExpectedPointsLost: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

/**
 * Analysis Summary Sub-Schema
 * Aggregate statistics for the game (Chess.com style)
 */
const AnalysisSummarySchema = new Schema<IAnalysisSummary>(
  {
    totalMoves: {
      type: Number,
      required: true
    },
    // Per-player statistics (Chess.com style)
    white: {
      type: PerPlayerSummarySchema,
      required: true
    },
    black: {
      type: PerPlayerSummarySchema,
      required: true
    },
    // Combined move counts by classification (for backwards compatibility)
    brilliant: {
      type: Number,
      required: true,
      default: 0
    },
    great: {
      type: Number,
      required: true,
      default: 0
    },
    best: {
      type: Number,
      required: true,
      default: 0
    },
    excellent: {
      type: Number,
      required: true,
      default: 0
    },
    good: {
      type: Number,
      required: true,
      default: 0
    },
    book: {
      type: Number,
      required: true,
      default: 0
    },
    inaccuracies: {
      type: Number,
      required: true,
      default: 0
    },
    mistakes: {
      type: Number,
      required: true,
      default: 0
    },
    misses: {
      type: Number,
      required: true,
      default: 0
    },
    blunders: {
      type: Number,
      required: true,
      default: 0
    },
    missedMates: {
      type: Number,
      required: true,
      default: 0
    },
    // Metrics
    avgExpectedPointsLost: {
      type: Number,
      required: true
    },
    // Additional metrics
    performanceRating: {
      type: Number
    },
    numberOfCriticalMoments: {
      type: Number,
      required: true,
      default: 0
    }
  },
  { _id: false }
);

/**
 * Analysis Schema
 * Stores Stockfish analysis results for a game
 */
const AnalysisSchema = new Schema<IAnalysis>(
  {
    // Reference to Game document
    gameId: {
      type: Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
      unique: true,
      index: true
    },

    // Stockfish configuration
    engineDepth: {
      type: Number,
      required: true
    },
    engineVersion: {
      type: String,
      required: true
    },

    // Move-by-move analysis
    moves: {
      type: [MoveAnalysisSchema],
      required: true
    },

    // Summary statistics
    summary: {
      type: AnalysisSummarySchema,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Export the model
export const Analysis = mongoose.model<IAnalysis>('Analysis', AnalysisSchema);
