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
