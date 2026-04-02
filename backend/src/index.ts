import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import { sessionsRouter } from "./api/sessions";
import { treesRouter } from "./api/trees";
import { chatRouter } from "./api/chat";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "../../public");
  app.use(express.static(publicDir));
}

app.use("/api/sessions", sessionsRouter);
app.use("/api", treesRouter);
app.use("/api", chatRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "../../public");
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
