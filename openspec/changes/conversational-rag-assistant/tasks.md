# Tasks: Conversational RAG Assistant

## Review Workload Forecast
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
Estimated lines changed: ~1300

---

## Phase 1: Database schemas & DB migrations

- [ ] **Task 1.1: Enable pgvector and define vector custom type in Drizzle**
  - Path: [schema.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/db/schema.ts)
  - Details: Implement the `pgVector` custom type mapper for Drizzle ORM to support `vector(768)` fields.

- [ ] **Task 1.2: Define tables for RAG assistant**
  - Path: [schema.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/db/schema.ts)
  - Details: Define the following database tables:
    - `chat_examples` (stores context templates and 768-dimension embeddings)
    - `assistant_rule_sets` (stores prompt rule configurations and embeddings)
    - `generation_runs` (logs prompt, response, matched examples, and matched rules)
    - `response_feedback` (captures upvotes, downvotes, and optional textual comments)

- [ ] **Task 1.3: Generate and run database migrations**
  - Commands: `pnpm db:generate` followed by `pnpm db:migrate` or `pnpm db:push`.
  - Details: Verify the Drizzle-generated SQL creates the `pgvector` extension and matching tables on the Supabase PostgreSQL database.

- [ ] **Task 1.4: Implement similarity search and logging queries**
  - Path: [queries.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/db/queries.ts)
  - Details: Define database query functions:
    - `findSimilarExamples(promptEmbedding: number[], limit?: number)` using pgvector cosine distance operations (`<=>`).
    - `findSimilarRuleSets(promptEmbedding: number[], limit?: number)`
    - `insertGenerationRun(...)` to log metadata.
    - `insertResponseFeedback(...)` to write user ratings.

---

## Phase 2: RAG core libraries (embeddings, pgvector, prompt generation) & CLI seed script

- [ ] **Task 2.1: Install dependencies and register CLI commands**
  - Path: [package.json](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/package.json)
  - Details: Install required packages: `@supabase/supabase-js`, `@supabase/ssr`, `openai`, `@ai-sdk/openai`, and `dotenv`. Register the CLI seed command: `ingest:examples` referencing `lib/db/ingest.ts`.

- [ ] **Task 2.2: Register OpenAI and DeepSeek Pro providers**
  - Path: [providers.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/ai/providers.ts)
  - Details: Register OpenAI (`text-embedding-3-small` for 768-dimension embeddings, `gpt-4o-mini` / `gpt-4o` for vision extraction) and configure DeepSeek Pro (`deepseek-chat`) via custom OpenAI-compatible endpoint configurations or Vercel AI SDK.

- [ ] **Task 2.3: Establish RAG payload and feedback types**
  - Path: [types.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/types.ts)
  - Details: Add TypeScript type contracts for `ChatGenerationPayload`, `FeedbackPayload`, and the server-sent metadata package `rag-metadata`.

- [ ] **Task 2.4: Build the RAG Search Orchestrator service**
  - Path: `lib/ai/rag-search.ts` (New File)
  - Details: Implement search orchestration logic to fetch 768-dimension embeddings for inputs from OpenAI's `text-embedding-3-small` and perform query execution against `chat_examples` and `assistant_rule_sets`.

- [ ] **Task 2.5: Design Rioplatense coach system prompts and template compilers**
  - Path: [prompts.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/ai/prompts.ts)
  - Details: Formulate helper functions that combine retrieved contexts, user control selectors, Rioplatense instructions (forcing tokens like "vos", "tenés", "estás", "querés"), and format requirements into the system prompt.

- [ ] **Task 2.6: Create the JSONL seed ingestion script**
  - Path: `lib/db/ingest.ts` (New File)
  - Details: Parse `data/chat-examples.jsonl`, call OpenAI's `text-embedding-3-small` to construct 768-dimension embeddings, seed `chat_examples`, and seed initial guidelines in `assistant_rule_sets`.

---

## Phase 3: Backend API routes (extract, generate, feedback)

- [ ] **Task 3.1: Update main chat POST API route for RAG streaming**
  - Path: [route.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/app/\(chat\)/api/chat/route.ts)
  - Details: Update the Next.js API endpoint to:
    - Retrieve signed URLs for uploaded screenshots from the `temporary_screenshots` private Supabase bucket.
    - Feed screenshot contents (1 to 5 files) to OpenAI vision model (`gpt-4o-mini` or `gpt-4o`) to transcribe and reconstruct conversation state.
    - Call RAG search using OpenAI embeddings to fetch relevant templates/rules.
    - Generate structured response options (either 4 distinct styles or 3 variants) and analysis metadata.
    - Stream responses to client using DeepSeek Pro (`deepseek-chat`), appending the `rag-metadata` chunk containing analysis and options.
    - Log execution stats in `generation_runs`.

- [ ] **Task 3.2: Implement manual search endpoint**
  - Path: `app/\(chat\)/api/rag/search/route.ts` (New File)
  - Details: Create a GET/POST route allowing client-side tests or controls to manually query similarity templates.

- [ ] **Task 3.3: Create feedback collection API route**
  - Path: `app/\(chat\)/api/rag/feedback/route.ts` (New File)
  - Details: Build a POST route to process user rating events (upvotes/downvotes, text comments) and save them to `response_feedback`.

---

## Phase 4: Frontend UI workspace & controls

- [ ] **Task 4.1: Extend file upload controls and support up to 5 screenshots**
  - Path: [multimodal-input.tsx](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/components/multimodal-input.tsx)
  - Details: Update image uploads to enforce the 1-5 screenshot boundaries. Include progress displays, thumbnail list previews, and file criteria validation (JPEG/PNG/WEBP, <10MB).
  - Add selector UI dropdowns or interactive elements for parameters: Platform, Category, Objective, Style, Intensity, Length, and Generation Mode.

- [ ] **Task 4.2: Build the right-side Conversational Analysis Card panel**
  - Path: `components/rag-assistant-panel.tsx` (New File)
  - Details: Build the RAG panel displaying:
    - Context Analysis
    - Psychological Subtext
    - Applied Rules list
    - Tactical Advice
    - Suggested response option buttons (4 or 3 based on mode selection).

- [ ] **Task 4.3: Build feedback buttons and comment dialogs**
  - Path: `components/feedback-button.tsx` (New File)
  - Details: Implement upvote and downvote actions for generated options. For downvotes, show a modal text-area popup for users to enter their comments, then POST to `/api/rag/feedback`.

- [ ] **Task 4.4: Integrate the RAG panel into the chat viewport layout**
  - Path: [chat.tsx](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/components/chat.tsx)
  - Details: Anchor the `rag-assistant-panel` beside the message stream layout. Toggle its visibility when generation runs finish or when options are loaded.

---

## Phase 5: Testing (Playwright / integration tests) & verification

- [ ] **Task 5.1: Create unit tests for DB queries and prompt rendering**
  - Details: Write tests mapping custom `pgVector` serializations, verification of cosine calculations, and checking prompt compilers contain the correct Rioplatense guidelines.

- [ ] **Task 5.2: Write Playwright E2E tests for upload limits**
  - Details: Validate that attempting to attach a 6th screenshot blocks the upload and raises the alert message `"Límite superado: podés subir un máximo de 5 capturas de pantalla."`

- [ ] **Task 5.3: Write Playwright E2E tests for the RAG flow**
  - Details: Simulate a 3-screenshot upload with specified custom parameters, mocking the LLM API and database templates. Verify that the Conversational Analysis Card renders properly with correct values.

- [ ] **Task 5.4: Write Playwright E2E tests for the feedback logs**
  - Details: Trigger upvotes and comment submissions, and assert that the POST calls to `/api/rag/feedback` successfully write records to `response_feedback` in the database.

- [ ] **Task 5.5: Final formatting and lint audit**
  - Commands: Run `pnpm lint:fix` to resolve Biome checks and run the test suite using `pnpm test`.
