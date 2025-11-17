import mongoose, { Schema } from 'mongoose';
import { IChatHistory, IChatMessage } from '../types';

/**
 * Chat Message Sub-Schema
 * Individual message in a conversation
 */
const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant']
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  { _id: false }
);

/**
 * ChatHistory Schema
 * Stores conversations with AI coach
 */
const ChatHistorySchema = new Schema<IChatHistory>(
  {
    // Session identifier (can group related conversations)
    sessionId: {
      type: String,
      required: true,
      index: true
    },

    // Optional reference to a specific game being discussed
    gameId: {
      type: Schema.Types.ObjectId,
      ref: 'Game',
      required: false,
      index: true
    },

    // Array of messages
    messages: {
      type: [ChatMessageSchema],
      required: true,
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying of recent conversations
ChatHistorySchema.index({ createdAt: -1 });

// Export the model
export const ChatHistory = mongoose.model<IChatHistory>('ChatHistory', ChatHistorySchema);
