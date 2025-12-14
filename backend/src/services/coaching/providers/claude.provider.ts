import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider } from './llm-provider.interface';

/**
 * Claude Provider
 * Implementation of ILLMProvider using Anthropic's Claude API
 */
export class ClaudeProvider implements ILLMProvider {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';
  private maxTokens = 1024;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. Please add it to your .env file.'
      );
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  /**
   * Send a chat message and receive a response
   * @param messages - Array of conversation messages
   * @param systemPrompt - System-level instructions for Claude
   * @returns The complete response from Claude
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Extract text content from the response
      const textContent = response.content.find(
        (block) => block.type === 'text'
      );

      if (textContent && textContent.type === 'text') {
        return textContent.text;
      }

      throw new Error('No text content in Claude response');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Claude API error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while calling Claude API');
    }
  }

  /**
   * Stream a chat response with real-time chunks
   * @param messages - Array of conversation messages
   * @param systemPrompt - System-level instructions for Claude
   * @param onChunk - Callback function called for each text chunk
   * @returns The complete response from Claude
   */
  async streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Listen for text deltas and call onChunk for each
      stream.on('text', (text) => {
        onChunk(text);
      });

      // Wait for the stream to complete and get the final message
      const finalMessage = await stream.finalMessage();

      // Extract text content from the final message
      const textContent = finalMessage.content.find(
        (block) => block.type === 'text'
      );

      if (textContent && textContent.type === 'text') {
        return textContent.text;
      }

      throw new Error('No text content in Claude streaming response');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Claude streaming API error: ${error.message}`);
      }
      throw new Error(
        'Unknown error occurred while streaming from Claude API'
      );
    }
  }
}
