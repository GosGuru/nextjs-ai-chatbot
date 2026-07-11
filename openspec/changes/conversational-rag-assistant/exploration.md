## Exploration: Conversational RAG Assistant (Asistente RAG para conversaciones)

### Current State
Today, the application is a Next.js AI Chatbot using the Vercel AI SDK to stream chat generations.
- **AI Generation**: Integrates Grok Vision (`chat-model`) and Grok Reasoning (`chat-model-reasoning`) models through Vercel AI Gateway (`lib/ai/providers.ts`). The POST endpoint `app/(chat)/api/chat/route.ts` streams chat responses and has experimental tools (e.g., `getWeather`, `createDocument`).
- **Database (Drizzle ORM)**: Configured using PostgreSQL in `drizzle.config.ts` and `lib/db/schema.ts`. Data is stored in tables like `User`, `Chat`, `Message_v2`, `Vote_v2`, `Document`, `Suggestion`, and `Stream`.
- **Authentication**: Set up with Auth.js (`next-auth`) in `app/(auth)/auth.ts` / `auth.config.ts`, handling regular users (with credentials stored in the DB) and guest sessions (created dynamically).
- **UI Components**: The UI renders a chat feed (`components/chat.tsx`, `components/messages.tsx`) and an input bar (`components/multimodal-input.tsx`). An `Artifact` component (`components/artifact.tsx`) opens as a side panel for editing documents.
- **Dataset**: `Datasetfinal.json` is a static JSON dataset containing Tinder/conversational templates. Each template has a category (`categoria`), a situational context (`contexto_situacional`), a last message received (`ultimo_mensaje_ella`), psychological subtext (`analisis_subtexto_psicologico`), and optional response variations (`opciones`).

---

### Affected Areas
- [schema.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/db/schema.ts) — Need to define the Drizzle schema schema/table (e.g., `conversation_templates`) if storing templates in the database.
- [queries.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/db/queries.ts) — Need to add queries to search or retrieve conversation templates by similarity or category.
- [route.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/app/(chat)/api/chat/route.ts) — Need to inject the retrieved conversational RAG context into the system prompt or define a tool that the model can invoke to search templates.
- [prompts.ts](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/lib/ai/prompts.ts) — Need to adjust/extend system prompts to guide the AI model to behave as a conversational coach in Spanish, referencing the retrieved subtext and options.
- [chat.tsx](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/components/chat.tsx) — Need to integrate the conversational RAG sidebar panel or options display.
- [multimodal-input.tsx](file:///C:/Users/Maxim/OneDrive/Escritorio/Proyectos/IA seduccion/components/multimodal-input.tsx) — Need to add support/buttons to toggle the RAG assistant or select templates to auto-fill input.
- New File: `lib/ai/rag-search.ts` — Utility to parse and perform similarity search/fuzzy search over `Datasetfinal.json` (or database queries).
- New File: `components/rag-assistant-panel.tsx` — Sidebar or panel displaying matching situations, psychological subtext analysis, and response buttons.
- New File: `app/api/rag/search/route.ts` — API endpoint for searching conversation templates from the frontend.

---

### Approaches

#### 1. In-Memory Search (Local JSON Dataset)
Load `Datasetfinal.json` directly into memory at runtime and perform fast keyword matching, fuzzy matching, or Levenshtein distance calculations on the latest message.
- **Pros**:
  - Extremely fast (180KB JSON fits easily in memory).
  - No database migration or seed script needed.
  - Zero database query overhead.
- **Cons**:
  - Unsuitable if the dataset grows dynamically or if templates must be updated through an admin UI without code redeployment.
- **Effort**: Low

#### 2. Database-backed Search (PostgreSQL Full-Text Search)
Create a `conversation_templates` table in PostgreSQL via Drizzle. Import the static `Datasetfinal.json` into this table during build/migration. Perform searches using SQL queries (`ilike` or standard Postgres full-text search matching `ultimo_mensaje_ella` and `categoria`).
- **Pros**:
  - Scalable and allows dynamic additions or updates to templates from the database.
  - Keeps code and data separated.
- **Cons**:
  - Requires Drizzle migrations and custom seeding script.
  - More complex to set up.
- **Effort**: Medium

#### 3. Semantic Vector Search (PGVector)
Store the templates in a database and compute embeddings for each situation. Use `pgvector` to perform cosine similarity searches when the user sends a message.
- **Pros**:
  - Most accurate matching (captures semantic intent rather than literal keywords).
- **Cons**:
  - Requires external AI API calls (embedding generation) adding cost and latency.
  - Requires `pgvector` extension to be enabled/supported in the Postgres database.
- **Effort**: High

---

### Recommendation
We recommend **Approach 1 (In-Memory Search using a local helper)** initially for simplicity and performance. Given the size of `Datasetfinal.json` (182KB, ~100 items), loading the JSON in memory is extremely lightweight and fast. We can write a custom string-similarity function (or install `string-similarity`/`fuse.js`) to find the best match. 

If long-term requirements include managing or extending templates via the database, we can transition to **Approach 2 (Database-backed Search)** using Drizzle.

For AI integration, we recommend **Pre-generation RAG (System Prompt Injection)**:
- Extract the user's latest text.
- Find the top 1-2 matching templates.
- Dynamically append the matched contexts, subtexts, and option pathways to the system prompt in `app/(chat)/api/chat/route.ts`.
- This ensures the LLM is fully aware of the coach's guidelines and options when drafting responses.

For UI integration:
- Create `components/rag-assistant-panel.tsx` as a right-side panel (using a design similar to the existing `Artifact` sidebar).
- Display the matching situational context, psychological subtext analysis, and response buttons.
- Enable clicking an option to insert it directly into the chat input.

---

### Risks
- **Inaccurate Matching**: Literal keyword matching might fail to find relevant templates if the user's input contains slang or different phrasing than the dataset. This can be mitigated by using basic tokenization/stop-word removal and text normalization.
- **Prompt Bleed / Hallucination**: The LLM might ignore the RAG guidelines or formulate responses that are out of character. This can be mitigated with strict instructions in the Spanish-language system prompt.

---

### Ready for Proposal
Yes — The orchestrator should tell the user that the code exploration is complete, and we have proposed a detailed structure for the "Asistente RAG para conversaciones", including the affected files, tech stack alignment, and recommended implementation approach (in-memory matching with system prompt injection).
