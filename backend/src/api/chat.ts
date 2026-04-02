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

    let fullResponse = "";

    try {
      for await (const event of processChat(sessionId, message)) {
        if (event.type === "message_chunk") {
          sseWrite(res, "message_chunk", { text: event.text });
          fullResponse += event.text;
        } else if (event.type === "tree_mutation") {
          sseWrite(res, "tree_mutation", event.mutation);
        } else if (event.type === "knowledge_item") {
          sseWrite(res, "knowledge_item", { nodeId: event.nodeId, item: event.item });
        } else if (event.type === "done") {
          // Persist assistant message
          await db.insert(messages).values({
            sessionId,
            role: "assistant",
            content: fullResponse,
            agent: "conversation",
          });
          sseWrite(res, "done", {});
        }
      }
    } catch (err) {
      sseWrite(res, "error", { message: err instanceof Error ? err.message : "Unknown error" });
    }

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
      .where(eq(messages.sessionId, req.params.sessionId as string))
      .orderBy(messages.createdAt);
    res.json(msgs);
  }
);
