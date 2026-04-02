import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { sessions, treeNodes, knowledgeItems, messages } from "../db/schema";

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type TreeNode = InferSelectModel<typeof treeNodes>;
export type NewTreeNode = InferInsertModel<typeof treeNodes>;

export type KnowledgeItem = InferSelectModel<typeof knowledgeItems>;
export type NewKnowledgeItem = InferInsertModel<typeof knowledgeItems>;

export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;

export type KnowledgeItemType = "fakt" | "frage" | "inferenz" | "widerspruch";

export type TreeMutation =
  | { action: "create"; node: TreeNode }
  | { action: "update"; node: TreeNode }
  | { action: "remove"; nodeId: string };
