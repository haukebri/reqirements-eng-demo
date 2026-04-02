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
