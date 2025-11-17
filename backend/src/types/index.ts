import { Document, Types } from 'mongoose';

/**
 * Game Document Interface
 * Represents a chess game from Chess.com
 */
export interface IGame extends Document {
  chessComUsername: string;
  gameId: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  datePlayed: Date;
  analyzed: boolean;
  analyzedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Single Move Analysis
 */
export interface IMoveAnalysis {
  moveNumber: number;
  move: string;
  fen: string;
  evalBefore: number;
  evalAfter: number;
  cpLoss: number;
  classification: 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'missed_mate';
  bestMove?: string;
  bestLine?: string[];
}

/**
 * Analysis Summary Statistics
 */
export interface IAnalysisSummary {
  totalMoves: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  avgCpLoss: number;
  accuracy?: number;
}

/**
 * Analysis Document Interface
 * Stores Stockfish analysis results for a game
 */
export interface IAnalysis extends Document {
  gameId: Types.ObjectId;
  engineDepth: number;
  engineVersion: string;
  moves: IMoveAnalysis[];
  summary: IAnalysisSummary;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat Message Interface
 */
export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * ChatHistory Document Interface
 * Stores conversations with AI coach
 */
export interface IChatHistory extends Document {
  sessionId: string;
  gameId?: Types.ObjectId;  // Optional: reference to specific game being discussed
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}
