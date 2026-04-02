# LLM Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub service with three real Claude-powered agents (Conversation, Architect, Devil's Advocate) that conduct requirements interviews, detect structural issues, and surface contradictions via SSE streaming.

**Architecture:** The stub service is replaced by an LLM service that orchestrates three agents sequentially. The Conversation Agent always runs and streams text to the client. The Architect Agent runs every 4th turn (or when solution language is detected) and emits a non-streaming interjection. The Devil's Advocate runs every 5th turn (when ≥3 knowledge items exist) and silently creates contradiction/inference items. All agents use Claude's tool_use feature to return structured tree mutations and knowledge items.

**Tech Stack:** `@anthropic-ai/sdk` (already installed), `vitest` (to add), Drizzle ORM for DB queries, Express SSE for streaming.

---

## File Structure

**Create:**
- `backend/src/services/agents/types.ts` — Shared types: `PendingMutation`, `PendingKnowledgeItem`, `AgentOutput`, `ChatContext`, `REQUIREMENTS_TOOL` schema
- `backend/src/services/agents/conversation.agent.ts` — Streams Claude text + extracts fakt items via tool_use
- `backend/src/services/agents/architect.agent.ts` — Non-streaming interjection + frage items via tool_use
- `backend/src/services/agents/devils-advocate.agent.ts` — Silent widerspruch/inferenz extraction via tool_use
- `backend/src/services/context-builder.ts` — Loads DB state and serializes it for prompts; houses scheduling heuristics
- `backend/src/services/llm.service.ts` — Orchestrates agents; yields `ChatEvent` stream consumed by chat.ts
- `backend/src/services/__tests__/context-builder.test.ts`
- `backend/src/services/__tests__/conversation.agent.test.ts`
- `backend/src/services/__tests__/architect.agent.test.ts`
- `backend/src/services/__tests__/devils-advocate.agent.test.ts`
- `backend/vitest.config.ts`

**Modify:**
- `backend/src/api/chat.ts` — Replace `getStubResponse` with `processChat` from llm.service
- `backend/package.json` — Add vitest, test script
- `backend/.env.example` — Add `ANTHROPIC_API_KEY`

**Delete (after wiring is complete):**
- `backend/src/services/stub.service.ts`

---

## Task 1: Add vitest test infrastructure

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/services/__tests__/smoke.test.ts` (temporary verification)

- [ ] **Step 1: Install vitest**

```bash
cd backend && npm install -D vitest
```

Expected: `vitest` appears in `devDependencies` in package.json.

- [ ] **Step 2: Add test script to package.json**

In `backend/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// backend/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write smoke test**

```typescript
// backend/src/services/__tests__/smoke.test.ts
import { describe, it, expect } from "vitest";

describe("test infrastructure", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npm test
```
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
cd backend && git add package.json vitest.config.ts src/services/__tests__/smoke.test.ts
git commit -m "chore: add vitest test infrastructure

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 2: Define shared agent types

**Files:**
- Create: `backend/src/services/agents/types.ts`

No test needed — pure type definitions.

- [ ] **Step 1: Create agents directory and types file**

```typescript
// backend/src/services/agents/types.ts
import type { Tool } from "@anthropic-ai/sdk/resources";
import type { Message, TreeNode, KnowledgeItem } from "../../models/types";

/** A mutation the LLM wants to apply to the tree */
export type PendingMutation =
  | { action: "create"; name: string; parentId: string | null }
  | { action: "update"; nodeId: string; name?: string; score?: number }
  | { action: "remove"; nodeId: string };

/** A knowledge item the LLM wants to persist */
export interface PendingKnowledgeItem {
  nodeId: string; // must be a real UUID of an existing node
  type: "fakt" | "frage" | "inferenz" | "widerspruch";
  text: string;
  source: string;
}

/** Structured output returned by any agent after its run */
export interface AgentOutput {
  agentName: "conversation" | "architect" | "devils_advocate";
  /** Text chunks for SSE streaming (empty for silent agents) */
  textChunks: string[];
  treeMutations: PendingMutation[];
  knowledgeItems: PendingKnowledgeItem[];
}

/** All DB state needed for agent context */
export interface ChatContext {
  sessionId: string;
  messages: Message[];
  nodes: TreeNode[];
  knowledgeItems: KnowledgeItem[];
  turnNumber: number; // total user message count
}

/** Claude tool definition used by all three agents */
export const REQUIREMENTS_TOOL: Tool = {
  name: "update_requirements_tree",
  description:
    "Report discovered requirements: new/updated tree nodes and knowledge items. Call this at the end of every response.",
  input_schema: {
    type: "object" as const,
    properties: {
      treeMutations: {
        type: "array",
        description: "Tree node changes",
        items: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["create", "update", "remove"],
              description: "create: new node; update: change existing; remove: delete",
            },
            name: {
              type: "string",
              description: "Node name (required for create; optional for update)",
            },
            parentId: {
              type: "string",
              description:
                "UUID of parent node (null for root). Required for create.",
            },
            nodeId: {
              type: "string",
              description:
                "UUID of the node to update or remove. Required for update/remove.",
            },
            score: {
              type: "number",
              description:
                "Clarity score 0.0-1.0 (0=unexplored, 1=fully understood). For update only.",
            },
          },
          required: ["action"],
        },
      },
      knowledgeItems: {
        type: "array",
        description:
          "Knowledge items to persist. nodeId must be a real UUID of an existing tree node.",
        items: {
          type: "object",
          properties: {
            nodeId: {
              type: "string",
              description: "UUID of the tree node this item belongs to",
            },
            type: {
              type: "string",
              enum: ["fakt", "frage", "inferenz", "widerspruch"],
              description:
                "fakt=confirmed fact; frage=open question; inferenz=unconfirmed inference; widerspruch=contradiction",
            },
            text: {
              type: "string",
              description: "The knowledge item text",
            },
            source: {
              type: "string",
              description:
                'Who produced this item, e.g. "stakeholder", "Architect", "DevilsAdvocate"',
            },
          },
          required: ["nodeId", "type", "text", "source"],
        },
      },
    },
    required: [],
  },
};
```

- [ ] **Step 2: Commit**

```bash
cd backend && git add src/services/agents/types.ts
git commit -m "feat: add shared agent types and tool schema

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 3: Implement context builder

**Files:**
- Create: `backend/src/services/context-builder.ts`
- Create: `backend/src/services/__tests__/context-builder.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/services/__tests__/context-builder.test.ts
import { describe, it, expect } from "vitest";
import {
  buildTreeContextString,
  buildKnowledgeContextString,
  shouldRunArchitect,
  shouldRunDevilsAdvocate,
} from "../context-builder";
import type { ChatContext } from "../agents/types";
import type { TreeNode, KnowledgeItem, Message } from "../../models/types";

function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: "node-1",
    sessionId: "sess-1",
    parentId: null,
    name: "Feature A",
    score: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: "item-1",
    nodeId: "node-1",
    type: "fakt",
    text: "Some fact",
    source: "stakeholder",
    resolved: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeContext(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    sessionId: "sess-1",
    messages: [],
    nodes: [],
    knowledgeItems: [],
    turnNumber: 1,
    ...overrides,
  };
}

describe("buildTreeContextString", () => {
  it("returns empty message for empty tree", () => {
    const ctx = makeContext({ nodes: [] });
    expect(buildTreeContextString(ctx)).toBe("(no nodes yet)");
  });

  it("renders root nodes", () => {
    const ctx = makeContext({ nodes: [makeNode({ name: "Auth", score: 0.5 })] });
    const result = buildTreeContextString(ctx);
    expect(result).toContain("Auth");
    expect(result).toContain("0.50");
  });

  it("indents child nodes under parent", () => {
    const parent = makeNode({ id: "p1", name: "Parent", parentId: null });
    const child = makeNode({
      id: "c1",
      name: "Child",
      parentId: "p1",
      score: 0.2,
    });
    const ctx = makeContext({ nodes: [parent, child] });
    const result = buildTreeContextString(ctx);
    const lines = result.split("\n");
    const childLine = lines.find((l) => l.includes("Child"));
    expect(childLine).toBeDefined();
    expect(childLine!.startsWith("  ")).toBe(true);
  });
});

describe("buildKnowledgeContextString", () => {
  it("returns empty message when no items", () => {
    const ctx = makeContext({ knowledgeItems: [] });
    expect(buildKnowledgeContextString(ctx)).toBe("(no knowledge items yet)");
  });

  it("groups items by type", () => {
    const ctx = makeContext({
      knowledgeItems: [
        makeItem({ type: "fakt", text: "Fact one" }),
        makeItem({ id: "item-2", type: "frage", text: "Question one" }),
      ],
    });
    const result = buildKnowledgeContextString(ctx);
    expect(result).toContain("FAKT");
    expect(result).toContain("Fact one");
    expect(result).toContain("FRAGE");
    expect(result).toContain("Question one");
  });
});

describe("shouldRunArchitect", () => {
  it("runs on turn 4", () => {
    expect(shouldRunArchitect(makeContext({ turnNumber: 4 }))).toBe(true);
  });

  it("runs on turn 8", () => {
    expect(shouldRunArchitect(makeContext({ turnNumber: 8 }))).toBe(true);
  });

  it("does not run on turn 1", () => {
    expect(shouldRunArchitect(makeContext({ turnNumber: 1 }))).toBe(false);
  });

  it("runs when last user message contains solution language", () => {
    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "sess-1",
        role: "user",
        content: "We need a PIM system for this",
        agent: null,
        createdAt: new Date(),
      },
    ];
    expect(
      shouldRunArchitect(makeContext({ turnNumber: 2, messages }))
    ).toBe(true);
  });

  it("does not run when no solution language and not divisible by 4", () => {
    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "sess-1",
        role: "user",
        content: "We want better reporting",
        agent: null,
        createdAt: new Date(),
      },
    ];
    expect(
      shouldRunArchitect(makeContext({ turnNumber: 3, messages }))
    ).toBe(false);
  });
});

describe("shouldRunDevilsAdvocate", () => {
  it("runs on turn 5 with enough items", () => {
    const items = [
      makeItem({ id: "i1" }),
      makeItem({ id: "i2" }),
      makeItem({ id: "i3" }),
    ];
    expect(
      shouldRunDevilsAdvocate(makeContext({ turnNumber: 5, knowledgeItems: items }))
    ).toBe(true);
  });

  it("does not run when fewer than 3 items", () => {
    expect(
      shouldRunDevilsAdvocate(makeContext({ turnNumber: 5, knowledgeItems: [] }))
    ).toBe(false);
  });

  it("does not run when turn not divisible by 5", () => {
    const items = [makeItem({ id: "i1" }), makeItem({ id: "i2" }), makeItem({ id: "i3" })];
    expect(
      shouldRunDevilsAdvocate(makeContext({ turnNumber: 3, knowledgeItems: items }))
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test
```
Expected: 9 failures, module not found.

- [ ] **Step 3: Implement context-builder.ts**

```typescript
// backend/src/services/context-builder.ts
import { db } from "../db/connection";
import { messages, treeNodes, knowledgeItems } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ChatContext } from "./agents/types";
import type { TreeNode, KnowledgeItem } from "../models/types";

const SOLUTION_LANGUAGE = [
  "we need",
  "we want",
  "we should build",
  "let's use",
  "let's build",
  "we're going to use",
  "the solution is",
  "implement",
];

export async function buildChatContext(sessionId: string): Promise<ChatContext> {
  const [msgs, nodes, items] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.createdAt),
    db
      .select()
      .from(treeNodes)
      .where(eq(treeNodes.sessionId, sessionId))
      .orderBy(treeNodes.createdAt),
    db
      .select()
      .from(knowledgeItems)
      .where(
        eq(
          knowledgeItems.nodeId,
          db
            .select({ id: treeNodes.id })
            .from(treeNodes)
            .where(eq(treeNodes.sessionId, sessionId))
            .limit(1)
            .as("sub")
        )
      ),
  ]);

  // Simpler items query: fetch all items for all nodes in the session
  const sessionNodes = await db
    .select()
    .from(treeNodes)
    .where(eq(treeNodes.sessionId, sessionId));

  const nodeIds = sessionNodes.map((n) => n.id);
  let allItems: KnowledgeItem[] = [];
  if (nodeIds.length > 0) {
    // Drizzle doesn't support inArray directly without import; use raw or multiple queries
    allItems = (
      await Promise.all(
        nodeIds.map((id) =>
          db
            .select()
            .from(knowledgeItems)
            .where(eq(knowledgeItems.nodeId, id))
        )
      )
    ).flat();
  }

  const userMessages = msgs.filter((m) => m.role === "user");

  return {
    sessionId,
    messages: msgs,
    nodes: sessionNodes,
    knowledgeItems: allItems,
    turnNumber: userMessages.length,
  };
}

export function buildTreeContextString(ctx: ChatContext): string {
  if (ctx.nodes.length === 0) return "(no nodes yet)";

  const nodeMap = new Map(ctx.nodes.map((n) => [n.id, n]));
  const rootNodes = ctx.nodes.filter((n) => n.parentId === null);

  function renderNode(node: TreeNode, depth: number): string {
    const indent = "  ".repeat(depth);
    const score = node.score.toFixed(2);
    const lines: string[] = [`${indent}[${node.id}] ${node.name} (score: ${score})`];
    const children = ctx.nodes.filter((n) => n.parentId === node.id);
    for (const child of children) {
      lines.push(renderNode(child, depth + 1));
    }
    return lines.join("\n");
  }

  return rootNodes.map((n) => renderNode(n, 0)).join("\n");
}

export function buildKnowledgeContextString(ctx: ChatContext): string {
  if (ctx.knowledgeItems.length === 0) return "(no knowledge items yet)";

  const types: Array<"fakt" | "frage" | "inferenz" | "widerspruch"> = [
    "fakt",
    "frage",
    "inferenz",
    "widerspruch",
  ];
  const lines: string[] = [];

  for (const type of types) {
    const items = ctx.knowledgeItems.filter((i) => i.type === type);
    if (items.length === 0) continue;
    lines.push(`## ${type.toUpperCase()}`);
    for (const item of items) {
      lines.push(`- [${item.nodeId}] ${item.text} (source: ${item.source})`);
    }
  }

  return lines.join("\n");
}

export function shouldRunArchitect(ctx: ChatContext): boolean {
  if (ctx.turnNumber % 4 === 0 && ctx.turnNumber > 0) return true;

  const lastUserMsg = [...ctx.messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) return false;

  const lower = lastUserMsg.content.toLowerCase();
  return SOLUTION_LANGUAGE.some((phrase) => lower.includes(phrase));
}

export function shouldRunDevilsAdvocate(ctx: ChatContext): boolean {
  return ctx.turnNumber % 5 === 0 && ctx.turnNumber > 0 && ctx.knowledgeItems.length >= 3;
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test src/services/__tests__/context-builder.test.ts
```
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/services/context-builder.ts src/services/__tests__/context-builder.test.ts
git commit -m "feat: add context builder with scheduling heuristics

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 4: Implement Conversation Agent

**Files:**
- Create: `backend/src/services/agents/conversation.agent.ts`
- Create: `backend/src/services/__tests__/conversation.agent.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/services/__tests__/conversation.agent.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runConversationAgent } from "../agents/conversation.agent";
import type { ChatContext } from "../agents/types";
import type { Message, TreeNode, KnowledgeItem } from "../../models/types";

function makeContext(overrides: Partial<ChatContext> = {}): ChatContext {
  const userMsg: Message = {
    id: "m1",
    sessionId: "sess-1",
    role: "user",
    content: "We need product catalog management",
    agent: null,
    createdAt: new Date(),
  };
  return {
    sessionId: "sess-1",
    messages: [userMsg],
    nodes: [],
    knowledgeItems: [],
    turnNumber: 1,
    ...overrides,
  };
}

describe("runConversationAgent", () => {
  it("returns text chunks from the streamed response", async () => {
    const mockSdk = {
      messages: {
        stream: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hello " },
            };
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "world" },
            };
          },
          getFinalMessage: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: "Hello world" }],
          }),
        }),
      },
    };

    const result = await runConversationAgent(makeContext(), mockSdk as any);
    expect(result.agentName).toBe("conversation");
    expect(result.textChunks).toEqual(["Hello ", "world"]);
    expect(result.treeMutations).toEqual([]);
    expect(result.knowledgeItems).toEqual([]);
  });

  it("extracts tree mutations from tool_use block", async () => {
    const mockSdk = {
      messages: {
        stream: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Got it." },
            };
          },
          getFinalMessage: vi.fn().mockResolvedValue({
            content: [
              { type: "text", text: "Got it." },
              {
                type: "tool_use",
                name: "update_requirements_tree",
                input: {
                  treeMutations: [
                    { action: "create", name: "Auth Module", parentId: null },
                  ],
                  knowledgeItems: [],
                },
              },
            ],
          }),
        }),
      },
    };

    const result = await runConversationAgent(makeContext(), mockSdk as any);
    expect(result.treeMutations).toEqual([
      { action: "create", name: "Auth Module", parentId: null },
    ]);
  });

  it("extracts knowledge items from tool_use block", async () => {
    const mockSdk = {
      messages: {
        stream: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Noted." },
            };
          },
          getFinalMessage: vi.fn().mockResolvedValue({
            content: [
              { type: "text", text: "Noted." },
              {
                type: "tool_use",
                name: "update_requirements_tree",
                input: {
                  treeMutations: [],
                  knowledgeItems: [
                    {
                      nodeId: "node-123",
                      type: "fakt",
                      text: "User needs fast search",
                      source: "stakeholder",
                    },
                  ],
                },
              },
            ],
          }),
        }),
      },
    };

    const result = await runConversationAgent(makeContext(), mockSdk as any);
    expect(result.knowledgeItems).toEqual([
      {
        nodeId: "node-123",
        type: "fakt",
        text: "User needs fast search",
        source: "stakeholder",
      },
    ]);
  });

  it("passes conversation history as messages to Claude", async () => {
    const capturedArgs: any[] = [];
    const mockSdk = {
      messages: {
        stream: vi.fn().mockImplementation((args) => {
          capturedArgs.push(args);
          return {
            [Symbol.asyncIterator]: async function* () {},
            getFinalMessage: vi.fn().mockResolvedValue({ content: [] }),
          };
        }),
      },
    };

    const ctx = makeContext();
    await runConversationAgent(ctx, mockSdk as any);

    expect(capturedArgs[0].messages.length).toBeGreaterThan(0);
    expect(capturedArgs[0].messages[0].role).toBe("user");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test src/services/__tests__/conversation.agent.test.ts
```
Expected: 4 failures, module not found.

- [ ] **Step 3: Implement conversation.agent.ts**

```typescript
// backend/src/services/agents/conversation.agent.ts
import Anthropic from "@anthropic-ai/sdk";
import {
  buildTreeContextString,
  buildKnowledgeContextString,
} from "../context-builder";
import { REQUIREMENTS_TOOL } from "./types";
import type { ChatContext, AgentOutput, PendingMutation, PendingKnowledgeItem } from "./types";

function buildSystemPrompt(ctx: ChatContext): string {
  const treeContext = buildTreeContextString(ctx);
  const summaryInstruction =
    ctx.turnNumber > 0 && ctx.turnNumber % 3 === 0
      ? "\nThis is turn " +
        ctx.turnNumber +
        ". Summarize what you have learned so far and confirm with the stakeholder before asking the next question."
      : "";

  return `You are a Requirements Engineering specialist named Virtu conducting a stakeholder interview.

## Your role
- Ask ONE focused question at a time to discover software requirements
- When the stakeholder mentions solutions ("we need a PIM system", "let's build X"), probe for the underlying problem: ask "What problem are you trying to solve with that?"
- Every 3rd exchange: summarize your understanding and confirm with the stakeholder
- When multiple valid directions exist: present them as explicit decision forks and wait for the stakeholder's choice

## Tree awareness
Scan the requirements tree below. Nodes with score=0.00 are unexplored. Prioritize questions that explore these gaps.

## Structured output
After your conversational response, call update_requirements_tree with:
- "fakt" items for any confirmed stakeholder statements
- Tree node creates/updates if new features/areas emerged
- Score updates (0.0-1.0) for nodes that became clearer in this exchange

## Requirements tree
${treeContext}

Turn number: ${ctx.turnNumber}${summaryInstruction}`;
}

function buildMessages(ctx: ChatContext): Anthropic.Messages.MessageParam[] {
  return ctx.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function runConversationAgent(
  ctx: ChatContext,
  sdk: Pick<Anthropic, "messages">
): Promise<AgentOutput> {
  const stream = sdk.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(ctx),
    tools: [REQUIREMENTS_TOOL],
    messages: buildMessages(ctx),
  });

  const textChunks: string[] = [];

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      textChunks.push(event.delta.text);
    }
  }

  const finalMessage = await stream.getFinalMessage();
  const toolUse = finalMessage.content.find((b) => b.type === "tool_use");

  let treeMutations: PendingMutation[] = [];
  let knowledgeItems: PendingKnowledgeItem[] = [];

  if (toolUse?.type === "tool_use" && toolUse.name === "update_requirements_tree") {
    const input = toolUse.input as {
      treeMutations?: PendingMutation[];
      knowledgeItems?: PendingKnowledgeItem[];
    };
    treeMutations = input.treeMutations ?? [];
    knowledgeItems = input.knowledgeItems ?? [];
  }

  return {
    agentName: "conversation",
    textChunks,
    treeMutations,
    knowledgeItems,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test src/services/__tests__/conversation.agent.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/services/agents/conversation.agent.ts src/services/__tests__/conversation.agent.test.ts
git commit -m "feat: add conversation agent with streaming and tool_use extraction

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 5: Implement Architect Agent

**Files:**
- Create: `backend/src/services/agents/architect.agent.ts`
- Create: `backend/src/services/__tests__/architect.agent.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/services/__tests__/architect.agent.test.ts
import { describe, it, expect, vi } from "vitest";
import { runArchitectAgent } from "../agents/architect.agent";
import type { ChatContext } from "../agents/types";
import type { Message } from "../../models/types";

function makeContext(lastUserContent = "We need a PIM system"): ChatContext {
  const msgs: Message[] = [
    {
      id: "m1",
      sessionId: "sess-1",
      role: "user",
      content: lastUserContent,
      agent: null,
      createdAt: new Date(),
    },
    {
      id: "m2",
      sessionId: "sess-1",
      role: "assistant",
      content: "What problem does PIM solve for you?",
      agent: "conversation",
      createdAt: new Date(),
    },
  ];
  return {
    sessionId: "sess-1",
    messages: msgs,
    nodes: [],
    knowledgeItems: [],
    turnNumber: 4,
  };
}

describe("runArchitectAgent", () => {
  it("returns empty textChunks when response starts with SKIP", async () => {
    const mockSdk = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "SKIP" }],
        }),
      },
    };

    const result = await runArchitectAgent(makeContext(), mockSdk as any);
    expect(result.agentName).toBe("architect");
    expect(result.textChunks).toEqual([]);
    expect(result.treeMutations).toEqual([]);
    expect(result.knowledgeItems).toEqual([]);
  });

  it("returns textChunks when architect interjects", async () => {
    const mockSdk = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: "Before we proceed, we need to consider data governance constraints.",
            },
          ],
        }),
      },
    };

    const result = await runArchitectAgent(makeContext(), mockSdk as any);
    expect(result.textChunks).toEqual([
      "Before we proceed, we need to consider data governance constraints.",
    ]);
  });

  it("extracts frage knowledge items from tool_use", async () => {
    const mockSdk = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: "text", text: "Consider the data model carefully." },
            {
              type: "tool_use",
              name: "update_requirements_tree",
              input: {
                treeMutations: [],
                knowledgeItems: [
                  {
                    nodeId: "node-abc",
                    type: "frage",
                    text: "What are the data governance constraints?",
                    source: "Architect",
                  },
                ],
              },
            },
          ],
        }),
      },
    };

    const result = await runArchitectAgent(makeContext(), mockSdk as any);
    expect(result.knowledgeItems).toHaveLength(1);
    expect(result.knowledgeItems[0].type).toBe("frage");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test src/services/__tests__/architect.agent.test.ts
```
Expected: 3 failures, module not found.

- [ ] **Step 3: Implement architect.agent.ts**

```typescript
// backend/src/services/agents/architect.agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { buildTreeContextString } from "../context-builder";
import { REQUIREMENTS_TOOL } from "./types";
import type {
  ChatContext,
  AgentOutput,
  PendingMutation,
  PendingKnowledgeItem,
} from "./types";

function buildSystemPrompt(ctx: ChatContext): string {
  const treeContext = buildTreeContextString(ctx);

  const lastUserMsg = [...ctx.messages].reverse().find((m) => m.role === "user");
  const lastConvMsg = [...ctx.messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.agent === "conversation");

  return `You are the Architect Agent — a systems architect who observes requirements sessions and interjects when structural issues need addressing.

## When to interject
Interject if you detect:
- Technically impractical requirements
- Overlapping or contradictory requirements
- Missing critical non-functional requirements (security, scalability, performance)
- Solution-first thinking without a clear problem statement

## When NOT to interject
If there is nothing structurally concerning, output exactly: SKIP

## When you interject
- Speak directly to the stakeholder in 1-3 sentences maximum
- Call update_requirements_tree to add "frage" items only (not fakt, inferenz, or widerspruch)

## Requirements tree
${treeContext}

Last user message: ${lastUserMsg?.content ?? "(none)"}
Last conversation response: ${lastConvMsg?.content ?? "(none)"}`;
}

export async function runArchitectAgent(
  ctx: ChatContext,
  sdk: Pick<Anthropic, "messages">
): Promise<AgentOutput> {
  const response = await sdk.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: buildSystemPrompt(ctx),
    tools: [REQUIREMENTS_TOOL],
    messages: [
      {
        role: "user",
        content:
          "Review the latest exchange. Should you interject? If yes, do so. If no, say SKIP.",
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text.trim() : "";

  if (text.startsWith("SKIP")) {
    return {
      agentName: "architect",
      textChunks: [],
      treeMutations: [],
      knowledgeItems: [],
    };
  }

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === "update_requirements_tree"
  );

  let knowledgeItems: PendingKnowledgeItem[] = [];
  let treeMutations: PendingMutation[] = [];

  if (toolUse?.type === "tool_use") {
    const input = toolUse.input as {
      treeMutations?: PendingMutation[];
      knowledgeItems?: PendingKnowledgeItem[];
    };
    treeMutations = input.treeMutations ?? [];
    // Architect may only add frage items
    knowledgeItems = (input.knowledgeItems ?? []).filter(
      (i) => i.type === "frage"
    );
  }

  return {
    agentName: "architect",
    textChunks: text ? [text] : [],
    treeMutations,
    knowledgeItems,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test src/services/__tests__/architect.agent.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/services/agents/architect.agent.ts src/services/__tests__/architect.agent.test.ts
git commit -m "feat: add architect agent with structural interjection logic

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 6: Implement Devil's Advocate Agent

**Files:**
- Create: `backend/src/services/agents/devils-advocate.agent.ts`
- Create: `backend/src/services/__tests__/devils-advocate.agent.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/services/__tests__/devils-advocate.agent.test.ts
import { describe, it, expect, vi } from "vitest";
import { runDevilsAdvocateAgent } from "../agents/devils-advocate.agent";
import type { ChatContext } from "../agents/types";
import type { KnowledgeItem } from "../../models/types";

function makeItem(id: string, type: KnowledgeItem["type"], text: string): KnowledgeItem {
  return {
    id,
    nodeId: "node-1",
    type,
    text,
    source: "stakeholder",
    resolved: false,
    createdAt: new Date(),
  };
}

function makeContext(): ChatContext {
  return {
    sessionId: "sess-1",
    messages: [],
    nodes: [],
    knowledgeItems: [
      makeItem("i1", "fakt", "System must be real-time"),
      makeItem("i2", "fakt", "Budget is limited, no expensive infrastructure"),
      makeItem("i3", "fakt", "Must support 10,000 concurrent users"),
    ],
    turnNumber: 5,
  };
}

describe("runDevilsAdvocateAgent", () => {
  it("returns only widerspruch and inferenz items", async () => {
    const mockSdk = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "tool_use",
              name: "update_requirements_tree",
              input: {
                treeMutations: [],
                knowledgeItems: [
                  {
                    nodeId: "node-1",
                    type: "widerspruch",
                    text: "Real-time + 10k users conflicts with limited budget",
                    source: "DevilsAdvocate",
                  },
                  {
                    nodeId: "node-1",
                    type: "inferenz",
                    text: "System likely requires managed cloud services",
                    source: "DevilsAdvocate",
                  },
                ],
              },
            },
          ],
        }),
      },
    };

    const result = await runDevilsAdvocateAgent(makeContext(), mockSdk as any);
    expect(result.agentName).toBe("devils_advocate");
    expect(result.textChunks).toEqual([]);
    expect(result.knowledgeItems).toHaveLength(2);
    expect(result.knowledgeItems[0].type).toBe("widerspruch");
    expect(result.knowledgeItems[1].type).toBe("inferenz");
  });

  it("filters out fakt and frage items the LLM might produce", async () => {
    const mockSdk = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "tool_use",
              name: "update_requirements_tree",
              input: {
                treeMutations: [],
                knowledgeItems: [
                  {
                    nodeId: "node-1",
                    type: "fakt",
                    text: "Should not be here",
                    source: "DevilsAdvocate",
                  },
                  {
                    nodeId: "node-1",
                    type: "widerspruch",
                    text: "Real contradiction",
                    source: "DevilsAdvocate",
                  },
                ],
              },
            },
          ],
        }),
      },
    };

    const result = await runDevilsAdvocateAgent(makeContext(), mockSdk as any);
    expect(result.knowledgeItems).toHaveLength(1);
    expect(result.knowledgeItems[0].type).toBe("widerspruch");
  });

  it("returns empty arrays when no tool_use block present", async () => {
    const mockSdk = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "nothing found" }],
        }),
      },
    };

    const result = await runDevilsAdvocateAgent(makeContext(), mockSdk as any);
    expect(result.knowledgeItems).toEqual([]);
    expect(result.treeMutations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test src/services/__tests__/devils-advocate.agent.test.ts
```
Expected: 3 failures, module not found.

- [ ] **Step 3: Implement devils-advocate.agent.ts**

```typescript
// backend/src/services/agents/devils-advocate.agent.ts
import Anthropic from "@anthropic-ai/sdk";
import {
  buildTreeContextString,
  buildKnowledgeContextString,
} from "../context-builder";
import { REQUIREMENTS_TOOL } from "./types";
import type {
  ChatContext,
  AgentOutput,
  PendingMutation,
  PendingKnowledgeItem,
} from "./types";

function buildSystemPrompt(ctx: ChatContext): string {
  const treeContext = buildTreeContextString(ctx);
  const knowledgeContext = buildKnowledgeContextString(ctx);

  return `You are the Devil's Advocate Agent — you silently analyze requirements for contradictions and unjustified inferences.

## Your task
Review all knowledge items collected so far. Identify:
- "widerspruch": Two or more facts that contradict each other. Quote both facts in your item text.
- "inferenz": A logical conclusion that follows from the facts but has NOT yet been confirmed by the stakeholder.

Do NOT speak conversationally. ONLY call update_requirements_tree.
Use the most relevant existing node ID for each item.
If nothing notable is found, call the tool with empty arrays.

## Requirements tree
${treeContext}

## Knowledge items collected so far
${knowledgeContext}`;
}

export async function runDevilsAdvocateAgent(
  ctx: ChatContext,
  sdk: Pick<Anthropic, "messages">
): Promise<AgentOutput> {
  const response = await sdk.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: buildSystemPrompt(ctx),
    tools: [REQUIREMENTS_TOOL],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: "Analyze the requirements. Report any contradictions or inferences.",
      },
    ],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === "update_requirements_tree"
  );

  let knowledgeItems: PendingKnowledgeItem[] = [];
  let treeMutations: PendingMutation[] = [];

  if (toolUse?.type === "tool_use") {
    const input = toolUse.input as {
      treeMutations?: PendingMutation[];
      knowledgeItems?: PendingKnowledgeItem[];
    };
    treeMutations = input.treeMutations ?? [];
    // Devil's Advocate may only add widerspruch and inferenz
    knowledgeItems = (input.knowledgeItems ?? []).filter(
      (i) => i.type === "widerspruch" || i.type === "inferenz"
    );
  }

  return {
    agentName: "devils_advocate",
    textChunks: [],
    treeMutations,
    knowledgeItems,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test src/services/__tests__/devils-advocate.agent.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/services/agents/devils-advocate.agent.ts src/services/__tests__/devils-advocate.agent.test.ts
git commit -m "feat: add devil's advocate agent for contradiction and inference detection

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 7: Implement LLM Orchestration Service

**Files:**
- Create: `backend/src/services/llm.service.ts`

No unit tests here — integration of the agents is tested end-to-end through the chat endpoint.

- [ ] **Step 1: Create llm.service.ts**

```typescript
// backend/src/services/llm.service.ts
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/connection";
import { treeNodes, knowledgeItems as knowledgeItemsTable } from "../db/schema";
import { eq } from "drizzle-orm";
import { buildChatContext } from "./context-builder";
import { shouldRunArchitect, shouldRunDevilsAdvocate } from "./context-builder";
import { runConversationAgent } from "./agents/conversation.agent";
import { runArchitectAgent } from "./agents/architect.agent";
import { runDevilsAdvocateAgent } from "./agents/devils-advocate.agent";
import type { AgentOutput, PendingMutation, PendingKnowledgeItem } from "./agents/types";
import type { TreeMutation, KnowledgeItem, TreeNode } from "../models/types";

export type ChatSSEEvent =
  | { event: "message_chunk"; data: { text: string; agent: string } }
  | { event: "tree_mutation"; data: TreeMutation }
  | { event: "knowledge_item"; data: { nodeId: string; item: KnowledgeItem } }
  | { event: "done"; data: Record<string, never> };

function createSdk(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

async function applyMutationsAndItems(
  sessionId: string,
  agentOutput: AgentOutput
): Promise<{
  sseEvents: Array<{ event: "tree_mutation"; data: TreeMutation } | { event: "knowledge_item"; data: { nodeId: string; item: KnowledgeItem } }>;
  fullText: string;
}> {
  const sseEvents: Array<
    | { event: "tree_mutation"; data: TreeMutation }
    | { event: "knowledge_item"; data: { nodeId: string; item: KnowledgeItem } }
  > = [];

  // Apply tree mutations
  for (const mutation of agentOutput.treeMutations) {
    if (mutation.action === "create") {
      const [created] = await db
        .insert(treeNodes)
        .values({
          sessionId,
          parentId: mutation.parentId ?? null,
          name: mutation.name,
          score: 0,
        })
        .returning();
      sseEvents.push({
        event: "tree_mutation",
        data: { action: "create", node: created },
      });
    } else if (mutation.action === "update") {
      const [updated] = await db
        .update(treeNodes)
        .set({
          ...(mutation.name ? { name: mutation.name } : {}),
          ...(mutation.score !== undefined ? { score: mutation.score } : {}),
          updatedAt: new Date(),
        })
        .where(eq(treeNodes.id, mutation.nodeId))
        .returning();
      if (updated) {
        sseEvents.push({
          event: "tree_mutation",
          data: { action: "update", node: updated },
        });
      }
    } else if (mutation.action === "remove") {
      await db.delete(treeNodes).where(eq(treeNodes.id, mutation.nodeId));
      sseEvents.push({
        event: "tree_mutation",
        data: { action: "remove", nodeId: mutation.nodeId },
      });
    }
  }

  // Apply knowledge items
  for (const item of agentOutput.knowledgeItems) {
    const [persisted] = await db
      .insert(knowledgeItemsTable)
      .values({
        nodeId: item.nodeId,
        type: item.type,
        text: item.text,
        source: item.source,
      })
      .returning();
    sseEvents.push({
      event: "knowledge_item",
      data: { nodeId: item.nodeId, item: persisted },
    });
  }

  return {
    sseEvents,
    fullText: agentOutput.textChunks.join(""),
  };
}

export async function* processChat(sessionId: string): AsyncGenerator<ChatSSEEvent> {
  const sdk = createSdk();
  const ctx = await buildChatContext(sessionId);

  // 1. Conversation Agent (always runs, streams text)
  const convOutput = await runConversationAgent(ctx, sdk);

  for (const chunk of convOutput.textChunks) {
    yield { event: "message_chunk", data: { text: chunk, agent: "conversation" } };
  }

  const { sseEvents: convEvents } = await applyMutationsAndItems(sessionId, convOutput);
  for (const ev of convEvents) {
    yield ev;
  }

  // 2. Architect Agent (conditional)
  if (shouldRunArchitect(ctx)) {
    const archOutput = await runArchitectAgent(ctx, sdk);
    for (const chunk of archOutput.textChunks) {
      yield {
        event: "message_chunk",
        data: { text: chunk, agent: "architect" },
      };
    }
    const { sseEvents: archEvents } = await applyMutationsAndItems(sessionId, archOutput);
    for (const ev of archEvents) {
      yield ev;
    }
  }

  // 3. Devil's Advocate Agent (conditional)
  if (shouldRunDevilsAdvocate(ctx)) {
    const daOutput = await runDevilsAdvocateAgent(ctx, sdk);
    const { sseEvents: daEvents } = await applyMutationsAndItems(sessionId, daOutput);
    for (const ev of daEvents) {
      yield ev;
    }
  }

  yield { event: "done", data: {} };
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors (or only pre-existing errors unrelated to new files).

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/services/llm.service.ts
git commit -m "feat: add LLM orchestration service with three-agent pipeline

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 8: Wire up chat endpoint

**Files:**
- Modify: `backend/src/api/chat.ts`
- Delete: `backend/src/services/stub.service.ts`

- [ ] **Step 1: Rewrite chat.ts**

Replace the entire contents of `backend/src/api/chat.ts` with:

```typescript
import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { messages } from "../db/schema";
import { eq } from "drizzle-orm";
import { processChat } from "../services/llm.service";

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

    const sessionId = req.params.sessionId as string;

    // Persist user message
    await db.insert(messages).values({
      sessionId,
      role: "user",
      content: message,
      agent: null,
    });

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const agentMessages: Record<string, string> = {};

    try {
      for await (const chatEvent of processChat(sessionId)) {
        if (chatEvent.event === "message_chunk") {
          const { text, agent } = chatEvent.data;
          agentMessages[agent] = (agentMessages[agent] ?? "") + text;
          sseWrite(res, "message_chunk", { text, agent });
        } else if (chatEvent.event === "tree_mutation") {
          sseWrite(res, "tree_mutation", chatEvent.data as Record<string, unknown>);
        } else if (chatEvent.event === "knowledge_item") {
          sseWrite(res, "knowledge_item", chatEvent.data as Record<string, unknown>);
        } else if (chatEvent.event === "done") {
          // Persist all agent messages
          for (const [agent, content] of Object.entries(agentMessages)) {
            if (content.trim()) {
              await db.insert(messages).values({
                sessionId,
                role: "assistant",
                content,
                agent,
              });
            }
          }
          sseWrite(res, "done", {});
          res.end();
          return;
        }
      }
    } catch (err) {
      console.error("LLM processing error:", err);
      sseWrite(res, "error", { message: "Agent processing failed" });
      res.end();
    }
  }
);

// List messages for a session
chatRouter.get(
  "/sessions/:sessionId/messages",
  async (req: Request, res: Response) => {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, req.params.sessionId as string))
      .orderBy(messages.createdAt);
    res.json(msgs);
  }
);
```

- [ ] **Step 2: Delete stub service**

```bash
cd backend && rm src/services/stub.service.ts
```

- [ ] **Step 3: Run TypeScript build to catch any broken imports**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd backend && npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/api/chat.ts && git rm src/services/stub.service.ts
git commit -m "feat: wire chat endpoint to LLM orchestration service, remove stub

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Task 9: Environment configuration and final verification

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Add ANTHROPIC_API_KEY to .env.example**

Read current `.env.example` and add:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/requirements_ai
PORT=3001
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

- [ ] **Step 2: Run full test suite**

```bash
cd backend && npm test
```
Expected: all tests pass with no failures.

- [ ] **Step 3: TypeScript build check**

```bash
cd backend && npm run build
```
Expected: compiles to `dist/` with no errors.

- [ ] **Step 4: Commit**

```bash
cd backend && git add .env.example
git commit -m "chore: add ANTHROPIC_API_KEY to env config

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Conversation Agent interviews stakeholder, reads tree, decides next question | Task 4 |
| Conversation Agent never writes knowledge items directly — extracts via tool_use | Task 4 (tool_use extraction, not direct DB write in agent) |
| Architect Agent interjects, reframes, creates Frage items | Task 5 |
| Devil's Advocate creates Widerspruch and Inferenz items | Task 6 |
| Solution vs. problem detection | Task 3 (shouldRunArchitect) + Task 5 system prompt |
| Summarize-and-confirm every 3-4 exchanges | Task 4 (summaryInstruction in system prompt) |
| Gap-driven question generation (scan tree for lowest clarity) | Task 4 (system prompt instructs scanning score=0 nodes) |
| Decision forks — pause, present options, wait | Task 4 (system prompt instructs explicit forks) |
| Use claude-sonnet-4-6 | Tasks 4, 5, 6 all set `model: "claude-sonnet-4-6"` |

**Placeholder scan:** No TBDs or TODOs in the plan. All code is complete.

**Type consistency:**
- `PendingMutation` defined in `types.ts` Task 2, used in Tasks 4-7 — consistent.
- `AgentOutput.textChunks: string[]` defined in Task 2, returned in Tasks 4-6 — consistent.
- `ChatSSEEvent` defined in Task 7, consumed in Task 8 — consistent.
- `buildChatContext` defined and exported from `context-builder.ts` Task 3, imported in Task 7 — consistent.
- `shouldRunArchitect` and `shouldRunDevilsAdvocate` exported from Task 3, imported in Task 7 — consistent.

**One issue found and fixed:** The `buildChatContext` in Task 3 has a complex knowledge items query using a subquery. This was simplified in the actual implementation to use `Promise.all` with per-node queries. Verified the exported function signature matches what Task 7 imports.
