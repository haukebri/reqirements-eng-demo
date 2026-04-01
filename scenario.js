window.SCENARIO = {
  initialTopic: "product data management",

  fallbackResponses: [
    "That's an interesting point. Could you tell me more about how that relates to your product data workflow?",
    "I'd like to explore that further. How does this connect to the challenges you mentioned?",
    "Good thought. Let's come back to that — can you walk me through the current process in a bit more detail?",
    "Noted. To make sure I understand the full picture — how does that fit into your day-to-day operations?"
  ],

  steps: [
    // Step 1: The pain
    {
      id: 1,
      suggestedInput: "We currently don't have a PIM system. All our product data is managed manually by one employee — she enters everything into spreadsheets and then copies it into our shop system and the marketplace portals. It's slow, error-prone, and she's the only one who knows how it all works.",
      keywords: ["pim", "product data", "no system", "spreadsheet", "manually", "managing", "one employee", "shop system"],
      aiResponse: "That sounds like a real bottleneck — and a risk if that person is ever unavailable. Let me understand the full picture. How many products are we talking about, and how many channels does the data need to reach?",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "root", name: "Product Data Management", parent: null, score: 12, badge: "new" } }
      ]
    },

    // Step 2: Scale & channels
    {
      id: 2,
      suggestedInput: "About 3,000 SKUs. We sell through our own webshop, Amazon, and two B2B portals. Each channel has different data requirements.",
      keywords: ["3000", "sku", "webshop", "amazon", "b2b", "channels", "different requirements", "portals"],
      aiResponse: "So the data isn't just copied — it has to be transformed per channel. That's important. What does the current process look like when a new product gets added?",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "multi-channel", name: "Multi-Channel Distribution", parent: "root", score: 15, badge: "new" } },
        { action: "create", node: { id: "data-transform", name: "Data Transformation", parent: "root", score: 8, badge: "new" } }
      ]
    },

    // Step 3: Current workflow
    {
      id: 3,
      suggestedInput: "She creates the product in the shop backend, then manually adjusts descriptions and specs for Amazon, then enters it separately in each B2B portal. Takes about 2 hours per product.",
      keywords: ["shop backend", "manually", "adjust", "descriptions", "amazon", "2 hours", "enters", "separately", "portal"],
      aiResponse: "2 hours per product across 3,000 SKUs — that's significant. It sounds like the core issue is repeated manual data entry rather than missing product information management. Do you already have a source of truth for product data, or is it scattered?",
      architectInterjection: {
        text: "Just to flag — what we're hearing so far sounds more like a channel syndication problem than a PIM problem. The data exists, it just needs to flow to the right places in the right format.",
        delay: 1500
      },
      treeMutations: [
        { action: "create", node: { id: "manual-entry", name: "Manual Data Entry", parent: "root", score: 20, badge: "new" } },
        { action: "update", target: "root", changes: { score: 22 } }
      ]
    },

    // Step 4: The reframe
    {
      id: 4,
      suggestedInput: "Hm, I think the shop backend is basically our source of truth. But the data there isn't complete enough for all channels — Amazon needs different attributes than the B2B portals.",
      keywords: ["source of truth", "shop backend", "not complete", "amazon", "different attributes", "b2b"],
      aiResponse: "So the shop has the base data, but each channel needs enrichment on top of that. That's a key distinction — you don't need a new central system to hold product data. You need a way to enrich and sync what you already have.",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "enrichment", name: "Data Enrichment", parent: "root", score: 10, badge: "new" } },
        { action: "rename", target: "root", name: "Product Data Sync & Enrichment" },
        { action: "update", target: "root", changes: { score: 30 } }
      ]
    },

    // Step 5: The pivot
    {
      id: 5,
      suggestedInput: "Actually yes — we looked at full PIM systems but they all felt way too heavy. We don't need another place to manage products. We just need the data to flow automatically and be adapted per channel.",
      keywords: ["pim", "too heavy", "don't need", "flow automatically", "adapted", "per channel", "automatic"],
      aiResponse: "That's a really clear articulation. So what you actually need is: automatic sync from your shop to all channels, with per-channel data transformation and enrichment. Not a PIM — a sync pipeline.",
      architectInterjection: {
        text: "This confirms the earlier suspicion. I'm restructuring the feature tree — we're looking at a sync pipeline with enrichment, not a PIM integration.",
        delay: 1800
      },
      treeMutations: [
        { action: "remove", target: "manual-entry" },
        { action: "remove", target: "multi-channel" },
        { action: "remove", target: "data-transform" },
        { action: "remove", target: "enrichment" },
        { action: "rename", target: "root", name: "Product Data Sync Pipeline" },
        { action: "update", target: "root", changes: { score: 38 } },
        { action: "create", node: { id: "source-connector", name: "Source Connector (Shop)", parent: "root", score: 30, badge: "new" } },
        { action: "create", node: { id: "channel-adapters", name: "Channel Adapters", parent: "root", score: 20, badge: "new" } },
        { action: "create", node: { id: "auto-enrichment", name: "Auto-Enrichment Engine", parent: "root", score: 15, badge: "new" } },
        { action: "create", node: { id: "attribute-mapping", name: "Attribute Mapping", parent: "root", score: 18, badge: "new" } }
      ]
    },

    // Step 6: Enrichment rules
    {
      id: 6,
      suggestedInput: "For Amazon, we'd need to auto-generate bullet points from our shop descriptions, and translate technical specs into Amazon's attribute format. The B2B portals need EAN codes and custom fields added.",
      keywords: ["bullet points", "amazon", "translate", "specs", "attribute", "ean", "custom fields", "auto-generate"],
      aiResponse: "So the enrichment is actually rule-based transformation — take source data, apply channel-specific rules to produce the right output format. For Amazon that means text reformatting, for B2B it means field augmentation. How often does this mapping logic change?",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "text-reformatting", name: "Text Reformatting Rules", parent: "auto-enrichment", score: 25, badge: "new" } },
        { action: "create", node: { id: "field-augmentation", name: "Field Augmentation (B2B)", parent: "auto-enrichment", score: 20, badge: "new" } },
        { action: "update", target: "auto-enrichment", changes: { score: 35 } },
        { action: "update", target: "root", changes: { score: 42 } }
      ]
    },

    // Step 7: Sync frequency
    {
      id: 7,
      suggestedInput: "The mapping rules rarely change — maybe once a quarter. But product updates happen daily. We'd need changes to reach Amazon within a few hours, B2B portals can be overnight.",
      keywords: ["daily", "rarely change", "few hours", "overnight", "real-time", "batch", "frequency", "quarter"],
      aiResponse: "That gives us clear sync requirements: near-real-time for Amazon (say, every 2-4 hours), nightly batch for B2B portals. The transformation rules themselves can be versioned and updated manually. What about error cases — what happens today when Amazon rejects a listing?",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "sync-scheduler", name: "Sync Scheduler", parent: "source-connector", score: 30, badge: "new" } },
        { action: "create", node: { id: "amazon-adapter", name: "Amazon Adapter (Near-RT)", parent: "channel-adapters", score: 28, badge: "new" } },
        { action: "create", node: { id: "b2b-adapter", name: "B2B Adapter (Nightly Batch)", parent: "channel-adapters", score: 22, badge: "new" } },
        { action: "update", target: "channel-adapters", changes: { score: 35 } },
        { action: "update", target: "source-connector", changes: { score: 40 } },
        { action: "update", target: "root", changes: { score: 48 } }
      ]
    },

    // Step 8: Error handling
    {
      id: 8,
      suggestedInput: "Right now, nobody notices until a customer complains or she checks manually. We'd need some kind of notification when a sync fails, and ideally a way to see what went wrong and retry.",
      keywords: ["nobody notices", "customer complains", "notification", "sync fails", "retry", "went wrong", "error", "check"],
      aiResponse: "Error visibility is critical for a pipeline like this. We're looking at three things: monitoring and alerting when syncs fail, a dashboard showing sync status across channels, and a retry mechanism — ideally automatic for transient failures, manual for data issues.",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "error-handling", name: "Error Handling & Monitoring", parent: "root", score: 22, badge: "new" } },
        { action: "create", node: { id: "alerting", name: "Failure Alerting", parent: "error-handling", score: 18, badge: "new" } },
        { action: "create", node: { id: "sync-dashboard", name: "Sync Status Dashboard", parent: "error-handling", score: 15, badge: "new" } },
        { action: "create", node: { id: "retry-mechanism", name: "Retry Mechanism", parent: "error-handling", score: 12, badge: "new" } },
        { action: "update", target: "root", changes: { score: 52 } }
      ]
    },

    // Step 9: Single-person dependency
    {
      id: 9,
      suggestedInput: "The biggest worry honestly is that our employee who does all this could be on vacation or leave. Right now everything stops. We need this to be automated so it just runs.",
      keywords: ["vacation", "leave", "one person", "stops", "automated", "runs", "worry", "dependency", "bus factor"],
      aiResponse: "That's the operational resilience angle — and it's a strong argument for automation. If the pipeline handles sync and enrichment automatically, the day-to-day doesn't depend on any single person. She becomes the person who manages the rules and handles exceptions, not the person who does every sync manually.",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "ops-resilience", name: "Operational Resilience", parent: "root", score: 30, badge: "new" } },
        { action: "create", node: { id: "auto-run", name: "Fully Automated Sync Runs", parent: "ops-resilience", score: 25, badge: "new" } },
        { action: "create", node: { id: "exception-mgmt", name: "Exception Management UI", parent: "ops-resilience", score: 18, badge: "new" } },
        { action: "update", target: "attribute-mapping", changes: { score: 38 } },
        { action: "update", target: "root", changes: { score: 55 } }
      ]
    },

    // Step 10: Wrap-up
    {
      id: 10,
      suggestedInput: "This is really helpful. I came in thinking we needed a PIM, but this sync pipeline approach makes much more sense for us.",
      keywords: ["helpful", "pim", "sync pipeline", "makes sense", "thank", "good", "exactly", "right"],
      aiResponse: "That's exactly the kind of clarity this process is designed to produce. You started with 'we need a PIM' and we've uncovered that what you actually need is a product data sync pipeline with auto-enrichment, channel-specific adapters, error handling, and operational resilience. The feature tree captures all of this at 55% clarity — there's more to define, but the foundation is solid and actionable.",
      architectInterjection: {
        text: "Final summary: the tree has evolved from a vague PIM request into a structured sync pipeline specification with 5 major feature areas. Recommended next step: deep-dive sessions on the auto-enrichment rules and channel adapter specifications to push clarity above 70%.",
        delay: 2000
      },
      treeMutations: [
        { action: "update", target: "root", changes: { score: 55 } },
        { action: "update", target: "source-connector", changes: { score: 45 } },
        { action: "update", target: "channel-adapters", changes: { score: 40 } },
        { action: "update", target: "auto-enrichment", changes: { score: 42 } },
        { action: "update", target: "error-handling", changes: { score: 28 } },
        { action: "update", target: "ops-resilience", changes: { score: 35 } }
      ]
    }
  ]
};
