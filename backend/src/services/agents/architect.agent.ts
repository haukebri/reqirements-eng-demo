import { Mistral } from "@mistralai/mistralai";
import type { ChatContext, AgentOutput, PendingMutation, PendingKnowledgeItem } from "./types";
import { REQUIREMENTS_TOOL } from "./types";
import { serializeContextForPrompt } from "../context-builder";

const SYSTEM_PROMPT = `You are an experienced software architect reviewing a requirements interview in progress.
Your role is to interject with structural observations and raise important questions about the architecture.

Guidelines:
- Identify missing non-functional requirements (performance, security, scalability)
- Spot structural gaps or ambiguities in the requirements tree
- Add frage (question) items for open architectural concerns
- Be brief — one focused interjection
- Always call update_requirements_tree with any questions or structural observations`;

export async function runArchitectAgent(
  client: Mistral,
  ctx: ChatContext
): Promise<AgentOutput> {
  const contextSummary = serializeContextForPrompt(ctx);
  const systemContent = `${SYSTEM_PROMPT}\n\n${contextSummary}`;

  const response = await client.chat.complete({
    model: "mistral-large-latest",
    messages: [
      { role: "system", content: systemContent },
      {
        role: "user",
        content:
          "Review the current requirements and raise one important architectural concern or gap.",
      },
    ],
    tools: [REQUIREMENTS_TOOL],
    toolChoice: "any",
  });

  const choice = response.choices?.[0];
  const textContent =
    typeof choice?.message?.content === "string" ? choice.message.content : "";
  const textChunks = textContent ? [textContent] : [];

  const toolCalls = choice?.message?.toolCalls ?? [];
  const { treeMutations, knowledgeItems } = parseToolCalls(toolCalls);

  return {
    agentName: "architect",
    textChunks,
    treeMutations,
    knowledgeItems,
  };
}

function parseToolCalls(
  toolCalls: Array<{ function?: { name?: string; arguments?: string | Record<string, unknown> } }>
): { treeMutations: PendingMutation[]; knowledgeItems: PendingKnowledgeItem[] } {
  for (const tc of toolCalls) {
    if (tc.function?.name === "update_requirements_tree" && tc.function.arguments) {
      try {
        const parsed =
          typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;
        return {
          treeMutations: parsed.treeMutations ?? [],
          knowledgeItems: parsed.knowledgeItems ?? [],
        };
      } catch {
        // ignore parse errors
      }
    }
  }
  return { treeMutations: [], knowledgeItems: [] };
}
