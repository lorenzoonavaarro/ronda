import { Injectable } from '@nestjs/common';
import { createXai } from '@ai-sdk/xai';
import { APICallError, generateText, jsonSchema, stepCountIs, tool } from 'ai';

import type {
  TreasurerModel,
  TreasurerModelRequest,
} from '../application/ports';
import { TreasurerUnavailableError } from '../domain/errors';

const MODEL_ID = 'grok-4.7';
const MISSING_KEY =
  'The treasurer is not configured. Add XAI_API_KEY to the API environment.';
const UNREACHABLE = 'The treasurer could not reach the model. Try again.';

@Injectable()
export class XaiTreasurerModel implements TreasurerModel {
  async answer(request: TreasurerModelRequest): Promise<string> {
    const apiKey = process.env.XAI_API_KEY?.trim();

    if (!apiKey) {
      throw new TreasurerUnavailableError(MISSING_KEY);
    }

    const provider = createXai({ apiKey });
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
        model: provider.responses(MODEL_ID),
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
        throw new TreasurerUnavailableError(MISSING_KEY);
      }

      throw new TreasurerUnavailableError(UNREACHABLE);
    }
  }
}
