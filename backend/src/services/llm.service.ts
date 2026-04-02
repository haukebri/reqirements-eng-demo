import { Mistral } from "@mistralai/mistralai";
import { db } from "../db/connection";
import { treeNodes, knowledgeItems } from "../db/schema";
import { eq } from "drizzle-orm";
import { buildChatContext, shouldRunArchitect, shouldRunDevilsAdvocate } from "./context-builder";
import { runConversationAgent } from "./agents/conversation.agent";
import { runArchitectAgent } from "./agents/architect.agent";
import { runDevilsAdvocateAgent } from "./agents/devils-advocate.agent";
import type { AgentOutput, PendingMutation, PendingKnowledgeItem } from "./agents/types";

export type ChatEvent =
  | { type: "message_chunk"; text: string }
  | { type: "tree_mutation"; mutation: Record<string, unknown> }
  | { type: "knowledge_item"; nodeId: string; item: Record<string, unknown> }
  | { type: "done" };

function getMistralClient(): Mistral {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY environment variable is not set");
  return new Mistral({ apiKey });
}

export async function* processChat(
  sessionId: string,
  userMessage: string
): AsyncGenerator<ChatEvent> {
  const client = getMistralClient();
  const ctx = await buildChatContext(sessionId);

  // Always run the conversation agent (streams text)
  const convOutput = await runConversationAgent(client, ctx, userMessage);
  for (const chunk of convOutput.textChunks) {
    yield { type: "message_chunk", text: chunk };
  }

  // Apply mutations and yield events from conversation agent
  yield* applyAgentOutput(convOutput);

  // Optionally run the architect agent (every 4th turn)
  if (shouldRunArchitect(ctx)) {
    const archOutput = await runArchitectAgent(client, ctx);
    for (const chunk of archOutput.textChunks) {
      yield { type: "message_chunk", text: "\n\n**Architect:** " + chunk };
    }
    yield* applyAgentOutput(archOutput);
  }

  // Optionally run the devil's advocate agent (every 5th turn, silent)
  if (shouldRunDevilsAdvocate(ctx)) {
    const daOutput = await runDevilsAdvocateAgent(client, ctx);
    yield* applyAgentOutput(daOutput);
  }

  yield { type: "done" };
}

async function* applyAgentOutput(output: AgentOutput): AsyncGenerator<ChatEvent> {
  for (const mutation of output.treeMutations) {
    const result = await applyTreeMutation(mutation);
    if (result) {
      yield { type: "tree_mutation", mutation: result as Record<string, unknown> };
    }
  }

  for (const item of output.knowledgeItems) {
    const persisted = await persistKnowledgeItem(item);
    if (persisted) {
      yield {
        type: "knowledge_item",
        nodeId: item.nodeId,
        item: persisted as Record<string, unknown>,
      };
    }
  }
}

async function applyTreeMutation(
  mutation: PendingMutation
): Promise<Record<string, unknown> | null> {
  try {
    if (mutation.action === "create") {
      const [node] = await db
        .insert(treeNodes)
        .values({
          sessionId: mutation.parentId ?? "",
          parentId: mutation.parentId,
          name: mutation.name,
          score: 0,
        })
        .returning();
      return { action: "create", node };
    }

    if (mutation.action === "update") {
      const updates: Record<string, unknown> = {};
      if (mutation.name !== undefined) updates.name = mutation.name;
      if (mutation.score !== undefined) updates.score = mutation.score;
      if (Object.keys(updates).length === 0) return null;

      const [node] = await db
        .update(treeNodes)
        .set(updates)
        .where(eq(treeNodes.id, mutation.nodeId))
        .returning();
      return node ? { action: "update", node } : null;
    }

    if (mutation.action === "remove") {
      await db.delete(treeNodes).where(eq(treeNodes.id, mutation.nodeId));
      return { action: "remove", nodeId: mutation.nodeId };
    }
  } catch {
    // Silently skip invalid mutations (e.g. bad UUIDs from LLM)
  }
  return null;
}

async function persistKnowledgeItem(
  item: PendingKnowledgeItem
): Promise<Record<string, unknown> | null> {
  try {
    const [persisted] = await db
      .insert(knowledgeItems)
      .values({
        nodeId: item.nodeId,
        type: item.type,
        text: item.text,
        source: item.source,
      })
      .returning();
    return persisted ?? null;
  } catch {
    return null;
  }
}
