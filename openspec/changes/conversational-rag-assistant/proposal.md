# Proposal: Conversational RAG Assistant

## Intent
The goal of this change is to upgrade the conversational AI assistant from using generic prompts to a sophisticated Retrieval-Augmented Generation (RAG) agent. It will act as a Spanish conversational/dating coach using Supabase PostgreSQL (`pgvector`), OpenAI embeddings, OpenAI vision for screenshot extraction, DeepSeek Pro for response generation, and rules-based guiding logic. This allows retrieving real tinder/dialogue contexts and psychological strategies to suggest response options.

## Scope
### In Scope
- Define and migrate database tables (`chat_examples`, `assistant_rule_sets`, `generation_runs`, `response_feedback`) using Drizzle ORM on Supabase.
- Enable and configure PostgreSQL `pgvector` extension for 768-dimension embeddings.
- Implement an ingestion command `pnpm ingest:examples` that parses `data/chat-examples.jsonl`, computes embeddings using OpenAI (`text-embedding-3-small`, configured to return 768-dimension vectors), and stores them in `chat_examples`.
- Support multi-image uploads (1 to 5 screenshots) to a private temporary Supabase Storage bucket.
- Update the system generation pipeline in the chat API (`app/(chat)/api/chat/route.ts`) to:
  - Extract text/context from uploaded screenshots (1 to 5 files) using OpenAI (`gpt-4o-mini` or `gpt-4o`).
  - Generate prompt embeddings using OpenAI (`text-embedding-3-small`, configured to return 768-dimension vectors).
  - Search similar situations and instructions using `pgvector` cosine similarity.
  - Dynamically construct a system prompt containing retrieved context, options, and rules.
  - Execute response generation with DeepSeek Pro (`deepseek-chat`) to stream responses.
- Build UI integration displaying matching contexts, psychological subtext, response rules, and option buttons.
- Build feedback capture (`response_feedback`) to log thumbs up/down and text comments on responses.

### Out of Scope
- Public hosting of screenshots or media (screenshots are stored temporarily in a private bucket with short-lived access tokens).
- Non-vector search approaches (in-memory parsing or keyword index parsing) as the primary retrieval method.
- Real-time video/audio analysis (limited strictly to 1-5 screenshots and text inputs).

## Capabilities
### New Capabilities
- `vector-similarity-search`: Ability to run cosine similarity queries via `pgvector` directly through Drizzle ORM on `chat_examples`.
- `multimodal-context-extraction`: Parsing of 1 to 5 uploaded screenshots in a single chat turn using OpenAI (`gpt-4o-mini` or `gpt-4o`) to rebuild conversation state before processing the RAG query.
- `seed-dataset-pipeline`: A command line script (`pnpm ingest:examples`) to feed the RAG vector store using OpenAI embeddings.
- `rule-set-matching`: Injecting custom guidelines from `assistant_rule_sets` matching current dialogue states.
- `generation-run-monitoring`: Storing metadata of generation runs (`generation_runs`) to track matched templates and rules.
- `user-feedback-collection`: Upvoting/downvoting response options and saving results in `response_feedback`.

### Modified Capabilities
- `chat-pipeline-orchestration`: Updated [route.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/app/(chat)/api/chat/route.ts) to run vector search, load rules, track run logs, and orchestrate OpenAI extraction and DeepSeek Pro generation instead of previous model setups.
- `multimodal-input-component`: Updated [multimodal-input.tsx](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/components/multimodal-input.tsx) UI component to accept up to 5 screenshot files and preview them properly.

## Approach
- **Database Schema**: 
  We will add definition tables using Drizzle's `pgvector` extension helper:
  - `chat_examples`: fields for `id` (UUID), `category` (text), `situational_context` (text), `last_message` (text), `psychological_subtext` (text), `options` (jsonb), and `embedding` (vector(768)).
  - `assistant_rule_sets`: fields for `id` (UUID), `name` (text), `rules` (text[]), `embedding` (vector(768)), and `createdAt` (timestamp).
  - `generation_runs`: fields for `id` (UUID), `chatId` (UUID references Chat), `prompt` (text), `response` (text), `matchedExamples` (jsonb), `matchedRules` (jsonb), and `createdAt` (timestamp).
  - `response_feedback`: fields for `id` (UUID), `generationRunId` (UUID references generation_runs), `rating` (integer/boolean), `comment` (text), and `createdAt` (timestamp).
- **Vision/Screenshot Extraction**:
  - Context extraction from uploaded images (1 to 5 screenshots) will be handled by OpenAI (`gpt-4o-mini` or `gpt-4o`). This reconstructs the chat thread transcripts or conversational status.
- **Embeddings and Generation**:
  - Embedding computation will utilize OpenAI's `text-embedding-3-small` model, configured to return dimensions size of 768.
  - Response generation calls will utilize DeepSeek Pro (`deepseek-chat`) to stream outputs back to the client.
- **Temporary Uploads**:
  - The frontend will perform multi-image uploads to a private Supabase bucket called `temporary_screenshots`.
  - When the message is sent, the API resolves signed URLs for the screenshots, passes them to OpenAI vision model for extraction, and deletes or ignores them after processing (subject to bucket lifecycle policies).

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| [lib/db/schema.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/db/schema.ts) | High | Define new tables, relations, and enable the `pgvector` types. |
| [app/(chat)/api/chat/route.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/app/(chat)/api/chat/route.ts) | High | Update the Next.js API route to run RAG matching, execute OpenAI vision screenshot parsing, log runs, and stream from DeepSeek Pro. |
| [components/multimodal-input.tsx](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/components/multimodal-input.tsx) | Medium | Enhance UI element to support up to 5 screenshot uploads, display upload progress, and render thumbnails. |
| package.json | Low | Register OpenAI and DeepSeek client libraries (or Vercel AI SDK equivalents). |
| New File: `lib/db/ingest.ts` | Medium | Ingestion logic mapping `data/chat-examples.jsonl` objects to `chat_examples` records using OpenAI embeddings. |
| New File: `lib/ai/rag-search.ts` | Medium | RAG vector similarity search logic querying the database. |

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Database vector search latency | Low | Embedding queries are cached or retrieved efficiently using indexing on the vector column. |
| API rate limits or latency on DeepSeek / OpenAI | Medium | Implement proper error handling, fallback behaviors, and configure appropriate timeouts. |
| Database migration issues on remote Supabase instances | Medium | Run local migration tests before pushing to production. Maintain backward compatibility in tables. |
| Exceeding the 5-screenshot limit or bucket quotas | Low | Add client-side validation to block uploads > 5 images and set short retention/lifecycle rules on the temporary Supabase bucket. |
| Subtext retrieval inaccuracy | Medium | Fine-tune the similarity matching thresholds and combine it with full-text fuzzy matching if cosine distance returns poor results. |

## Rollback Plan
- Run the migration downgrade or delete the newly created tables (`chat_examples`, `assistant_rule_sets`, `generation_runs`, `response_feedback`).
- Revert additions in [schema.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/db/schema.ts) and generate a rollback migration.
- Revert changes to [route.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/app/(chat)/api/chat/route.ts) and [multimodal-input.tsx](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/components/multimodal-input.tsx) back to their respective git commit HEADs.
- Clean up any temporary files or storage configurations on Supabase bucket.

## Success Criteria
- [ ] Database tables are created with `pgvector` support and configured with 768-dimension embeddings.
- [ ] `pnpm ingest:examples` runs successfully, populating `chat_examples` with generated embeddings using OpenAI's `text-embedding-3-small` (768 dimensions).
- [ ] Chat endpoint is able to extract conversation state from up to 5 screenshots using OpenAI (`gpt-4o-mini` or `gpt-4o`).
- [ ] The generated assistant response incorporates contextually matching conversation examples and rules, and is completed using DeepSeek Pro (`deepseek-chat`).
- [ ] User feedback (upvote/downvote and commentary) is logged correctly in `response_feedback`.
