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
    .where(eq(sessions.id, req.params.id as string));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

sessionsRouter.delete("/:id", async (req: Request, res: Response) => {
  await db.delete(sessions).where(eq(sessions.id, req.params.id as string));
  res.status(204).send();
});
