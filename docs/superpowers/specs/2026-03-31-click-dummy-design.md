# Click Dummy — Conversational Requirements Engineering Platform

## Context

We need an interactive click dummy to demonstrate the core concept of a conversational requirements engineering platform. The demo shows how a stakeholder conversation naturally produces a structured, scored feature tree — without forms, workshops, or document management. No real backend or API calls; all interactions are simulated.

The demo's narrative arc: a user believes they need a PIM system, but through guided conversation the system helps them realize they actually need a data sync pipeline with auto-enrichment.

## Tech Stack

Pure HTML / CSS / JavaScript. No frameworks, no build step, no dependencies. Open `index.html` in a browser.

## File Structure

```
index.html        — Page shell, layout structure
style.css         — All styling
app.js            — Chat engine, tree renderer, animation logic
scenario.js       — PIM scenario data (conversation steps + tree mutations)
```

## Layout

Single page, two-panel layout:

- **Chat area (left, ~65-70%):** Scrollable message list + input bar at bottom
- **Feature tree panel (right, ~30-35%):** Collapsible side panel with tree visualization

**Design style:** Light background, clean sans-serif font, soft shadows. Friendly, open, professional SaaS aesthetic.

## Chat Area

### Message Types

Three visual styles, all left/right aligned in a single conversation thread:

1. **User messages** — right-aligned, distinct background color
2. **AI responses** — left-aligned, labeled "AI", different background
3. **Architect interjections** — left-aligned, labeled "Architect", accent styling (e.g., colored left border). The Architect is an agent that jumps in at key story beats.

### Input Bar

- Text input field with send button
- On the happy path: input is pre-filled with the next suggested message (user can edit or replace)
- Enter key sends the message

## Chat Simulation Engine

### Hybrid Approach

The demo supports both a scripted happy path and free-form typing:

1. User sends a message
2. Engine checks if it matches the next scripted step (via keyword matching against the step's `keywords` array)
3. **Match:** Play the scripted AI response, optional Architect interjection, and apply tree mutations
4. **No match:** Show a generic fallback response (e.g., "That's an interesting point. Could you tell me more about [current topic]?"). No tree mutations.

### Timing

- AI responses appear after a typing delay (800-1500ms)
- Architect interjections appear after an additional delay (1000-2000ms after AI response)
- Chat auto-scrolls to the latest message

### Scenario Data Structure

Each step in `scenario.js`:

```js
{
  id: 1,
  suggestedInput: "We don't have a PIM system...",
  keywords: ["pim", "product data", "no system", "managing"],
  aiResponse: "I'd love to understand more about that pain...",
  architectInterjection: null | { text: "...", delay: 1500 },
  treeMutations: [
    { action: "create", node: { id: "pim", name: "PIM Integration", parent: null, score: 8, badge: "new" } },
    { action: "update", target: "pim", changes: { score: 22 } },
    { action: "rename", target: "pim", name: "Product Data Sync Pipeline" },
    { action: "reparent", target: "data-entry", newParent: "sync-pipeline" },
    { action: "remove", target: "old-node" }
  ]
}
```

## Feature Tree Panel

### Node Display

Each tree node shows:
- Indented by depth level
- Feature name (truncated with ellipsis if long)
- Optional "new" badge (small pill)
- Clarity bar: thin horizontal bar, width proportional to score, color-coded:
  - Red: < 30%
  - Orange: 30-60%
  - Green: > 60%
- Score percentage text

### Tree Data Model

```js
{
  id: "pim",
  name: "PIM Integration",
  score: 8,
  badge: null | "new",
  children: [...]
}
```

### Animations

All via CSS transitions + JS class toggling:

- **Node creation:** slide-in from right + fade-in (300ms ease-out)
- **Score change:** bar width animates (400ms), color transitions smoothly
- **"New" badge:** scale-up pulse on appear
- **Node highlight:** brief background glow on updated nodes (fades over 1s)
- **Reparent/restructure:** old position fades out, new position slides in

## The PIM Scenario (Happy Path)

~8-10 conversation steps. Narrative arc: user thinks they need a PIM, system guides them to realize they need a sync pipeline.

### Step 1 — The pain
**User:** "We currently don't have a PIM system. All our product data is managed manually by one employee — she enters everything into spreadsheets and then copies it into our shop system and the marketplace portals. It's slow, error-prone, and she's the only one who knows how it all works."

**AI:** "That sounds like a real bottleneck — and a risk if that person is ever unavailable. Let me understand the full picture. How many products are we talking about, and how many channels does the data need to reach?"

**Tree:** Creates "Product Data Management" (12%)

### Step 2 — Scale & channels
**User:** "About 3,000 SKUs. We sell through our own webshop, Amazon, and two B2B portals. Each channel has different data requirements."

**AI:** "So the data isn't just copied — it has to be transformed per channel. That's important. What does the current process look like when a new product gets added?"

**Tree:** Creates "Multi-channel distribution" (15%, new), creates "Data transformation" (8%, new)

### Step 3 — Current workflow
**User:** "She creates the product in the shop backend, then manually adjusts descriptions and specs for Amazon, then enters it separately in each B2B portal. Takes about 2 hours per product."

**AI:** "2 hours per product across 3,000 SKUs — that's significant. It sounds like the core issue is repeated manual data entry rather than missing product information management. Do you already have a source of truth for product data, or is it scattered?"

**Architect:** "Just to flag — what we're hearing so far sounds more like a channel syndication problem than a PIM problem. The data exists, it just needs to flow to the right places in the right format."

**Tree:** Creates "Manual data entry" (20%, new), updates root to 22%

### Step 4 — The reframe
**User:** "Hm, I think the shop backend is basically our source of truth. But the data there isn't complete enough for all channels — Amazon needs different attributes than the B2B portals."

**AI:** "So the shop has the base data, but each channel needs enrichment on top of that. That's a key distinction — you don't need a new central system to hold product data. You need a way to enrich and sync what you already have."

**Tree:** Creates "Data enrichment" (10%, new), renames root to "Product Data Sync & Enrichment" (30%)

### Step 5 — The pivot
**User:** "Actually yes — we looked at full PIM systems but they all felt way too heavy. We don't need another place to manage products. We just need the data to flow automatically and be adapted per channel."

**AI:** "That's a really clear articulation. So what you actually need is: automatic sync from your shop to all channels, with per-channel data transformation and enrichment. Not a PIM — a sync pipeline."

**Architect:** "This confirms the earlier suspicion. I'm restructuring the feature tree — we're looking at a sync pipeline with enrichment, not a PIM integration."

**Tree:** Major restructure — reorganizes around "Sync Pipeline" with children: "Source connector (Shop)", "Channel adapters", "Auto-enrichment", "Attribute mapping". Old PIM nodes removed/merged.

### Steps 6-8 — Drilling into specifics
Topics: enrichment rules (auto-generate Amazon bullet points from shop descriptions), sync frequency (real-time vs batched), error handling (what happens when Amazon rejects a listing), single-person dependency (what if the employee is on vacation).

Tree nodes gain detail, scores climb to 45-55% range.

### Final State
Tree shows "Product Data Sync Pipeline" at ~55% clarity with well-defined sub-features, demonstrating how the system transformed a vague "we need a PIM" into a focused, actionable feature specification.

## Verification

1. Open `index.html` in a browser — page loads with empty chat and empty tree
2. Click through the full happy path by sending pre-filled messages
3. Verify AI responses appear with typing delay
4. Verify Architect interjections appear at steps 3 and 5
5. Verify tree nodes animate in, scores animate, badges appear
6. Verify tree restructures at step 5 (the pivot moment)
7. Type a free-form message that doesn't match any keywords — verify fallback response appears
8. Verify the tree panel can be collapsed and expanded
