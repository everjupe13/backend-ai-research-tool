import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert research assistant. Given a topic and a list of sources, write a clear, well-structured summary (3–5 paragraphs). Cite sources inline where relevant. Be objective and factual.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async summarize(topic: string, sources: string[]): Promise<string> {
    try {
      return await this.summarizeWithAnthropic(topic, sources);
    } catch (err) {
      this.logger.warn(
        `Anthropic failed, falling back to OpenAI: ${(err as Error).message}`,
      );
      return this.summarizeWithOpenAI(topic, sources);
    }
  }

  private async summarizeWithAnthropic(
    topic: string,
    sources: string[],
  ): Promise<string> {
    const stream = this.anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildUserMessage(topic, sources) }],
    });

    const message = await stream.finalMessage();
    const block = message.content.find((b) => b.type === 'text');
    return block?.type === 'text' ? block.text : '';
  }

  private async summarizeWithOpenAI(
    topic: string,
    sources: string[],
  ): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(topic, sources) },
      ],
    });

    return response.choices[0]?.message.content ?? '';
  }
}

function buildUserMessage(topic: string, sources: string[]): string {
  const sourceList =
    sources.length > 0
      ? sources.map((s, i) => `[${i + 1}] ${s}`).join('\n')
      : 'No external sources provided.';

  return `Topic: ${topic}\n\nSources:\n${sourceList}`;
}
