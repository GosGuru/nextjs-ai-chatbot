import { z } from 'zod';
import type { getWeather } from './ai/tools/get-weather';
import type { createDocument } from './ai/tools/create-document';
import type { updateDocument } from './ai/tools/update-document';
import type { requestSuggestions } from './ai/tools/request-suggestions';
import type { InferUITool, UIMessage } from 'ai';
import type { AppUsage } from './usage';

import type { ArtifactKind } from '@/components/artifact';
import type { Suggestion } from './db/schema';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  'generation-run-id': string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

export interface ChatGenerationPayload {
  id: string; // chatId
  message: {
    id: string;
    role: 'user';
    parts: Array<
      | { type: 'text'; text: string }
      | { type: 'file'; url: string; name: string; mediaType: string }
    >;
  };
  controls: {
    platform: string;
    category: string;
    objective: string;
    responseType: string;
    intensity: string;
    extension: string;
    customGoal?: string;
  };
}

export interface FeedbackPayload {
  generationRunId: string;
  optionType: string;
  optionText: string;
  feedback: 'positive' | 'negative' | 'copied' | 'selected' | 'regenerated';
  comment?: string;
}

export interface RAGMetadata {
  analysis: {
    category: 'apertura' | 'shit_test' | 'tension' | 'chat_frio' | 'concrecion';
    conversationalReading: string;
    observedSignals: string[];
    apparentInvestment: 'baja' | 'media' | 'alta' | 'incierta';
    principalRisk: string;
    recommendedStrategy: string;
    confidence: number;
  };
  options: Array<{
    type: 'desafio_teasing' | 'intriga_curiosidad' | 'directa_avance' | 'calibrada_espejo';
    text: string;
    rationale: string;
    intensity: 'suave' | 'media' | 'alta';
  }>;
  retrievedExampleIds: string[];
  ruleSetId: string;
}
