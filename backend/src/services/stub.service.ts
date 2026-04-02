import type { TreeMutation } from "../models/types";

export interface StubResponse {
  messageChunks: string[];
  treeMutations: TreeMutation[];
  knowledgeItems: Array<{
    nodeId: string;
    type: "fakt" | "frage" | "inferenz" | "widerspruch";
    text: string;
    source: string;
  }>;
}

const STUB_RESPONSES: StubResponse[] = [
  {
    messageChunks: [
      "Thanks for sharing that. ",
      "Let me capture that as a fact in the tree. ",
      "Can you tell me more about the scope of this feature?",
    ],
    treeMutations: [],
    knowledgeItems: [],
  },
  {
    messageChunks: [
      "Interesting. ",
      "I notice there might be a gap here — ",
      "what happens when the data is unavailable?",
    ],
    treeMutations: [],
    knowledgeItems: [],
  },
  {
    messageChunks: [
      "Let me make sure I understand correctly. ",
      "You're saying the primary concern is latency, not throughput. ",
      "Is that accurate?",
    ],
    treeMutations: [],
    knowledgeItems: [],
  },
];

let stubIndex = 0;

export function getStubResponse(_userMessage: string): StubResponse {
  const response = STUB_RESPONSES[stubIndex % STUB_RESPONSES.length];
  stubIndex++;
  return response;
}
