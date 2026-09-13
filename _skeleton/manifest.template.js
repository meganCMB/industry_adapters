/**
 * INDUSTRY ADAPTER MANIFEST — TEMPLATE
 *
 * Derived from the concrete reference adapter (v1.1.0) and the
 * "JobHub Industry Adapter Architecture Plan" §8 Adapter contract.
 *
 * HOW TO USE THIS FILE
 *   1. Copy this directory to src/industryAdapters/<key>/
 *   2. Fill every <<ANGLE BRACKET>> slot.
 *   3. Delete the CONTRACT comments if you want, but do not delete the keys —
 *      the schema validator checks for them.
 *
 * THE RULE THAT GOVERNS EVERYTHING BELOW
 *   A manifest is DATA. It declares vocabulary, units, settings, prompt text,
 *   and recommendations. It never contains executable formulas, never grants a
 *   capability, and never bypasses a confirmation. Arithmetic lives in a
 *   reviewed calculator in the trusted runtime (see calculator.template.js).
 *
 * WHAT IS FIXED FOR EVERY TRADE (do not restructure):
 *   schemaVersion, key, version, label, description, status, aliases,
 *   terminology.display, terminology.synonyms, measurements.quantityKinds,
 *   settings.groups/defaults, ai.*, recommendations.*, calculators, featureFlags
 *
 * WHAT CHANGES PER TRADE:
 *   the VALUES inside those keys, and which quantity kinds the trade needs.
 */

const <<camelKey>>IndustryAdapter = {
  // ── IDENTITY ────────────────────────────────────────────────────────────
  schemaVersion: 1,

  // CONTRACT: `key` never changes after release. Lowercase, single word,
  // no spaces. It is written to tenant.primary_industry and recorded on
  // every AI turn.
  key: '<<key>>',

  // CONTRACT: semver. Patch = wording/examples. Minor = new backward-compatible
  // fields, recommendations, calculators. Major = breaking setting semantics.
  version: '1.0.0',

  label: '<<Label>>',
  description: '<<One line: what this adapter enhances. Mirror concrete\'s shape: "<Trade> estimating, <core operation>, material-order, and field-operation enhancements.">>',

  // CONTRACT: internal → pilot → available → retired. Ship as 'internal'.
  status: 'internal',

  // CONTRACT: aliases must be NARROW. They are how a free-text tenant industry
  // value resolves to this adapter. A broad alias ('construction', 'home
  // services') will misfire the adapter onto tenants who are not in this trade.
  // Aliases are collision-checked across all adapters at startup.
  aliases: [
    '<<trade> contractor>>',
    '<<trade> contracting>>',
    '<<the common self-description a tenant would actually type>>',
  ],

  // ── TERMINOLOGY ─────────────────────────────────────────────────────────
  // CONTRACT: terminology changes LABELS and INTERPRETATION only. It never
  // renames an API field, a Mongo collection, a capability key, a tool name,
  // or a route. `create_work_order` stays `create_work_order` even when the
  // trade calls it something else.
  terminology: {
    // Keys here are semantic and shared across every adapter. Use this exact
    // key set; override only the ones the trade actually renames. `short` is
    // the trade's own word and is used in helper copy, not as a replacement.
    display: {
      job: { singular: '<<trade> job>>', plural: '<<trade> jobs>>' },
      work_order: { singular: 'work order', plural: 'work orders', short: '<<the trade\'s field word, e.g. "pour plan">>' },
      material_order: { singular: 'material order', plural: 'material orders' },
      estimate: { singular: 'estimate', plural: 'estimates' },
      line_item: { singular: 'scope item', plural: 'scope items' },
      crew: { singular: 'crew', plural: 'crews' },
      site: { singular: 'jobsite', plural: 'jobsites' },
    },

    // Synonyms drive deterministic routing, search, and AI interpretation.
    // Group them by CONCEPT, not by word. Include the abbreviations a
    // contractor actually texts.
    //
    // WATCH FOR AMBIGUITY: concrete's "yards" means volume in a takeoff and
    // distance everywhere else. Every trade has one of these. Name it here and
    // handle it in ai.globalInstructions.
    synonyms: {
      '<<primary_quantity_concept>>': ['<<word>>', '<<abbrev>>', '<<unit slang>>'],
      '<<core_operation>>': ['<<word>>', '<<word>>'],
      '<<material_concept>>': ['<<word>>', '<<word>>'],
    },
  },

  // ── MEASUREMENTS ────────────────────────────────────────────────────────
  // CONTRACT: pull from the SHARED quantity kinds (length, area, volume, mass,
  // temperature, duration, count, rate). Add trade specializations only when
  // the trade genuinely measures something the shared set cannot express.
  // Never invent a primitive that conflicts with an existing one.
  measurements: {
    quantityKinds: {
      // Declare only the kinds this trade uses. Keep imperial/metric pairs and
      // acceptedAliases generous — acceptedAliases is what lets the AI hand a
      // messy user string to the calculator without guessing.
      length: { imperialUnit: 'ft', metricUnit: 'm', acceptedAliases: ['foot', 'feet', 'ft', 'meter', 'meters', 'm'], precision: 2 },
      count: { imperialUnit: 'each', metricUnit: 'each', acceptedAliases: ['each', 'ea'], precision: 0 },
      // <<add area / volume / mass / trade-specific kinds here>>
    },
    // Named policies the calculator references by name, so the rounding rule is
    // declared in the manifest and applied in reviewed code.
    roundingPolicies: {
      '<<materialOrder>>': 'round_up_to_increment',
    },
  },

  // ── SETTINGS ────────────────────────────────────────────────────────────
  // CONTRACT: declarative only. The SAME descriptor drives the generic
  // frontend renderer and server-side validation — there is no second copy.
  // Every field needs key, label, description, type, and (for numbers)
  // min/max/step/unit. Imperial and metric variants are separate fields with
  // `measurementSystem` set; the resolver picks one.
  //
  // NAMING: '<group>.<camelCaseField>'. Groups are stable across adapters
  // where the concept is the same: use `estimating`, `materials`, `operations`.
  settings: {
    schemaVersion: 1,
    groups: [
      {
        key: 'estimating',
        label: 'Estimating',
        description: 'Defaults used when presenting <<trade>> quantity calculations.',
        fields: [
          {
            key: 'estimating.defaultWastePercent',
            label: 'Default waste',
            // This description is user-facing. Say the safety property out loud.
            description: 'Suggested waste percentage. It is always shown separately and is never silently saved.',
            type: 'number',
            min: 0,
            max: <<realistic ceiling for this trade>>,
            step: 0.5,
            unit: 'percent',
          },
          {
            key: 'estimating.orderRounding<<Imperial>>',
            label: 'Order rounding increment',
            description: 'Round order quantities up to this increment.',
            type: 'number',
            min: <<min>>,
            max: <<max>>,
            step: <<step>>,
            unit: '<<imperialUnit>>',
            measurementSystem: 'imperial',
          },
          {
            key: 'estimating.orderRounding<<Metric>>',
            label: 'Order rounding increment',
            description: 'Round metric order quantities up to this increment.',
            type: 'number',
            min: <<min>>,
            max: <<max>>,
            step: <<step>>,
            unit: '<<metricUnit>>',
            measurementSystem: 'metric',
          },
        ],
      },
      {
        key: 'operations',
        label: 'Operations',
        description: 'Tenant-specific supplier and <<core operation>> assumptions.',
        fields: [
          // The "unit-of-purchase" field. Every trade has one: concrete has
          // truck capacity, roofing has bundle coverage, drywall has sheet size.
          // It converts a quantity into a countable order. Optional by default —
          // a zero or blank means the calculator omits that output entirely
          // rather than guessing.
          {
            key: 'operations.<<unitOfPurchase>>',
            label: '<<Label>>',
            description: 'Used only when estimating <<countable unit>>.',
            type: 'number',
            min: <<min>>,
            max: <<max>>,
            step: <<step>>,
            unit: '<<unit>>',
            measurementSystem: 'imperial',
          },
          {
            key: 'operations.defaultSupplier',
            label: 'Default <<material>> supplier',
            description: 'Optional preferred supplier name.',
            type: 'text',
          },
        ],
      },
    ],

    // CONTRACT: defaults must themselves validate against the field definitions
    // above (contract test checks this). A default of 0 / '' means "unset — do
    // not assume", and the calculator must treat it that way.
    defaults: {
      estimating: {},
      operations: {},
    },
  },

  // ── AI OVERLAY ──────────────────────────────────────────────────────────
  // CONTRACT: these are SMALL OVERLAYS composed on top of the core prompt at
  // position 6 and 7 (see plan §10). Do not restate core policy. Do not copy
  // the base prompt. A fix to core prompt behavior must not need to be
  // repeated in every adapter.
  //
  // An industry prompt can NEVER: grant a capability, bypass a confirmation,
  // change a tenant filter, invent a record ID, expose PII, substitute a
  // default for a user-supplied value, or turn an estimate into engineering
  // or code approval.
  //
  // THE FIVE SENTENCES EVERY ADAPTER NEEDS. Concrete's globalInstructions is
  // the canonical shape — keep all five, swap the nouns:
  //   1. Vocabulary:  interpret trade language, preserve every stated
  //                   dimension and unit.
  //   2. Never invent: name the SPECIFIC values this trade must never guess.
  //                   This is the most important line in the file.
  //   3. Catalog first + scope separation: list this trade's distinct scopes.
  //   4. Deterministic: which questions must route to the calculator, and a
  //                   ban on mental arithmetic.
  //   5. Not authority: this is material planning, not engineering/design/code.
  ai: {
    globalInstructions: [
      '<<Trade>> industry context: interpret <<trade>> vocabulary and abbreviations naturally while preserving every stated dimension and unit.',
      'Never invent <<list the exact specs this trade must not guess: dimensions, ratings, grades, waste, supplier constraints, engineering requirements, code requirements>>.',
      'Use tenant catalog products and services before generic pricing. Keep <<scope A>>, <<scope B>>, <<scope C>>, and <<scope D>> separate when the user actually named those concerns.',
      'For <<quantity>>, <<derived unit>>, waste, rounded order quantities, or <<countable unit>> questions, always use the registered deterministic calculator and report its assumptions; never calculate the result mentally.',
      'Treat calculations as material-planning estimates, not <<the professional authority this trade must not claim>>.',
    ].join(' '),

    // CONTRACT: keyed by the CRM object context the core detects. Only these
    // four keys today. Each one answers: when the user accepts a calculation
    // in THIS context, which number goes where?
    //
    // The distinction that matters and that every trade gets wrong:
    //   estimate      → rounded ORDER quantity, priced from the tenant catalog
    //   workOrder     → RAW quantity (what actually gets installed/placed);
    //                   waste and rounding ride along as planning detail, not
    //                   as extra installed quantity
    //   materialOrder → rounded ORDER quantity; logistics counts (trucks,
    //                   bundles, pallets) are information, not another
    //                   material line
    contextInstructions: {
      job: 'For <<trade>> jobs, preserve the complete scope and measurable dimensions. Ask only for information required for the requested record or calculation.',
      estimate: 'For <<trade>> estimates, do not double-count scope across lines. Keep <<material supply>> distinct from labor, <<prep>>, <<install>>, and cleanup. When the user explicitly accepts the latest calculation for an estimate, use its rounded order quantity only for a <<material>> quantity line, resolve pricing from the tenant catalog, and never invent a price.',
      workOrder: 'For <<trade>> work orders, keep operational scope and field instructions clear. Do not add prices or invent project specifications. When the user explicitly accepts the latest calculation for a work order, use the raw calculated quantity as the installed quantity and carry waste and rounded order quantity as planning detail rather than extra installed quantity.',
      materialOrder: 'For <<trade>> material orders, distinguish raw calculated quantity, waste, and rounded order quantity. When the user explicitly accepts the latest calculation, use the rounded order quantity as the <<material>> quantity. <<Countable units>> are logistics information, not another material quantity. Never silently substitute a default for a value the user supplied.',
    },

    // How this trade ASKS for each record type, in their own words. These feed
    // intent routing — they are not synonyms for display.
    intentAliases: {
      job: [],
      estimate: [],
      materialOrder: [],
    },

    // Seed fixtures. Grow this list from real pilot phrasings that failed.
    examples: [
      {
        input: '<<a real sentence a contractor in this trade would text>>',
        expectedBehavior: '<<what must be preserved structurally, and what must NOT be invented>>',
      },
    ],
  },

  // ── RECOMMENDATIONS ─────────────────────────────────────────────────────
  // CONTRACT: opt-in only. Never auto-applied. Applying the same
  // recommendation twice must not duplicate anything — that is what the stable
  // `id` is for. Custom-field `key` is namespaced `industry.<key>.<field>` and
  // is permanent; record values survive an adapter switch.
  recommendations: {
    jobTypes: [],
    customFields: {
      jobs: [
        // { id: '<<key>>.job.<<field>>', key: 'industry.<<key>>.<<field>>', label: '<<Label>>', type: 'text' },
      ],
    },
  },

  // ── CALCULATORS ─────────────────────────────────────────────────────────
  // CONTRACT: a REFERENCE to code in the trusted registry. The manifest names
  // the calculator; it never contains the formula. `mode: 'read_only'` means
  // the calculator cannot write a record — saving still goes through the normal
  // tool, capability, and confirmation path.
  //
  // Do NOT register a calculator that performs structural design, load,
  // capacity, code-compliance, or safety determination. Material takeoff only.
  calculators: [
    {
      id: '<<key>>.<<quantity>>',
      version: '1.0.0',
      mode: 'read_only',
      shapes: [],
    },
  ],

  featureFlags: ['industry_prompt_overlay', 'industry_calculators'],
};

export default <<camelKey>>IndustryAdapter;
