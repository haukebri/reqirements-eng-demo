import { db } from "../db/connection";
import { messages, treeNodes, knowledgeItems } from "../db/schema";
import { eq, asc } from "drizzle-orm";
import type { ChatContext } from "./agents/types";

export async function buildChatContext(sessionId: string): Promise<ChatContext> {
  const [msgs, nodes, items] = await Promise.all([
    db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(asc(messages.createdAt)),
    db.select().from(treeNodes).where(eq(treeNodes.sessionId, sessionId)).orderBy(asc(treeNodes.createdAt)),
    db.select().from(knowledgeItems).orderBy(asc(knowledgeItems.createdAt)),
  ]);

  const turnNumber = msgs.filter((m) => m.role === "user").length;

  return { sessionId, messages: msgs, nodes, knowledgeItems: items, turnNumber };
}

export function serializeContextForPrompt(ctx: ChatContext): string {
  const lines: string[] = [];

  if (ctx.nodes.length > 0) {
    lines.push("## Requirements Tree");
    for (const node of ctx.nodes) {
      const parent = node.parentId ? ctx.nodes.find((n) => n.id === node.parentId) : null;
      lines.push(`- [${node.id}] ${node.name} (score: ${node.score}${parent ? `, parent: ${parent.name}` : ""})`);
    }
  }

  if (ctx.knowledgeItems.length > 0) {
    lines.push("\n## Knowledge Items");
    for (const item of ctx.knowledgeItems) {
      lines.push(`- [${item.type}] ${item.text} (source: ${item.source})`);
    }
  }

  return lines.join("\n");
}

/** Returns true if Architect agent should run this turn */
export function shouldRunArchitect(ctx: ChatContext): boolean {
  return ctx.turnNumber > 0 && ctx.turnNumber % 4 === 0;
}

/** Returns true if Devil's Advocate agent should run this turn */
export function shouldRunDevilsAdvocate(ctx: ChatContext): boolean {
  return ctx.turnNumber > 0 && ctx.turnNumber % 5 === 0 && ctx.knowledgeItems.length >= 3;
}
