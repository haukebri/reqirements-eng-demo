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
        { action: "create", node: { id: "root", name: "Product Data Management", parent: null, score: 12 } },
        { action: "addItems", target: "root", items: [
          { id: "ki-1", type: "fakt", text: "No PIM system in place", source: "CEO", resolved: false },
          { id: "ki-2", type: "fakt", text: "One employee manages all data manually", source: "CEO", resolved: false },
          { id: "ki-3", type: "frage", text: "What happens if this employee is unavailable?", source: "System", resolved: false }
        ]}
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
        { action: "create", node: { id: "multi-channel", name: "Multi-Channel Distribution", parent: "root", score: 15 } },
        { action: "create", node: { id: "data-transform", name: "Data Transformation", parent: "root", score: 8 } },
        { action: "addItems", target: "multi-channel", items: [
          { id: "ki-4", type: "fakt", text: "Approximately 3,000 SKUs in catalog", source: "CEO", resolved: false },
          { id: "ki-5", type: "fakt", text: "Sales via webshop, Amazon, and 2 B2B portals", source: "CEO", resolved: false }
        ]},
        { action: "addItems", target: "data-transform", items: [
          { id: "ki-6", type: "inferenz", text: "Each channel has its own data requirements", source: "System", resolved: false }
        ]}
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
        { action: "create", node: { id: "manual-entry", name: "Manual Data Entry", parent: "root", score: 20 } },
        { action: "update", target: "root", changes: { score: 22 } },
        { action: "addItems", target: "manual-entry", items: [
          { id: "ki-7", type: "fakt", text: "Products are created in the shop backend", source: "CEO", resolved: false },
          { id: "ki-8", type: "fakt", text: "Then manually adjusted for Amazon and entered into B2B portals", source: "CEO", resolved: false },
          { id: "ki-9", type: "fakt", text: "Approximately 2 hours of effort per product", source: "CEO", resolved: false },
          { id: "ki-10", type: "inferenz", text: "This sounds like a channel syndication problem, not a PIM problem", source: "Architect", resolved: false }
        ]}
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
        { action: "create", node: { id: "enrichment", name: "Data Enrichment", parent: "root", score: 10 } },
        { action: "rename", target: "root", name: "Product Data Sync & Enrichment" },
        { action: "update", target: "root", changes: { score: 30 } },
        { action: "addItems", target: "enrichment", items: [
          { id: "ki-11", type: "fakt", text: "Shop backend is the data source of truth", source: "CEO", resolved: false },
          { id: "ki-12", type: "fakt", text: "Data there is not complete enough for all channels", source: "CEO", resolved: false },
          { id: "ki-13", type: "frage", text: "Which attributes are missing per channel?", source: "System", resolved: false }
        ]}
      ]
    },

    // Step 5: Confirm-and-summarize beat
    {
      id: 5,
      suggestedInput: "Yes, that's pretty much spot on.",
      keywords: ["yes", "correct", "right", "accurate", "exactly", "spot on", "that's right", "yeah"],
      aiResponse: "Good, let me quickly summarize what I've understood so far: Your shop backend is the central data source for about 3,000 products. From there, the data needs to reach Amazon, your webshop, and two B2B portals — each with channel-specific adjustments. The main pain point is the roughly 2 hours of manual work per product, and it all depends on a single person. Does that sound right?",
      architectInterjection: null,
      treeMutations: []
    },

    // Step 6: Decision fork
    {
      id: 6,
      isFork: true,
      suggestedInput: "Option A — the lightweight approach fits us better.",
      keywords: ["option a", "sync", "pipeline", "lightweight", "option b", "pim", "centralize"],
      forkOptions: [
        { label: "Option A: Sync Pipeline", keywords: ["option a", "sync", "pipeline", "lightweight"] },
        { label: "Option B: Full PIM System", keywords: ["option b", "pim", "centralize", "full"] }
      ],
      aiResponse: "Before we continue, I see two possible directions:\n\nOption A — A lightweight sync pipeline that automates what your employee does today manually. Data flows from the shop to channels with channel-specific transformation.\n\nOption B — A full PIM system as a new central data store that consolidates all product data.\n\nBased on everything you've described, Option A seems like the better fit. Which direction should we take?",
      architectInterjection: null,
      treeMutations: []
    },

    // Step 7: The pivot
    {
      id: 7,
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
        { action: "transition", text: "Rearranging knowledge and building new tree structure...", duration: 3000 },
        { action: "rename", target: "root", name: "Product Data Sync Pipeline" },
        { action: "update", target: "root", changes: { score: 38 } },
        { action: "create", node: { id: "source-connector", name: "Source Connector (Shop)", parent: "root", score: 30 } },
        { action: "create", node: { id: "channel-adapters", name: "Channel Adapters", parent: "root", score: 20 } },
        { action: "create", node: { id: "auto-enrichment", name: "Auto-Enrichment Engine", parent: "root", score: 15 } },
        { action: "create", node: { id: "attribute-mapping", name: "Attribute Mapping", parent: "root", score: 18 } },
        // Migrated knowledge: facts from removed nodes, re-assigned to new structure
        { action: "addItems", target: "root", items: [
          { id: "ki-14", type: "fakt", text: "Full PIM systems are too heavyweight", source: "CEO", resolved: false },
          { id: "ki-15", type: "fakt", text: "Data should flow automatically and be adapted per channel", source: "CEO", resolved: false },
          { id: "ki-9m", type: "fakt", text: "Approximately 2 hours of manual effort per product currently", source: "CEO", resolved: false },
          { id: "ki-10m", type: "inferenz", text: "Confirmed: this is a channel syndication problem, not a PIM problem", source: "Architect", resolved: false }
        ]},
        { action: "addItems", target: "source-connector", items: [
          { id: "ki-7m", type: "fakt", text: "Products are created in the shop backend", source: "CEO", resolved: false },
          { id: "ki-11m", type: "fakt", text: "Shop backend is the data source of truth", source: "CEO", resolved: false },
          { id: "ki-4m", type: "fakt", text: "Approximately 3,000 SKUs in catalog", source: "CEO", resolved: false }
        ]},
        { action: "addItems", target: "channel-adapters", items: [
          { id: "ki-5m", type: "fakt", text: "Sales via webshop, Amazon, and 2 B2B portals", source: "CEO", resolved: false },
          { id: "ki-6m", type: "inferenz", text: "Each channel has its own data requirements", source: "System", resolved: false }
        ]},
        { action: "addItems", target: "attribute-mapping", items: [
          { id: "ki-12m", type: "fakt", text: "Base data is not complete enough for all channels", source: "CEO", resolved: false },
          { id: "ki-13m", type: "frage", text: "Which attributes are missing per channel?", source: "System", resolved: false }
        ]}
      ]
    },

    // Step 8: Enrichment rules
    {
      id: 8,
      suggestedInput: "For Amazon, we'd need to auto-generate bullet points from our shop descriptions, and translate technical specs into Amazon's attribute format. The B2B portals need EAN codes and custom fields added.",
      keywords: ["bullet points", "amazon", "translate", "specs", "attribute", "ean", "custom fields", "auto-generate"],
      aiResponse: "So the enrichment is actually rule-based transformation — take source data, apply channel-specific rules to produce the right output format. For Amazon that means text reformatting, for B2B it means field augmentation. How often does this mapping logic change?",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "text-reformatting", name: "Text Reformatting Rules", parent: "auto-enrichment", score: 25 } },
        { action: "create", node: { id: "field-augmentation", name: "Field Augmentation (B2B)", parent: "auto-enrichment", score: 20 } },
        { action: "update", target: "auto-enrichment", changes: { score: 35 } },
        { action: "update", target: "root", changes: { score: 42 } },
        { action: "addItems", target: "text-reformatting", items: [
          { id: "ki-16", type: "fakt", text: "Amazon needs auto-generated bullet points from shop descriptions", source: "CEO", resolved: false },
          { id: "ki-17", type: "fakt", text: "Technical specs must be translated into Amazon's attribute format", source: "CEO", resolved: false }
        ]},
        { action: "addItems", target: "field-augmentation", items: [
          { id: "ki-18", type: "fakt", text: "B2B portals require EAN codes and custom fields", source: "CEO", resolved: false },
          { id: "ki-19", type: "frage", text: "How often do the mapping rules change?", source: "System", resolved: false }
        ]}
      ]
    },

    // Step 9: Sync frequency
    {
      id: 9,
      suggestedInput: "The mapping rules rarely change — maybe once a quarter. But product updates happen daily. We'd need changes to reach Amazon within a few hours, B2B portals can be overnight.",
      keywords: ["daily", "rarely change", "few hours", "overnight", "real-time", "batch", "frequency", "quarter"],
      aiResponse: "That gives us clear sync requirements: near-real-time for Amazon (say, every 2-4 hours), nightly batch for B2B portals. The transformation rules themselves can be versioned and updated manually. What about error cases — what happens today when Amazon rejects a listing?",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "sync-scheduler", name: "Sync Scheduler", parent: "source-connector", score: 30 } },
        { action: "create", node: { id: "amazon-adapter", name: "Amazon Adapter (Near-RT)", parent: "channel-adapters", score: 28 } },
        { action: "create", node: { id: "b2b-adapter", name: "B2B Adapter (Nightly Batch)", parent: "channel-adapters", score: 22 } },
        { action: "update", target: "channel-adapters", changes: { score: 35 } },
        { action: "update", target: "source-connector", changes: { score: 40 } },
        { action: "update", target: "root", changes: { score: 48 } },
        { action: "addItems", target: "sync-scheduler", items: [
          { id: "ki-20", type: "fakt", text: "Mapping rules change only about once per quarter", source: "CEO", resolved: false },
          { id: "ki-21", type: "fakt", text: "Product updates happen daily", source: "CEO", resolved: false }
        ]},
        { action: "addItems", target: "amazon-adapter", items: [
          { id: "ki-22", type: "fakt", text: "Changes need to reach Amazon within a few hours", source: "CEO", resolved: false },
          { id: "ki-23", type: "widerspruch", text: "CEO demands near-real-time sync for Amazon, but with 3,000 SKUs and infrequent rule changes this is likely over-engineered — a 4-hour interval would suffice", source: "Architect", resolved: false }
        ]},
        { action: "addItems", target: "b2b-adapter", items: [
          { id: "ki-24", type: "fakt", text: "B2B portals can be updated overnight", source: "CEO", resolved: false }
        ]}
      ]
    },

    // Step 10: Error handling
    {
      id: 10,
      suggestedInput: "Right now, nobody notices until a customer complains or she checks manually. We'd need some kind of notification when a sync fails, and ideally a way to see what went wrong and retry.",
      keywords: ["nobody notices", "customer complains", "notification", "sync fails", "retry", "went wrong", "error", "check"],
      aiResponse: "Error visibility is critical for a pipeline like this. We're looking at three things: monitoring and alerting when syncs fail, a dashboard showing sync status across channels, and a retry mechanism — ideally automatic for transient failures, manual for data issues.",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "error-handling", name: "Error Handling & Monitoring", parent: "root", score: 22 } },
        { action: "create", node: { id: "alerting", name: "Failure Alerting", parent: "error-handling", score: 18 } },
        { action: "create", node: { id: "sync-dashboard", name: "Sync Status Dashboard", parent: "error-handling", score: 15 } },
        { action: "create", node: { id: "retry-mechanism", name: "Retry Mechanism", parent: "error-handling", score: 12 } },
        { action: "update", target: "root", changes: { score: 52 } },
        { action: "addItems", target: "error-handling", items: [
          { id: "ki-25", type: "fakt", text: "Errors currently go unnoticed until customers complain", source: "CEO", resolved: false },
          { id: "ki-26", type: "fakt", text: "Notifications needed when sync fails", source: "CEO", resolved: false }
        ]},
        { action: "addItems", target: "sync-dashboard", items: [
          { id: "ki-27", type: "inferenz", text: "Dashboard should show sync status across all channels", source: "Architect", resolved: false }
        ]},
        { action: "addItems", target: "retry-mechanism", items: [
          { id: "ki-28", type: "inferenz", text: "Automatic retry for transient failures, manual retry for data issues", source: "Architect", resolved: false }
        ]}
      ]
    },

    // Step 11: Single-person dependency
    {
      id: 11,
      suggestedInput: "The biggest worry honestly is that our employee who does all this could be on vacation or leave. Right now everything stops. We need this to be automated so it just runs.",
      keywords: ["vacation", "leave", "one person", "stops", "automated", "runs", "worry", "dependency", "bus factor"],
      aiResponse: "That's the operational resilience angle — and it's a strong argument for automation. If the pipeline handles sync and enrichment automatically, the day-to-day doesn't depend on any single person. She becomes the person who manages the rules and handles exceptions, not the person who does every sync manually.",
      architectInterjection: null,
      treeMutations: [
        { action: "create", node: { id: "ops-resilience", name: "Operational Resilience", parent: "root", score: 30 } },
        { action: "create", node: { id: "auto-run", name: "Fully Automated Sync Runs", parent: "ops-resilience", score: 25 } },
        { action: "create", node: { id: "exception-mgmt", name: "Exception Management UI", parent: "ops-resilience", score: 18 } },
        { action: "update", target: "attribute-mapping", changes: { score: 38 } },
        { action: "update", target: "root", changes: { score: 55 } },
        { action: "addItems", target: "ops-resilience", items: [
          { id: "ki-29", type: "fakt", text: "Everything stops when the employee is absent", source: "CEO", resolved: false },
          { id: "ki-30", type: "fakt", text: "Process must be able to run fully automated", source: "CEO", resolved: false }
        ]},
        { action: "addItems", target: "auto-run", items: [
          { id: "ki-31", type: "inferenz", text: "Employee transitions from manual data entry to rule management", source: "Architect", resolved: false }
        ]},
        { action: "resolveItem", target: "root", itemId: "ki-3" }
      ]
    },

    // Step 12: Wrap-up
    {
      id: 12,
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
        { action: "update", target: "ops-resilience", changes: { score: 35 } },
        { action: "addItems", target: "root", items: [
          { id: "ki-32", type: "fakt", text: "Client confirms: sync pipeline rather than PIM is the right approach", source: "CEO", resolved: false },
          { id: "ki-33", type: "inferenz", text: "Feature tree evolved from vague PIM request to structured sync pipeline specification", source: "System", resolved: false }
        ]}
      ]
    }
  ]
};
