import mongoose, { Schema } from 'mongoose';
import { IGame } from '../types';

/**
 * Game Schema
 * Stores chess games from Chess.com with metadata
 */
const GameSchema = new Schema<IGame>(
  {
    // Whose game this is (Chess.com username)
    chessComUsername: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    // Unique game identifier from Chess.com
    gameId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // PGN notation of the game
    pgn: {
      type: String,
      required: true
    },

    // Player names
    white: {
      type: String,
      required: true
    },
    black: {
      type: String,
      required: true
    },

    // Game result
    result: {
      type: String,
      required: true,
      enum: ['1-0', '0-1', '1/2-1/2', '*']
    },

    // When the game was played
    datePlayed: {
      type: Date,
      required: true,
      index: true
    },

    // Analysis status
    analyzed: {
      type: Boolean,
      default: false,
      index: true
    },

    // When analysis was completed
    analyzedAt: {
      type: Date
    },

    // Time control data
    timeControl: {
      type: String
    },
    timeClass: {
      type: String,
      enum: ['bullet', 'blitz', 'rapid', 'daily', 'classical'],
      index: true
    },
    whiteRating: {
      type: Number
    },
    blackRating: {
      type: Number
    },

    // Opening data (extracted from PGN headers)
    opening: {
      type: String
    },
    eco: {
      type: String,
      index: true  // Index for aggregation queries
    }
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true
  }
);

// Create compound index for efficient queries
GameSchema.index({ chessComUsername: 1, datePlayed: -1 });
GameSchema.index({ chessComUsername: 1, analyzed: 1 });
GameSchema.index({ chessComUsername: 1, timeClass: 1, datePlayed: -1 });
GameSchema.index({ chessComUsername: 1, eco: 1 });  // For opening repertoire queries

// Export the model
export const Game = mongoose.model<IGame>('Game', GameSchema);
