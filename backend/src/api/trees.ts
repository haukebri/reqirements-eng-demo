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
      .where(eq(treeNodes.sessionId, req.params.sessionId as string))
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
        sessionId: req.params.sessionId as string,
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
    .where(eq(treeNodes.id, req.params.id as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(updated);
});

treesRouter.delete("/nodes/:id", async (req: Request, res: Response) => {
  await db.delete(treeNodes).where(eq(treeNodes.id, req.params.id as string));
  res.status(204).send();
});

// --- Knowledge Items ---

treesRouter.get(
  "/nodes/:nodeId/items",
  async (req: Request, res: Response) => {
    const items = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.nodeId, req.params.nodeId as string))
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
        nodeId: req.params.nodeId as string,
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
    .where(eq(knowledgeItems.id, req.params.id as string))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(updated);
});

treesRouter.delete("/items/:id", async (req: Request, res: Response) => {
  await db.delete(knowledgeItems).where(eq(knowledgeItems.id, req.params.id as string));
  res.status(204).send();
});
