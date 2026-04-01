# Improvements — Knowledge Nodes & Atomic Information Design

## Context

After the first click dummy, we identified that the feature tree is too shallow — it only shows feature names and clarity scores. The real value of the system is in the **knowledge it captures per feature**: facts, open questions, inferences, contradictions. These need to be visible and structured atomically.

Additionally, the RE approach itself has gaps in how the conversation steers, how agents work, and how the system tracks what it knows vs. what it still needs to learn.

## Part 1: Atomic Knowledge Nodes

### The Problem

The current tree shows:
```
Product Data Sync Pipeline  ████░░  55%
  Source Connector (Shop)    ███░░░  40%
  Channel Adapters           ██░░░░  35%
```

This tells you *what* was discussed but not *what was learned*. The actual knowledge is invisible.

### The Solution: Knowledge Nodes

Each feature node contains atomic knowledge items — individual facts, questions, inferences, and contradictions. These are the smallest unit of captured information.

**Item types:**

| Type | Meaning | Icon/Label |
|------|---------|------------|
| **Fakt** | Something the stakeholder explicitly stated | Solid dot |
| **Frage** | An open question that hasn't been answered yet | Question mark |
| **Inferenz** | Something the system inferred but the stakeholder hasn't confirmed | Dashed dot |
| **Widerspruch** | A contradiction between two statements or nodes | Warning triangle |

**Example node expanded in the tree:**

```
▼ Importer → Images                    ███░░░  42%
  ● Fakt: Bilder kommen durch den Import ins System
  ● Fakt: Bilder werden dem Produkt zugeschrieben, im "product_img" Attribut
  ● Fakt: Wir brauchen Bildgenerierung für korrekte Dimensionen
  ? Frage: Wie sollen die genauen Dimensionen für die Bilder sein?
  ◌ Inferenz: Bildformate variieren je nach Kanal (Shop vs. Amazon)
```

### How knowledge items drive the clarity score

The score formula becomes concrete and traceable:

```
score = (filled_facts / expected_facts) - penalties

penalties:
  - open question:   -0.08 each
  - inferred field:  -0.05 each
  - contradiction:   -0.15 each
```

When you look at a node at 42%, you can now *see why* — 3 facts captured, 1 open question dragging it down, 1 unconfirmed inference.

### How knowledge items are created

The extraction agents produce these via tool calls:
- Docs Reviewer → creates `Fakt` items, links to existing nodes
- Architect → creates `Frage` items, resolves existing questions
- Devil's Advocate → creates `Widerspruch` items, creates `Inferenz` items

The conversation agent never writes knowledge items. It only reads them to decide what to ask next.

### Tree panel behavior

- Nodes are **collapsed by default** — showing name, score bar, and a count badge (e.g., "3 facts, 1 question")
- Click to **expand** and see all knowledge items
- New items appear with a brief highlight animation
- Resolved questions get a strikethrough + checkmark, then fade out after a few seconds
- Contradictions are visually prominent (orange/red highlight)

---

## Part 2: Conversation Intelligence Improvements

### 2.1 — Summarize-and-confirm beats

The conversation agent shouldn't only ask the next question. It should periodically **play back understanding**:

> "Let me make sure I've got this right — your shop backend is the source of truth, but each channel needs different attributes added on top. The main pain is the 2-hour manual process per product. Is that accurate?"

**When to trigger:** After every 3-4 exchanges, or when a significant structural change happens in the tree (like the pivot at step 5). This builds trust and catches misunderstandings early.

### 2.2 — Solution vs. problem detection

When a stakeholder says "we need a PIM," they're describing a **solution**, not a problem. The system should detect this and steer toward the underlying problem:

- Solution language: "we need X", "we want to build Y", "we should get Z"
- Problem language: "it's painful to...", "we can't...", "it takes too long to..."

The conversation agent should gently redirect: "Before we dive into PIM specifically — what's the day-to-day problem that's making you think about this?"

This is what made the PIM demo scenario powerful — the system should do it systematically, not just in one scripted example.

### 2.3 — Decision forks

When the Architect (or any agent) flags a branching point — e.g., "Are we scoping just invoicing or the full order-to-cash cycle?" — the system should:

1. Pause the normal conversation flow
2. Present the fork explicitly: "Before we continue, we need to resolve this: [Option A] vs. [Option B]"
3. Wait for the stakeholder's decision
4. Branch the tree accordingly (one path gets explored, the other gets parked as a deferred scope item)

In the tree, deferred branches should be visible but dimmed.

### 2.4 — Gap-driven question generation

The killer feature: the conversation agent's next question should be driven by **gaps in the tree**, not conversational flow alone.

Logic:
1. Scan all nodes for lowest clarity scores
2. For the weakest node, find which required fields are empty or which questions are open
3. Formulate a natural question that would fill that gap

Example: Node "Channel Adapters" has no facts about error handling → agent asks: "What happens today when Amazon rejects a listing?"

The tree becomes both the **output** and the **steering mechanism**.

### 2.5 — Confidence decay

Requirements go stale. A feature discussed 3 weeks ago with no revisits should gradually lose clarity:

```
decay = 0.02 * weeks_since_last_update
adjusted_score = max(0, score - decay)
```

This surfaces nodes that need re-validation and prevents the tree from looking "done" when it's actually outdated.

### 2.6 — Stakeholder attribution

Track *who* said what. Each knowledge item should carry a source:

```
● Fakt (CEO): Bilder kommen durch den Import ins System
● Fakt (Architect): Bildformate variieren je nach Kanal
? Frage (System): Wie sollen die genauen Dimensionen sein?
```

This matters when contradictions arise — "The CEO said real-time sync, but the Architect flagged this as over-engineered for the current scale" is actionable information.

---

## Impact on the Click Dummy

To demonstrate these improvements, the click dummy needs:

1. **Expandable nodes** in the tree panel showing Fakt/Frage/Inferenz/Widerspruch items
2. **Count badges** on collapsed nodes (e.g., "3● 1?" for 3 facts, 1 question)
3. **A confirm-and-summarize beat** where the AI plays back understanding before the pivot
4. **The decision fork** at step 5 shown explicitly before the tree restructures
5. **Stakeholder labels** on each knowledge item (CEO, System, Architect)
6. **At least one contradiction** surfaced during the scenario to show the system catching inconsistencies

Note: Agent behavior (Devil's Advocate logic, cumulative context, stateful extraction) and export functionality are server-side concerns — out of scope for the click dummy.
