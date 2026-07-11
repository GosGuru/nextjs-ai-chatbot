# Spec: Conversational RAG Assistant (Asistente RAG para conversaciones)

## Objective
The Conversational RAG Assistant upgrade transforms the chat interface into a Spanish conversational/dating coach. It utilizes Retrieval-Augmented Generation (RAG) driven by Supabase PostgreSQL `pgvector`, OpenAI models (`gpt-4o-mini`/`gpt-4o` and `text-embedding-3-small`), DeepSeek Pro (`deepseek-chat`), and rules-based logic to analyze conversation screenshots, retrieve matching contexts/strategies, and suggest responses in Rioplatense Spanish.

### User Stories
* As a user, I want to upload 1 to 5 screenshots of a conversation so the assistant can analyze the history and subtext.
* As a user, I want to specify the platform, category, objective, style, intensity, and length of response options using interactive controls.
* As a user, I want to receive tailored response options (either 4 distinct options in Automatic Mode or 3 variations of a specific style in Specific Mode).
* As a user, I want to see a conversational analysis card that reveals the psychological subtext of the conversation and the rules applied.
* As a user, I want to vote (upvote/downvote) and comment on response options to help train and audit the coach's generations.

---

## Tech Stack
* **Framework**: Next.js 15 (canary.31), React 19 (rc), TypeScript.
* **Styling**: Tailwind CSS.
* **Database**: Supabase PostgreSQL with `pgvector` extension enabled (768-dimensional embeddings).
* **ORM**: Drizzle ORM (`drizzle-orm` and `drizzle-kit`).
* **AI Integration**:
  * **Embedding Model**: OpenAI `text-embedding-3-small` (configured to produce 768-dimensional vector outputs).
  * **Vision Model**: OpenAI `gpt-4o-mini` or `gpt-4o` (supporting screenshot multimodal extraction).
  * **Generative Model**: DeepSeek Pro (`deepseek-chat`) (supporting fast response generation and conversation options streaming).
* **Storage**: Supabase Storage (`temporary_screenshots` private bucket with short-lived signed URLs).
* **Linter/Formatter**: Biome.

---

## Commands
* `pnpm dev` — Start the Next.js development server.
* `pnpm build` — Generate database migrations and build the production Next.js application.
* `pnpm lint:fix` — Format and lint code using Biome.
* `pnpm db:generate` — Generate Drizzle migrations.
* `pnpm db:migrate` — Apply migrations to the Supabase PostgreSQL database.
* `pnpm db:push` — Push the local schema updates directly to the database (for development/testing).
* `pnpm ingest:examples` — Parse `data/chat-examples.jsonl`, generate embeddings using OpenAI's `text-embedding-3-small` (configured to return 768 dimensions), and seed the `chat_examples` table.
* `pnpm test` — Run Playwright end-to-end integration and system tests.

---

## Project Structure
The implementation introducing this capability SHALL organize files as follows:

```
openspec/changes/conversational-rag-assistant/
├── proposal.md
├── exploration.md
└── specs/
    └── conversational-rag-assistant/
        └── spec.md                   <- This specification file

lib/
├── db/
│   ├── schema.ts                     <- Add pgvector tables (chat_examples, rule_sets, etc.)
│   ├── queries.ts                    <- Add similarity search and feedback logging queries
│   └── ingest.ts                     <- Ingestion command logic
├── ai/
│   ├── rag-search.ts                 <- Embedding query orchestration and cosine similarity logic
│   ├── providers.ts                  <- Register OpenAI and DeepSeek Pro providers
│   └── prompts.ts                    <- Update system prompt layouts for Rioplatense coach behaviour
└── types.ts                          <- Shared type definitions (feedback, generation runs, inputs)

components/
├── multimodal-input.tsx              <- Update to support 1-5 screenshots, show progress & thumbnails
├── rag-assistant-panel.tsx           <- Right-side panel showing analysis card & response options
└── feedback-button.tsx               <- UI component for upvoting/downvoting and comment tracking

app/
└── (chat)/
    └── api/
        ├── chat/
        │   └── route.ts              <- Multi-image parsing, vector search, streaming execution
        └── rag/
            ├── search/
            │   └── route.ts          <- API endpoint to trigger template searches manually
            └── feedback/
                └── route.ts          <- API endpoint to receive and write votes to response_feedback
```

---

## Data Models & Schema
The database MUST support the following schema definitions. All schemas MUST be written using Drizzle ORM syntax.

### 1. `chat_examples`
Stores historical chat contexts, target messages, and recommended responses.
* `id` (UUID): Primary key, default: random UUID.
* `category` (text): The conversational category (e.g., openers, flirting, setting dates).
* `situational_context` (text): Description of the situation.
* `last_message` (text): The last message received from the recipient.
* `psychological_subtext` (text): Expert analysis of the conversational dynamics.
* `options` (jsonb): Recommended response options.
* `embedding` (vector(768)): 768-dimensional vector embedding of the combined `situational_context` and `last_message` generated by OpenAI's `text-embedding-3-small` (configured to return 768 dimensions).

### 2. `assistant_rule_sets`
Stores system prompt rules and behavioral constraints.
* `id` (UUID): Primary key, default: random UUID.
* `name` (text): Unique name identifier for the rule set.
* `rules` (text[]): List of guiding constraints (e.g., "Do not sound needy", "Use Rioplatense dialect").
* `embedding` (vector(768)): 768-dimensional vector embedding of rules text for similarity matching.
* `createdAt` (timestamp): Row creation timestamp.

### 3. `generation_runs`
Logs details of every response generation attempt to monitor quality and match accuracy.
* `id` (UUID): Primary key, default: random UUID.
* `chatId` (UUID): References `Chat.id` (foreign key).
* `prompt` (text): Combined text input (manual input + extracted screenshot summary).
* `response` (text): The generated response stream content.
* `matchedExamples` (jsonb): References / metadata of the top matched entries from `chat_examples`.
* `matchedRules` (jsonb): Metadata showing matching rows from `assistant_rule_sets`.
* `createdAt` (timestamp): Generation timestamp.

### 4. `response_feedback`
Logs user rating and comments on generated options.
* `id` (UUID): Primary key, default: random UUID.
* `generationRunId` (UUID): References `generation_runs.id` (foreign key).
* `rating` (boolean): `true` for upvote (thumbs up), `false` for downvote (thumbs down).
* `comment` (text): Optional textual context provided by the user.
* `createdAt` (timestamp): Feedback submission timestamp.

---

## Code Style

### Database Schema Definition (Drizzle ORM)
```typescript
import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';

// Custom pgvector type mapping for 768-dimension vectors
export const pgVector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === 'string') {
      return value.slice(1, -1).split(',').map(Number);
    }
    return value as number[];
  }
});

export const chatExamples = pgTable('chat_examples', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  situationalContext: text('situational_context').notNull(),
  lastMessage: text('last_message').notNull(),
  psychologicalSubtext: text('psychological_subtext').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),
  embedding: pgVector('embedding').notNull(),
});
```

### pgvector Cosine Similarity Query Example (Drizzle ORM)
```typescript
import { db } from './db';
import { sql } from 'drizzle-orm';
import { chatExamples } from './schema';

export async function findSimilarExamples(promptEmbedding: number[], limit = 3) {
  // Execute cosine distance query using pgvector operators (<=> represents cosine distance in PostgreSQL)
  return await db
    .select({
      id: chatExamples.id,
      category: chatExamples.category,
      situationalContext: chatExamples.situationalContext,
      lastMessage: chatExamples.lastMessage,
      psychologicalSubtext: chatExamples.psychologicalSubtext,
      options: chatExamples.options,
      similarity: sql<number>`1 - (${chatExamples.embedding} <=> ${sql.raw(`'[${promptEmbedding.join(',')}]'`)}::vector)`
    })
    .from(chatExamples)
    .orderBy(sql`${chatExamples.embedding} <=> ${sql.raw(`'[${promptEmbedding.join(',')}]'`)}::vector`)
    .limit(limit);
}
```

---

## Testing Strategy
All components and database systems introduced MUST be verified through unit, integration, and E2E testing using Playwright.

### Test Levels & Environments
1. **Unit Testing**: Isolated tests verifying text extraction helpers, selector mapping logic, and feedback schema validation.
2. **Integration Testing**: Local testing of database seeding, vector indexing queries, and the RAG prompt assembler pipeline. Mocking external API responses from OpenAI and DeepSeek Pro.
3. **E2E Testing**: Playwright tests simulating the user upload flow (1-5 screenshots), selection adjustments, generation result viewing, and feedback submission.

---

## Boundaries

### ALWAYS DO:
* **Validate Screenshot Limits**: The UI MUST enforce a limit of 1 to 5 uploads before submitting. Reject files exceeding 10MB each or not matching JPEG/PNG/WEBP extensions.
* **Keep Images Private**: Screenshots MUST be uploaded to a secure, private bucket with access limited via short-lived signed URLs.
* **Use Spanish Rioplatense constraints**: The prompt structure MUST force Rioplatense dialect tokens (e.g. use "vos", "tenés", "estás", "querés", avoid "tú", "vosotros").
* **Sanitize Inputs**: Zod validation MUST be enforced on all inputs received at the API endpoint.

### ASK FIRST:
* Changing structural fields on shared core tables (`User`, `Chat`, `Message_v2`).
* Adding additional visual components to the chat view layout outside of the designated sidebar/RAG assistant panel.
* Modifying default model fallback targets for embedding or chat generation APIs.

### NEVER DO:
* **Never commit API credentials**: Keep all Supabase, OpenAI, and DeepSeek Pro tokens in `.env` variables and verify they are never logged or committed.
* **Never store screenshots publicly**: Do not make storage bucket urls public or persist screenshots indefinitely (rely on bucket lifecycle policies to delete temporary assets).
* **Never bypass schema validation**: Do not bypass TypeScript/Zod validations for generation payload metadata.

---

## Success Criteria & Given/When/Then Scenarios

### Requirement 1: Multi-screenshot Upload & Multimodal Extraction
* **Goal**: Enable users to upload 1 to 5 images, extract conversation state, and pass context to the LLM.

#### Scenario 1.1: Enforce upload file limit validation
* **Given** a user has currently attached 5 screenshots in the chat input panel
* **When** the user attempts to add an additional 6th screenshot file
* **Then** the UI MUST block the upload action, prevent the file from being appended, and display an alert notification stating: "Límite superado: podés subir un máximo de 5 capturas de pantalla."

#### Scenario 1.2: Multimodal extraction flow execution
* **Given** a user has attached 3 valid conversation screenshots and entered manual instruction text "Haceme quedar divertido"
* **When** the user submits the message
* **Then** the application MUST upload the screenshot files to the private `temporary_screenshots` storage bucket
* **And** retrieve signed URLs with an expiry of 10 minutes
* **And** dispatch the URLs and text to the Next.js API route
* **And** the OpenAI vision model (`gpt-4o-mini` or `gpt-4o`) MUST analyze the screenshots to transcribe the chat history and reconstruct the current conversation state.

---

### Requirement 2: Parameter Selector Controls
* **Goal**: Provide selectors to configure the parameters guiding the response output.

#### Scenario 2.1: Custom parameter extraction for prompt construction
* **Given** a user is configuring the response parameters in the UI
* **When** the user selects the following options:
  * **Platform**: Tinder
  * **Category**: Casual conversation
  * **Objective**: Get phone number
  * **Type**: Funny
  * **Intensity**: High
  * **Extension**: Short
* **Then** the UI MUST bundle these selectors in the API call payload metadata
* **And** the API MUST inject these parameters into the system prompt, enforcing that generated choices reflect a "funny tone", are "short in length", focus on "getting the phone number", and use "high intensity" phrasing in Rioplatense Spanish.

---

### Requirement 3: Supabase pgvector RAG Retrieval
* **Goal**: Search chat examples and assistant rule sets via vector similarity to feed LLM context.

#### Scenario 3.1: pgvector similarity query execution
* **Given** a transcribed chat conversation state and user instruction
* **When** the API receives the message payload
* **Then** the system MUST request a 768-dimension embedding of the payload from OpenAI's `text-embedding-3-small`
* **And** execute a cosine similarity search against the `chat_examples` and `assistant_rule_sets` tables
* **And** retrieve similar contexts and rules where cosine similarity is optimized
* **And** format these matches as background information injected directly into the prompt context for DeepSeek Pro (`deepseek-chat`).

---

### Requirement 4: Response Generation Modes
* **Goal**: Generate response options matching either Automatic Mode (4 styles) or Specific Mode (3 variants).

#### Scenario 4.1: Automatic generation mode output verification
* **Given** the response generation mode is configured to "Automatic"
* **When** the user requests responses
* **Then** the generator MUST return exactly 4 distinct response suggestions in Rioplatense Spanish
* **And** each of the 4 options MUST represent a different style (e.g., teasing, direct, mysterious, open-ended)
* **And** the UI MUST display these 4 options as individual interactive selection buttons.

#### Scenario 4.2: Specific generation mode output verification
* **Given** the response generation mode is configured to "Specific" and the style selector is set to "Funny"
* **When** the user requests responses
* **Then** the generator MUST return exactly 3 distinct variants of a "Funny" response in Rioplatense Spanish
* **And** the UI MUST display these 3 options as individual interactive selection buttons.

---

### Requirement 5: Conversational Analysis Card
* **Goal**: Display context analysis, psychological subtext, matched rules, and tactical advice.

#### Scenario 5.1: Conversational analysis card layout rendering
* **Given** a response generation has completed and returned metadata
* **When** the UI renders the assistant response panel
* **Then** the application MUST display the "Ficha de Análisis Conversacional" (Conversational Analysis Card)
* **And** this card MUST display the following sections populated with content from the generation run metadata:
  * **Context Analysis**: Overview of the conversation state.
  * **Psychological Subtext**: Subtextual motives of the other person.
  * **Applied Rules**: The subset of matching rule descriptions retrieved from `assistant_rule_sets`.
  * **Tactical Advice**: Recommended next moves.

---

### Requirement 6: User Feedback Tracking
* **Goal**: Track thumbs up/down and text comments, logging them against the generation run.

#### Scenario 6.1: Submission and validation of positive feedback
* **Given** a generation run has been logged and has a valid `generationRunId`
* **When** the user clicks the thumbs up (upvote) icon on a suggested option
* **Then** the system MUST send a POST request with the upvote action to the feedback API
* **And** write a record to `response_feedback` with `rating = true`, mapping it to the corresponding `generationRunId`
* **And** show a feedback confirmation toast in the UI.

#### Scenario 6.2: Submission and validation of negative feedback with comments
* **Given** a generation run has been logged and has a valid `generationRunId`
* **When** the user clicks the thumbs down (downvote) icon, inputs the comment "Suena demasiado agresivo", and clicks submit
* **Then** the system MUST send a POST request containing the payload to the feedback API
* **And** create a record in `response_feedback` with `rating = false` and `comment = "Suena demasiado agresivo"`, linked to the `generationRunId`
* **And** show a feedback confirmation toast in the UI.

---

## Open Questions
* **Screenshot Cleanup Lifecycle**: What is the target expiration retention time for temporary screenshots uploaded to the Supabase Storage bucket (e.g., 24 hours, 7 days)?
* **Fallback Retrieval**: If cosine similarity distance for `pgvector` queries exceeds a set threshold (e.g., distance > 0.4, meaning low similarity match), should the system fall back to category-based random sample queries or strict text matching, or just proceed without injecting examples?
