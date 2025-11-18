import mongoose, { Schema } from 'mongoose';
import { IAnalysis, IMoveAnalysis, IAnalysisSummary } from '../types';

/**
 * Move Analysis Sub-Schema
 * Individual move evaluation from Stockfish
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
    evalBefore: {
      type: Number,
      required: true
    },
    evalAfter: {
      type: Number,
      required: true
    },
    cpLoss: {
      type: Number,
      required: true
    },
    classification: {
      type: String,
      required: true,
      enum: ['excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'missed_mate']
    },
    bestMove: {
      type: String
    },
    bestLine: {
      type: [String]
    }
  },
  { _id: false } // Don't create _id for sub-documents
);

/**
 * Analysis Summary Sub-Schema
 * Aggregate statistics for the game
 */
const AnalysisSummarySchema = new Schema<IAnalysisSummary>(
  {
    totalMoves: {
      type: Number,
      required: true
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
    blunders: {
      type: Number,
      required: true,
      default: 0
    },
    avgCpLoss: {
      type: Number,
      required: true
    },
    accuracy: {
      type: Number,
      required: true
    },
    performanceRating: {
      type: Number
    },
    missedMates: {
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
