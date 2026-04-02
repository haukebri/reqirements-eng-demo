# Backend Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Node.js/Express/TypeScript backend with PostgreSQL (Drizzle ORM) providing session CRUD, feature tree CRUD, knowledge item CRUD, and a stub chat turn endpoint with SSE streaming.

**Architecture:** Single Express server in `backend/` at the repo root. Drizzle ORM manages the schema and migrations. The chat endpoint streams SSE events with stub LLM responses — no real LLM calls in this task. All API routes are prefixed `/api`.

**Tech Stack:** Node.js 20+, Express 4, TypeScript 5, Drizzle ORM + drizzle-kit, PostgreSQL (via `pg`), `tsx` for dev, `uuid` for IDs.

---

## File Map

| File | Purpose |
|------|---------|
| `backend/package.json` | Dependencies and npm scripts |
| `backend/tsconfig.json` | TypeScript config |
| `backend/.env.example` | Required env vars |
| `backend/drizzle.config.ts` | Drizzle Kit config (points to schema, migrations folder, DB URL) |
| `backend/src/index.ts` | Express app init, route mounting, server listen |
| `backend/src/db/connection.ts` | Creates and exports the Drizzle `db` instance |
| `backend/src/db/schema.ts` | All Drizzle table definitions |
| `backend/src/db/migrate.ts` | Standalone migration runner (runs on startup or via `npm run migrate`) |
| `backend/src/models/types.ts` | TypeScript types inferred from the Drizzle schema |
| `backend/src/api/sessions.ts` | Express Router: session CRUD |
| `backend/src/api/trees.ts` | Express Router: tree node CRUD + knowledge item CRUD |
| `backend/src/api/chat.ts` | Express Router: chat turn endpoint (SSE) |
| `backend/src/services/stub.service.ts` | Returns deterministic stub LLM responses and tree mutations |

---

## Task 1: Project scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/drizzle.config.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "requirements-ai-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "cors": "^2.8.5",
    "drizzle-orm": "^0.41.0",
    "express": "^4.21.2",
    "pg": "^8.13.3",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.1",
    "@types/node": "^22.14.0",
    "@types/pg": "^8.11.11",
    "@types/uuid": "^10.0.0",
    "drizzle-kit": "^0.30.4",
    "tsx": "^4.19.3",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "drizzle.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `backend/.env.example`**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/requirements_ai
PORT=3001
```

- [ ] **Step 4: Create `backend/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 5: Install dependencies**

```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend project (package.json, tsconfig, drizzle config)

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 2: Database schema

**Files:**
- Create: `backend/src/db/schema.ts`
- Create: `backend/src/models/types.ts`

- [ ] **Step 1: Create `backend/src/db/schema.ts`**

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().default("New Session"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const treeNodes = pgTable("tree_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"), // null = root node; self-referencing FK handled at app level
  name: text("name").notNull(),
  score: real("score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const knowledgeItems = pgTable("knowledge_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => treeNodes.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "fakt" | "frage" | "inferenz" | "widerspruch"
  text: text("text").notNull(),
  source: text("source"), // e.g. "CEO", "Architect", "System"
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  agent: text("agent"), // null for user messages; "conversation" | "architect" | "devils_advocate" for agent messages
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Create `backend/src/models/types.ts`**

```typescript
import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { sessions, treeNodes, knowledgeItems, messages } from "../db/schema";

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type TreeNode = InferSelectModel<typeof treeNodes>;
export type NewTreeNode = InferInsertModel<typeof treeNodes>;

export type KnowledgeItem = InferSelectModel<typeof knowledgeItems>;
export type NewKnowledgeItem = InferInsertModel<typeof knowledgeItems>;

export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;

export type KnowledgeItemType = "fakt" | "frage" | "inferenz" | "widerspruch";

export type TreeMutation =
  | { action: "create"; node: TreeNode }
  | { action: "update"; node: TreeNode }
  | { action: "remove"; nodeId: string };
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/
git commit -m "feat: add Drizzle schema (sessions, tree_nodes, knowledge_items, messages)

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 3: Database connection and migration runner

**Files:**
- Create: `backend/src/db/connection.ts`
- Create: `backend/src/db/migrate.ts`

- [ ] **Step 1: Create `backend/src/db/connection.ts`**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 2: Generate migration files**

```bash
cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/requirements_ai npx drizzle-kit generate
```

Expected: `backend/drizzle/` folder created with a `0000_*.sql` migration file.

- [ ] **Step 3: Create `backend/src/db/migrate.ts`**

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
  console.log("Migrations complete");
  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/ backend/drizzle/
git commit -m "feat: add database connection and migration runner

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 4: Session CRUD API

**Files:**
- Create: `backend/src/api/sessions.ts`

Routes:
- `GET  /api/sessions` — list all sessions
- `POST /api/sessions` — create session
- `GET  /api/sessions/:id` — get session by ID
- `DELETE /api/sessions/:id` — delete session

- [ ] **Step 1: Create `backend/src/api/sessions.ts`**

```typescript
import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { sessions } from "../db/schema";
import { eq } from "drizzle-orm";

export const sessionsRouter = Router();

sessionsRouter.get("/", async (_req: Request, res: Response) => {
  const all = await db.select().from(sessions).orderBy(sessions.createdAt);
  res.json(all);
});

sessionsRouter.post("/", async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  const [session] = await db
    .insert(sessions)
    .values({ name: name ?? "New Session" })
    .returning();
  res.status(201).json(session);
});

sessionsRouter.get("/:id", async (req: Request, res: Response) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, req.params.id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

sessionsRouter.delete("/:id", async (req: Request, res: Response) => {
  await db.delete(sessions).where(eq(sessions.id, req.params.id));
  res.status(204).send();
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/api/sessions.ts
git commit -m "feat: add session CRUD API routes

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 5: Feature tree CRUD API

**Files:**
- Create: `backend/src/api/trees.ts`

Routes:
- `GET  /api/sessions/:sessionId/nodes` — list all nodes for session
- `POST /api/sessions/:sessionId/nodes` — create node
- `PATCH /api/nodes/:id` — update node (name, score, parentId)
- `DELETE /api/nodes/:id` — delete node
- `GET  /api/nodes/:nodeId/items` — list knowledge items for node
- `POST /api/nodes/:nodeId/items` — create knowledge item
- `PATCH /api/items/:id` — update knowledge item (resolved, text)
- `DELETE /api/items/:id` — delete knowledge item

- [ ] **Step 1: Create `backend/src/api/trees.ts`**

```typescript
import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { treeNodes, knowledgeItems } from "../db/schema";
import { eq } from "drizzle-orm";
import type { KnowledgeItemType } from "../models/types";

export const treesRouter = Router();

// --- Tree Nodes ---

treesRouter.get(
  "/sessions/:sessionId/nodes",
  async (req: Request, res: Response) => {
    const nodes = await db
      .select()
      .from(treeNodes)
      .where(eq(treeNodes.sessionId, req.params.sessionId))
      .orderBy(treeNodes.createdAt);
    res.json(nodes);
  }
);

treesRouter.post(
  "/sessions/:sessionId/nodes",
  async (req: Request, res: Response) => {
    const { name, parentId, score } = req.body as {
      name: string;
      parentId?: string;
      score?: number;
    };
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [node] = await db
      .insert(treeNodes)
      .values({
        sessionId: req.params.sessionId,
        name,
        parentId: parentId ?? null,
        score: score ?? 0,
      })
      .returning();
    res.status(201).json(node);
  }
);

treesRouter.patch("/nodes/:id", async (req: Request, res: Response) => {
  const { name, score, parentId } = req.body as {
    name?: string;
    score?: number;
    parentId?: string | null;
  };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (score !== undefined) updates.score = score;
  if (parentId !== undefined) updates.parentId = parentId;

  const [updated] = await db
    .update(treeNodes)
    .set(updates)
    .where(eq(treeNodes.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(updated);
});

treesRouter.delete("/nodes/:id", async (req: Request, res: Response) => {
  await db.delete(treeNodes).where(eq(treeNodes.id, req.params.id));
  res.status(204).send();
});

// --- Knowledge Items ---

treesRouter.get(
  "/nodes/:nodeId/items",
  async (req: Request, res: Response) => {
    const items = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.nodeId, req.params.nodeId))
      .orderBy(knowledgeItems.createdAt);
    res.json(items);
  }
);

treesRouter.post(
  "/nodes/:nodeId/items",
  async (req: Request, res: Response) => {
    const { type, text, source } = req.body as {
      type: KnowledgeItemType;
      text: string;
      source?: string;
    };
    if (!type || !text) {
      res.status(400).json({ error: "type and text are required" });
      return;
    }
    const [item] = await db
      .insert(knowledgeItems)
      .values({
        nodeId: req.params.nodeId,
        type,
        text,
        source: source ?? null,
      })
      .returning();
    res.status(201).json(item);
  }
);

treesRouter.patch("/items/:id", async (req: Request, res: Response) => {
  const { resolved, text } = req.body as {
    resolved?: boolean;
    text?: string;
  };
  const updates: Record<string, unknown> = {};
  if (resolved !== undefined) updates.resolved = resolved;
  if (text !== undefined) updates.text = text;

  const [updated] = await db
    .update(knowledgeItems)
    .set(updates)
    .where(eq(knowledgeItems.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(updated);
});

treesRouter.delete("/items/:id", async (req: Request, res: Response) => {
  await db.delete(knowledgeItems).where(eq(knowledgeItems.id, req.params.id));
  res.status(204).send();
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/api/trees.ts
git commit -m "feat: add feature tree and knowledge item CRUD API routes

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 6: Stub service

**Files:**
- Create: `backend/src/services/stub.service.ts`

This service returns deterministic stub responses so the chat endpoint works end-to-end without a real LLM.

- [ ] **Step 1: Create `backend/src/services/stub.service.ts`**

```typescript
import type { TreeMutation } from "../models/types";

export interface StubResponse {
  messageChunks: string[];
  treeMutations: TreeMutation[];
  knowledgeItems: Array<{
    nodeId: string;
    type: "fakt" | "frage" | "inferenz" | "widerspruch";
    text: string;
    source: string;
  }>;
}

const STUB_RESPONSES: StubResponse[] = [
  {
    messageChunks: [
      "Thanks for sharing that. ",
      "Let me capture that as a fact in the tree. ",
      "Can you tell me more about the scope of this feature?",
    ],
    treeMutations: [],
    knowledgeItems: [],
  },
  {
    messageChunks: [
      "Interesting. ",
      "I notice there might be a gap here — ",
      "what happens when the data is unavailable?",
    ],
    treeMutations: [],
    knowledgeItems: [],
  },
  {
    messageChunks: [
      "Let me make sure I understand correctly. ",
      "You're saying the primary concern is latency, not throughput. ",
      "Is that accurate?",
    ],
    treeMutations: [],
    knowledgeItems: [],
  },
];

let stubIndex = 0;

export function getStubResponse(_userMessage: string): StubResponse {
  const response = STUB_RESPONSES[stubIndex % STUB_RESPONSES.length];
  stubIndex++;
  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/stub.service.ts
git commit -m "feat: add stub LLM service for chat endpoint

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 7: Chat turn endpoint (SSE)

**Files:**
- Create: `backend/src/api/chat.ts`

Route: `POST /api/sessions/:sessionId/chat`

Request body: `{ message: string }`

Response: SSE stream with events:
- `message_chunk` — `{ text: string }`
- `tree_mutation` — `{ action: "create"|"update"|"remove", node?: TreeNode, nodeId?: string }`
- `knowledge_item` — `{ nodeId: string, item: KnowledgeItem }`
- `done` — `{}`

- [ ] **Step 1: Create `backend/src/api/chat.ts`**

```typescript
import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { messages, knowledgeItems } from "../db/schema";
import { eq } from "drizzle-orm";
import { getStubResponse } from "../services/stub.service";

export const chatRouter = Router();

function sseWrite(
  res: Response,
  event: string,
  data: Record<string, unknown>
): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

chatRouter.post(
  "/sessions/:sessionId/chat",
  async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string };
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // Persist user message
    await db.insert(messages).values({
      sessionId: req.params.sessionId,
      role: "user",
      content: message,
      agent: null,
    });

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stub = getStubResponse(message);
    let fullResponse = "";

    // Stream message chunks
    for (const chunk of stub.messageChunks) {
      sseWrite(res, "message_chunk", { text: chunk });
      fullResponse += chunk;
      // Simulate streaming delay (50ms between chunks)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Emit tree mutations
    for (const mutation of stub.treeMutations) {
      sseWrite(res, "tree_mutation", mutation as Record<string, unknown>);
    }

    // Emit knowledge items and persist them
    for (const kItem of stub.knowledgeItems) {
      const [persisted] = await db
        .insert(knowledgeItems)
        .values({
          nodeId: kItem.nodeId,
          type: kItem.type,
          text: kItem.text,
          source: kItem.source,
        })
        .returning();
      sseWrite(res, "knowledge_item", {
        nodeId: kItem.nodeId,
        item: persisted,
      });
    }

    // Persist assistant message
    await db.insert(messages).values({
      sessionId: req.params.sessionId,
      role: "assistant",
      content: fullResponse,
      agent: "conversation",
    });

    sseWrite(res, "done", {});
    res.end();
  }
);

// List messages for a session
chatRouter.get(
  "/sessions/:sessionId/messages",
  async (req: Request, res: Response) => {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, req.params.sessionId))
      .orderBy(messages.createdAt);
    res.json(msgs);
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/api/chat.ts
git commit -m "feat: add SSE chat turn endpoint with stub responses

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 8: Wire up Express app

**Files:**
- Create: `backend/src/index.ts`

- [ ] **Step 1: Create `backend/src/index.ts`**

```typescript
import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessionsRouter } from "./api/sessions";
import { treesRouter } from "./api/trees";
import { chatRouter } from "./api/chat";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use("/api/sessions", sessionsRouter);
app.use("/api", treesRouter);
app.use("/api", chatRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Install dotenv** (needed for `dotenv/config` import)

```bash
cd backend && npm install dotenv
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat: wire up Express app with all routes

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 9: Smoke test and final commit

- [ ] **Step 1: Create a `.env` file from the example**

```bash
cd backend && cp .env.example .env
# Edit DATABASE_URL if your Postgres is on a different port/credentials
```

- [ ] **Step 2: Run migrations (requires Postgres running)**

```bash
cd backend && npm run migrate
```

Expected: "Migrations complete"

- [ ] **Step 3: Start the server**

```bash
cd backend && npm run dev
```

Expected: `Backend running on http://localhost:3001`

- [ ] **Step 4: Smoke test health endpoint**

```bash
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Smoke test session creation**

```bash
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Session"}'
```

Expected: JSON with `id`, `name`, `createdAt`.

- [ ] **Step 6: Smoke test chat (SSE)**

```bash
SESSION_ID=<id-from-step-5>
curl -X POST http://localhost:3001/api/sessions/$SESSION_ID/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

Expected: SSE stream with `message_chunk` events and a final `done` event.

- [ ] **Step 7: Final commit with readme note**

```bash
cd backend
git add .
git commit -m "feat: complete backend skeleton (VIR-8)

- Session CRUD: GET/POST /api/sessions, GET/DELETE /api/sessions/:id
- Tree node CRUD: GET/POST /api/sessions/:id/nodes, PATCH/DELETE /api/nodes/:id
- Knowledge item CRUD: GET/POST /api/nodes/:id/items, PATCH/DELETE /api/items/:id
- Chat turn endpoint: POST /api/sessions/:id/chat (SSE streaming)
- Message history: GET /api/sessions/:id/messages
- PostgreSQL schema with Drizzle ORM migrations
- Stub LLM service (no real LLM calls)

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```
