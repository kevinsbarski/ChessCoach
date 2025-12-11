/**
 * LLM Provider Interface
 * Abstract interface for chat-based language model providers
 */
export interface ILLMProvider {
  /**
   * Send a chat message and receive a response
   * @param messages - Array of conversation messages
   * @param systemPrompt - System-level instructions for the LLM
   * @returns The LLM's response as a string
   */
  chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string
  ): Promise<string>;

  /**
   * Stream a chat response with real-time chunks
   * @param messages - Array of conversation messages
   * @param systemPrompt - System-level instructions for the LLM
   * @param onChunk - Callback function called for each text chunk
   * @returns The complete response as a string
   */
  streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string>;
}
