# Trivia Generation MVP

A full-stack MVP for generating novelty-aware trivia questions with Next.js App Router, Tailwind CSS, Drizzle ORM, PostgreSQL, pgvector, and the OpenAI Responses API.

## What it does

The app uses a multi-stage pipeline instead of naive one-shot generation:

1. Choose a category and balanced subtopic.
2. Retrieve recent memory from accepted trivia in the same area.
3. Generate a structured fact plan with OpenAI.
4. Score novelty using embeddings plus symbolic duplicate checks.
5. Finalize an accepted plan into a playable question.
6. Persist the trivia item, embeddings, and generation attempt.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Drizzle ORM
- PostgreSQL with pgvector
- OpenAI Node SDK using the Responses API
- Vercel-friendly server-side architecture

## File structure

```text
app/
  admin/page.tsx
  api/
    admin/recent/route.ts
    answer/route.ts
    generate/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  admin-dashboard.tsx
  trivia-app.tsx
db/
  schema.ts
lib/
  constants.ts
  db.ts
  embeddings.ts
  generation.ts
  novelty.ts
  openai.ts
  router.ts
  types.ts
  utils.ts
scripts/
  seed.ts
drizzle.config.ts
package.json
README.md
```

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create a PostgreSQL database and enable pgvector.

```sql
create database trivia_mvp;
\c trivia_mvp
create extension if not exists vector;
```

3. Copy the environment file and fill in your keys.

```bash
cp .env.example .env.local
```

4. Push the schema.

```bash
npm run db:push
```

5. Seed sample trivia data.

```bash
npm run db:seed
```

6. Run the app locally.

```bash
npm run dev
```

Open `http://localhost:3000` for the trivia UI and `http://localhost:3000/admin` for the debug view.

## Docker Compose

You can also run the app and Postgres together with Docker Compose.

1. Put your OpenAI key in [`.env.example`](/home/ben/workspace/question/.env.example) format inside `.env`.
   Keep `OPENAI_API_KEY` set. Docker Compose will inject the rest of the app settings itself.

2. Start the stack:

```bash
docker compose up --build
```

This will:

- start PostgreSQL with pgvector already available
- build the Next.js app image
- wait for Postgres to become healthy
- run `npm run db:push`
- start the app on `http://localhost:3000`

3. Seed sample data in a one-off container:

```bash
docker compose run --rm app npm run db:seed
```

4. Open:

- `http://localhost:3000`
- `http://localhost:3000/admin`

5. Stop everything:

```bash
docker compose down
```

If you want to reset the database volume too:

```bash
docker compose down -v
```

If you started the stack before the pgvector init script existed, run `docker compose down -v` once so Postgres can reinitialize with the extension enabled.

## Environment variables

See [`.env.example`](/home/ben/workspace/question/.env.example).

## pgvector notes

The schema uses native `vector(1536)` columns for both `question_embedding` and `fact_embedding`.

Recommended index setup after your tables exist:

```sql
create index if not exists trivia_embeddings_fact_embedding_idx
  on trivia_embeddings using ivfflat (fact_embedding vector_cosine_ops)
  with (lists = 100);
```

## API routes

- `POST /api/generate`
  - Input: `{ category?: string, difficulty?: string }`
  - Output: accepted trivia item plus debug metadata
- `POST /api/answer`
  - Optional helper for answer checking
- `GET /api/admin/recent`
  - Returns recent trivia items and recent generation attempts

## Local development notes

- OpenAI calls are isolated in [`lib/openai.ts`](/home/ben/workspace/question/lib/openai.ts).
- Routing logic lives in [`lib/router.ts`](/home/ben/workspace/question/lib/router.ts).
- Novelty scoring is in [`lib/novelty.ts`](/home/ben/workspace/question/lib/novelty.ts).
- The main orchestration pipeline is in [`lib/generation.ts`](/home/ben/workspace/question/lib/generation.ts).

## What to improve later

- Retry generation automatically after a rejection instead of surfacing the first rejected candidate.
- Add native pgvector column support and nearest-neighbor retrieval directly in SQL.
- Add batch generation, reranking, and a scheduled daily-question mode.
- Introduce cached subtopic summaries and richer memory compression.
- Add evaluation tooling for distractor quality and factual consistency.
