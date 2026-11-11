import { Injectable } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { APICallError, generateText, jsonSchema, stepCountIs, tool } from 'ai';

import type {
  TreasurerModel,
  TreasurerModelRequest,
} from '../application/ports';
import { TreasurerUnavailableError } from '../domain/errors';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const MISSING_GATEWAY =
  'The treasurer is not configured. Add ASTRO_GATEWAY_URL and ASTRO_GATEWAY_API_KEY to the API environment.';
const REJECTED =
  'The Astropods gateway rejected the treasurer key. Check ASTRO_GATEWAY_API_KEY.';
const UNREACHABLE = 'The treasurer could not reach the model. Try again.';

@Injectable()
export class AstroTreasurerModel implements TreasurerModel {
  async answer(request: TreasurerModelRequest): Promise<string> {
    const apiKey = process.env.ASTRO_GATEWAY_API_KEY?.trim();
    const gatewayUrl = process.env.ASTRO_GATEWAY_URL?.trim();
    const modelId = process.env.ASTRO_GATEWAY_MODEL?.trim() || DEFAULT_MODEL;

    if (!apiKey || !gatewayUrl) {
      throw new TreasurerUnavailableError(MISSING_GATEWAY);
    }

    const gateway = createOpenAI({
      apiKey,
      baseURL: chatCompletionsUrl(gatewayUrl),
    });
    const tools = Object.fromEntries(
      request.tools.map((item) => [
        item.name,
        tool({
          description: item.description,
          inputSchema: jsonSchema(item.parameters),
          execute: async (input) => request.callTool(item.name, input),
        }),
      ]),
    );

    try {
      const result = await generateText({
        model: gateway.chat(modelId),
        instructions: request.instructions,
        prompt: request.message,
        tools,
        stopWhen: stepCountIs(6),
      });

      return result.text;
    } catch (error) {
      if (error instanceof TreasurerUnavailableError) {
        throw error;
      }

      if (
        APICallError.isInstance(error) &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        throw new TreasurerUnavailableError(REJECTED);
      }

      throw new TreasurerUnavailableError(UNREACHABLE);
    }
  }
}

function chatCompletionsUrl(gatewayUrl: string): string {
  const trimmed = gatewayUrl.replace(/\/+$/, '');

  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}
