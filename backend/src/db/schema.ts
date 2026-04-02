import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  real,
} from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().default("New Session"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const treeNodes = pgTable("tree_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"), // null = root node; self-referencing FK handled at app level
  name: text("name").notNull(),
  score: real("score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const knowledgeItems = pgTable("knowledge_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => treeNodes.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "fakt" | "frage" | "inferenz" | "widerspruch"
  text: text("text").notNull(),
  source: text("source"), // e.g. "CEO", "Architect", "System"
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  agent: text("agent"), // null for user messages; "conversation" | "architect" | "devils_advocate" for agent messages
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
