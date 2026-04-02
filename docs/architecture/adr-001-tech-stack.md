# ADR-001: Tech Stack for RequirementsAI Production Build

**Date:** 2026-04-02
**Status:** Accepted
**Author:** Engineer (Paperclip Agent)
**Context:** Transitioning the click dummy (vanilla JS) to a production application

---

## Context

The existing click dummy is a static HTML/CSS/JS file with a fully scripted scenario. The production build requires:

- Real LLM-driven conversations (not scripted keyword matching)
- Persistent sessions and knowledge trees
- Multi-agent orchestration (Conversation Agent, Architect, Devil's Advocate, Docs Reviewer)
- Structured knowledge extraction with atomic items (Fakt, Frage, Inferenz, Widerspruch)
- Real-time tree updates as the conversation progresses
- Multi-user workspaces

The specs that inform this ADR:
- `docs/superpowers/specs/2026-03-31-click-dummy-design.md`
- `docs/superpowers/specs/2026-04-01-improvements-design.md`

---

## Decisions

### 1. Frontend Framework — React

**Decision:** React with TypeScript, built with Vite.

**Rationale:**
- The tree panel with expandable nodes, animated knowledge items, and real-time score updates requires component-level state management. Vanilla JS will become unmaintainable at that complexity.
- React's reconciliation handles the tree diff/patch pattern cleanly — exactly what the `treeMutations` model in the spec describes.
- TypeScript gives us type safety for the knowledge item model (`Fakt | Frage | Inferenz | Widerspruch`) and tree node schema.
- Vite gives fast dev builds without config overhead.

**Alternatives considered:**
- Vue 3: Similar capability, smaller ecosystem, weaker TypeScript integration in practice.
- Svelte: Excellent reactivity model, but smaller talent pool and less mature component library ecosystem for a product like this.
- Vanilla JS: Worked for the demo, but the production feature set (expandable tree, knowledge panels, decision forks, confidence decay animations) would require reinventing React.

**State management:** React context + `useReducer` for tree/session state. No Redux — the scope does not justify it. If state complexity grows, Zustand is the next step.

---

### 2. Backend Stack — Node.js + Express + TypeScript

**Decision:** Single Node.js API server using Express with TypeScript.

**Rationale:**
- Keeps the stack uniform — one language (TypeScript) across frontend and backend.
- Express is minimal and well-understood; avoids framework magic.
- The Anthropic SDK (`@anthropic-ai/sdk`) has first-class Node.js support with streaming.
- LLM agent orchestration (tool calls, multi-turn loops) is straightforward in Node.js with the Anthropic SDK.

**Alternatives considered:**
- FastAPI (Python): Excellent for ML/data pipelines, but introduces a second language and deployment unit. The agent logic here is orchestration (API calls + state mutations), not tensor math — Node.js handles it fine.
- NestJS: Too much abstraction for an early-stage product. Start simple.

**Project structure:**
```
src/
  api/          — Express routes (sessions, conversations, trees)
  agents/       — Agent definitions (conversation, architect, devil's advocate, docs reviewer)
  services/     — LLM client, extraction pipeline, session management
  models/       — TypeScript interfaces for tree nodes, knowledge items, sessions
  db/           — Database access layer (repositories)
```

---

### 3. Database — PostgreSQL

**Decision:** PostgreSQL for all persistent data.

**Rationale:**
- The knowledge tree is a directed tree (adjacency list pattern). PostgreSQL handles this well with recursive CTEs.
- JSONB columns give flexibility for knowledge item payloads while keeping structure queryable.
- Single database engine reduces operational complexity.
- Strong support for the confidence decay query: `SELECT nodes WHERE last_updated_at < NOW() - INTERVAL '1 week'`.

**Schema outline:**

```sql
sessions        (id, workspace_id, created_at, updated_at)
tree_nodes      (id, session_id, parent_id, name, score, created_at, updated_at)
knowledge_items (id, node_id, type, text, source, resolved, created_at)
messages        (id, session_id, role, content, agent, created_at)
workspaces      (id, name, created_at)
users           (id, workspace_id, email, created_at)
```

**ORM:** Drizzle ORM — lightweight, type-safe, and code-first. Avoids the heaviness of Prisma's generated client while keeping TypeScript types tight.

**Alternatives considered:**
- MongoDB: JSONB in Postgres gives the same flexibility without losing relational integrity.
- SQLite: Fine for development, not production-grade for multi-user workspaces.

---

### 4. LLM Integration — Anthropic Claude (claude-sonnet-4-6)

**Decision:** Anthropic Claude `claude-sonnet-4-6` for all agents, via `@anthropic-ai/sdk`.

**Rationale:**
- The spec defines 4 agents: Conversation, Architect, Devil's Advocate, Docs Reviewer. All are orchestration agents that read tree state and produce structured outputs (knowledge items, questions, contradictions). This maps directly to Claude's tool use / structured output capabilities.
- `claude-sonnet-4-6` is the current best balance of capability and speed for interactive applications.
- The Anthropic SDK's streaming support enables real-time response rendering in the chat UI.

**Agent orchestration pattern:**
- Each agent is a system prompt + tool definitions.
- After each user message, the Conversation Agent runs first and produces a response.
- The Architect and Devil's Advocate run in parallel after the Conversation Agent finishes (they read the transcript, not the live stream).
- Extraction agents produce structured JSON tool calls → these are written as knowledge items to the database → frontend receives SSE updates.

**Tool definitions for extraction:**
```typescript
add_knowledge_item(node_id, type: "fakt"|"frage"|"inferenz"|"widerspruch", text, source)
update_tree_node(node_id, changes: {name?, score?, parent_id?})
create_tree_node(name, parent_id, score)
resolve_knowledge_item(item_id)
flag_contradiction(item_id_a, item_id_b, reason)
```

---

### 5. Real-time — Server-Sent Events (SSE)

**Decision:** SSE for streaming LLM output and tree updates.

**Rationale:**
- SSE is unidirectional (server → client), which matches our data flow exactly: the server processes LLM output and pushes tree mutations and message chunks to the client.
- Simpler than WebSocket — no handshake protocol, no connection state management on the client. Native browser support via `EventSource`.
- A single SSE stream per session handles both the chat message stream and tree mutation events.

**Event types:**
```
event: message_chunk   data: {"text": "..."}
event: tree_mutation   data: {"action": "create"|"update"|"remove", "node": {...}}
event: knowledge_item  data: {"node_id": "...", "item": {...}}
event: agent_event     data: {"agent": "architect", "text": "..."}
event: done            data: {}
```

**Alternatives considered:**
- WebSocket: Justified when the client also needs to push high-frequency events. Our client sends one message at a time — SSE is sufficient.
- Polling: Unacceptable latency for a chat interface.

---

### 6. Multi-tenancy — Workspace-Scoped Sessions

**Decision:** Simple workspace model. Each workspace contains users and sessions. No row-level security in v1 — all users in a workspace share access to all sessions in that workspace.

**Rationale:**
- The primary use case is a single team (or consultant + client) working through a requirements session together.
- Simplicity first: RLS and fine-grained permissions are a v2 concern after we validate the product.

**Auth:** JWT tokens (short-lived access + refresh). `jsonwebtoken` library. No OAuth in v1 — email/password is sufficient for early users.

---

## Summary Table

| Concern | Decision | Alternative considered |
|---|---|---|
| Frontend | React + TypeScript + Vite | Vue, Svelte, Vanilla JS |
| Backend | Node.js + Express + TypeScript | FastAPI, NestJS |
| Database | PostgreSQL + Drizzle ORM | MongoDB, SQLite |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) | OpenAI GPT-4o |
| Real-time | Server-Sent Events (SSE) | WebSocket, polling |
| Auth | JWT (email/password) | OAuth, Clerk |
| Multi-tenancy | Workspace model, shared access | Per-user isolation |

---

## Consequences

**Positive:**
- Single language (TypeScript) across the entire stack reduces context switching.
- PostgreSQL + adjacency list handles all tree operations without a graph database.
- SSE is simpler to implement, debug, and deploy than WebSocket.
- Starting with Claude Sonnet gives high-quality agent output without the cost of Opus.

**Risks and mitigations:**
- Node.js concurrency: LLM calls are I/O-bound, so the async model is fine. Use a worker pool if CPU-bound work (e.g., parsing large documents) becomes a bottleneck.
- SSE connection limits: Most browsers support 6 concurrent SSE connections per origin. This is not a concern for single-session use.
- Schema evolution: Use Drizzle's migration runner from day one. Never mutate the schema manually.

---

## Next Steps

This ADR unblocks:
1. [VIR-8](/VIR/issues/VIR-8) — Implement backend skeleton (API + database + session management)
2. Frontend scaffold task (to be created) — React app shell with tree panel and chat
3. Agent implementation task — Conversation + Architect agents with tool use
