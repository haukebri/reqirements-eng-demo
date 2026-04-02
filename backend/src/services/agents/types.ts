import type { Message, TreeNode, KnowledgeItem } from "../../models/types";

/** A mutation the LLM wants to apply to the tree */
export type PendingMutation =
  | { action: "create"; name: string; parentId: string | null }
  | { action: "update"; nodeId: string; name?: string; score?: number }
  | { action: "remove"; nodeId: string };

/** A knowledge item the LLM wants to persist */
export interface PendingKnowledgeItem {
  nodeId: string;
  type: "fakt" | "frage" | "inferenz" | "widerspruch";
  text: string;
  source: string;
}

/** Structured output returned by any agent after its run */
export interface AgentOutput {
  agentName: "conversation" | "architect" | "devils_advocate";
  /** Text chunks for SSE streaming (empty for silent agents) */
  textChunks: string[];
  treeMutations: PendingMutation[];
  knowledgeItems: PendingKnowledgeItem[];
}

/** All DB state needed for agent context */
export interface ChatContext {
  sessionId: string;
  messages: Message[];
  nodes: TreeNode[];
  knowledgeItems: KnowledgeItem[];
  turnNumber: number;
}

/** Mistral tool definition used by all three agents */
export const REQUIREMENTS_TOOL = {
  type: "function" as const,
  function: {
    name: "update_requirements_tree",
    description:
      "Report discovered requirements: new/updated tree nodes and knowledge items. Call this at the end of every response.",
    parameters: {
      type: "object" as const,
      properties: {
        treeMutations: {
          type: "array",
          description: "Tree node changes",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["create", "update", "remove"],
                description: "create: new node; update: change existing; remove: delete",
              },
              name: {
                type: "string",
                description: "Node name (required for create; optional for update)",
              },
              parentId: {
                type: "string",
                description: "UUID of parent node (null for root). Required for create.",
              },
              nodeId: {
                type: "string",
                description: "UUID of the node to update or remove. Required for update/remove.",
              },
              score: {
                type: "number",
                description: "Clarity score 0.0-1.0. For update only.",
              },
            },
            required: ["action"],
          },
        },
        knowledgeItems: {
          type: "array",
          description: "Knowledge items to persist. nodeId must be a real UUID of an existing tree node.",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string", description: "UUID of the related tree node" },
              type: {
                type: "string",
                enum: ["fakt", "frage", "inferenz", "widerspruch"],
                description: "fakt=fact, frage=question, inferenz=inference, widerspruch=contradiction",
              },
              text: { type: "string", description: "The knowledge item text" },
              source: { type: "string", description: "Who provided this (e.g. User, Architect)" },
            },
            required: ["nodeId", "type", "text", "source"],
          },
        },
      },
      required: [],
    },
  },
};
