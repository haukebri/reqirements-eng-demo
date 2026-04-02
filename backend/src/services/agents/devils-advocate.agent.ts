import { Mistral } from "@mistralai/mistralai";
import type { ChatContext, AgentOutput, PendingMutation, PendingKnowledgeItem } from "./types";
import { REQUIREMENTS_TOOL } from "./types";
import { serializeContextForPrompt } from "../context-builder";

const SYSTEM_PROMPT = `You are a devil's advocate reviewing requirements for contradictions and risky inferences.
You run silently — your only output is through the update_requirements_tree tool.

Your job:
- Find contradictions (widerspruch) between stated requirements or facts
- Surface hidden assumptions (inferenz) that could cause problems
- Do NOT generate conversational text — only call the tool
- Be precise: reference specific requirements by their node IDs`;

export async function runDevilsAdvocateAgent(
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
          "Analyze the requirements for contradictions and risky inferences. Report findings via the tool only.",
      },
    ],
    tools: [REQUIREMENTS_TOOL],
    toolChoice: "any",
  });

  const choice = response.choices?.[0];
  const toolCalls = choice?.message?.toolCalls ?? [];
  const { treeMutations, knowledgeItems } = parseToolCalls(toolCalls);

  return {
    agentName: "devils_advocate",
    textChunks: [], // silent agent
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
