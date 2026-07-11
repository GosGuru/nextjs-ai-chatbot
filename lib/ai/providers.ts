import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';

export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const deepseekProvider = createOpenAI({
  name: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require('./models.mock');
      return customProvider({
        languageModels: {
          'chat-model': chatModel,
          'chat-model-reasoning': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        'chat-model': deepseekProvider('deepseek-chat') as any,
        'chat-model-reasoning': wrapLanguageModel({
          model: deepseekProvider('deepseek-reasoner') as any,
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }) as any,
        'title-model': openaiProvider('gpt-4o-mini') as any,
        'artifact-model': openaiProvider('gpt-4o-mini') as any,
      },
    });
