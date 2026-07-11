import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';

function compatModel(model: any) {
  if (model && typeof model === 'object') {
    return new Proxy(model, {
      get(target, prop) {
        if (prop === 'specificationVersion') {
          return 'v2';
        }
        return Reflect.get(target, prop);
      }
    });
  }
  return model;
}

function wrapProvider(provider: any) {
  return new Proxy(provider, {
    apply(target, thisArg, argumentsList) {
      return compatModel(Reflect.apply(target, thisArg, argumentsList));
    },
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value === 'function') {
        return function(this: any, ...args: any[]) {
          return compatModel(value.apply(this, args));
        };
      }
      return value;
    }
  });
}

export const openaiProvider = wrapProvider(createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}));

export const deepseekProvider = wrapProvider(createOpenAI({
  name: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
}));

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
