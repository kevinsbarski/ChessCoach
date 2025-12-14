/**
 * Coach Service
 * Main orchestrator for the chess coaching system
 */

import { ILLMProvider } from './providers/llm-provider.interface';
import { ICoachingContext, ICoachingSession } from '../../types/coaching.types';
import { IChatMessage } from '../../types/index';
import { buildCoachingContext } from './context-builder';
import { buildSystemPrompt } from './prompt-templates';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * CoachService
 * Manages coaching sessions and orchestrates LLM interactions
 */
export class CoachService {
  private provider: ILLMProvider;
  private sessions: Map<string, ICoachingSession> = new Map();

  constructor(provider: ILLMProvider) {
    this.provider = provider;
  }

  /**
   * Start a new coaching session for a user
   * @param username - Chess.com username
   * @returns Promise resolving to the new coaching session
   */
  async startSession(username: string): Promise<ICoachingSession> {
    // Build context from Phase 1 aggregations
    const context = await buildCoachingContext(username);

    // Create new session
    const session: ICoachingSession = {
      sessionId: generateSessionId(),
      username,
      context,
      messages: [],
      createdAt: new Date()
    };

    // Store session
    this.sessions.set(session.sessionId, session);

    return session;
  }

  /**
   * Get an existing session by ID
   * @param sessionId - Session ID to retrieve
   * @returns The coaching session or undefined
   */
  getSession(sessionId: string): ICoachingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Send a chat message and get a complete response
   * @param sessionId - Session ID
   * @param userMessage - User's message
   * @returns Promise resolving to the coach's response
   */
  async chat(sessionId: string, userMessage: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message to history
    const userChatMessage: IChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    session.messages.push(userChatMessage);

    // Build system prompt with player context
    const systemPrompt = buildSystemPrompt(session.context);

    // Get response from LLM
    const response = await this.provider.chat(
      session.messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt
    );

    // Add assistant response to history
    const assistantMessage: IChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date()
    };
    session.messages.push(assistantMessage);

    return response;
  }

  /**
   * Send a chat message and stream the response
   * @param sessionId - Session ID
   * @param userMessage - User's message
   * @param onChunk - Callback for each chunk of the response
   * @returns Promise resolving to the complete response
   */
  async streamChat(
    sessionId: string,
    userMessage: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message to history
    const userChatMessage: IChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    session.messages.push(userChatMessage);

    // Build system prompt with player context
    const systemPrompt = buildSystemPrompt(session.context);

    // Stream response from LLM
    const response = await this.provider.streamChat(
      session.messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt,
      onChunk
    );

    // Add assistant response to history
    const assistantMessage: IChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date()
    };
    session.messages.push(assistantMessage);

    return response;
  }

  /**
   * Get message history for a session
   * @param sessionId - Session ID
   * @returns Array of chat messages
   */
  getMessageHistory(sessionId: string): IChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return [...session.messages];
  }

  /**
   * End a coaching session
   * @param sessionId - Session ID to end
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
