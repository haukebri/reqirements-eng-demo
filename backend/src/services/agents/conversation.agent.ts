import { Mistral } from "@mistralai/mistralai";
import type { ChatContext, AgentOutput, PendingMutation, PendingKnowledgeItem } from "./types";
import { REQUIREMENTS_TOOL } from "./types";
import { serializeContextForPrompt } from "../context-builder";

const SYSTEM_PROMPT = `You are a requirements engineering assistant conducting a structured interview.
Your job is to elicit, clarify, and document software requirements through conversation.

Guidelines:
- Ask one focused question at a time
- Capture facts (fakt), questions (frage), inferences (inferenz), and contradictions (widerspruch)
- Build and maintain a requirements tree of topics/features
- Be concise and professional
- Always call update_requirements_tree at the end of your response with any discoveries

Knowledge item types:
- fakt: confirmed fact from the user
- frage: open question that needs answering
- inferenz: something you inferred that needs confirmation
- widerspruch: a contradiction or conflict you detected`;

export async function runConversationAgent(
  client: Mistral,
  ctx: ChatContext,
  userMessage: string
): Promise<AgentOutput> {
  const contextSummary = serializeContextForPrompt(ctx);
  const systemContent = contextSummary
    ? `${SYSTEM_PROMPT}\n\n${contextSummary}`
    : SYSTEM_PROMPT;

  const mistralMessages = ctx.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  mistralMessages.push({ role: "user", content: userMessage });

  const stream = await client.chat.stream({
    model: "mistral-large-latest",
    messages: [{ role: "system", content: systemContent }, ...mistralMessages],
    tools: [REQUIREMENTS_TOOL],
    toolChoice: "any",
  });

  const textChunks: string[] = [];
  let toolCallJson = "";

  for await (const chunk of stream) {
    const delta = chunk.data.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content && typeof delta.content === "string" && delta.content.length > 0) {
      textChunks.push(delta.content);
    }

    if (delta.toolCalls) {
      for (const tc of delta.toolCalls) {
        if (tc.function?.arguments) {
          toolCallJson += tc.function.arguments;
        }
      }
    }
  }

  const { treeMutations, knowledgeItems } = parseToolOutput(toolCallJson);

  return {
    agentName: "conversation",
    textChunks,
    treeMutations,
    knowledgeItems,
  };
}

function parseToolOutput(json: string): {
  treeMutations: PendingMutation[];
  knowledgeItems: PendingKnowledgeItem[];
} {
  try {
    if (!json.trim()) return { treeMutations: [], knowledgeItems: [] };
    const parsed = JSON.parse(json);
    return {
      treeMutations: parsed.treeMutations ?? [],
      knowledgeItems: parsed.knowledgeItems ?? [],
    };
  } catch {
    return { treeMutations: [], knowledgeItems: [] };
  }
}
