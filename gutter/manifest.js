const gutterIndustryAdapter = {
  schemaVersion: 1,
  key: 'gutter',
  version: '1.0.0',
  label: 'Gutter',
  description: 'Gutter and downspout estimating, takeoff, material-order, and field-operation enhancements.',
  status: 'internal',
  // Deliberately narrow. 'exteriors', 'restoration', 'roofing', and
  // 'construction' are excluded — they would activate gutter for roofers,
  // siding crews, and general contractors who are not in this trade. Checked
  // against concrete and roofing: no alias overlap.
  aliases: [
    'gutter contractor',
    'gutter company',
    'seamless gutters',
    'rain gutters',
    'gutters and downspouts',
    'gutter installation'
  ],
  terminology: {
    display: {
      job: { singular: 'gutter job', plural: 'gutter jobs' },
      work_order: { singular: 'work order', plural: 'work orders', short: 'install plan' },
      material_order: { singular: 'material order', plural: 'material orders' },
      estimate: { singular: 'estimate', plural: 'estimates' },
      line_item: { singular: 'scope item', plural: 'scope items' },
      crew: { singular: 'crew', plural: 'crews' },
      site: { singular: 'jobsite', plural: 'jobsites' }
    },
    synonyms: {
      gutter_run: ['gutter', 'gutters', 'run', 'runs', 'lf', 'linear feet', 'lineal feet', 'trough', 'eavestrough', 'eave run'],
      // "drop" is this trade's most overloaded word: on a gutter job it is a
      // downspout location, not a delivery drop and not a price reduction.
      downspout: ['downspout', 'down spout', 'ds', 'leader', 'drop', 'drops', 'conductor', 'spout'],
      // Inches in this trade name the PROFILE SIZE, not a measured dimension.
      profile: ['k-style', 'k style', 'ogee', 'half round', 'half-round', 'box gutter', 'fascia gutter', '5 inch', '6 inch', '5"', '6"', '2x3', '3x4', '4 inch round'],
      material_spec: ['aluminum', 'alum', 'steel', 'galvanized', 'copper', 'vinyl', 'gauge', '.027', '.032', 'kynar', 'baked enamel', 'color match'],
      hangers: ['hanger', 'hangers', 'hidden hangers', 'spikes and ferrules', 'straps', 'brackets', 'on center', 'oc'],
      fittings: ['miter', 'miters', 'inside miter', 'outside miter', 'corner', 'corners', 'end cap', 'end caps', 'outlet', 'outlets', 'elbow', 'elbows', 'a elbow', 'b elbow', 'offset', 'crimp', 'zip screw'],
      gutter_guard: ['guard', 'guards', 'gutter guard', 'leaf guard', 'screen', 'covers', 'helmet'],
      tear_out: ['tear off', 'tear-off', 'remove existing', 'take down the old', 'strip the gutters', 'haul off'],
      fascia: ['fascia', 'fascia board', 'sub fascia', 'rotten fascia', 'soffit', 'drip edge'],
      drainage: ['discharge', 'kickout', 'splash block', 'extension', 'underground', 'drain tile', 'tie into', 'daylight'],
      estimate: ['bid', 'proposal']
    }
  },
  measurements: {
    quantityKinds: {
      // Length is the whole trade. Gutter and downspout are both sold by the
      // foot and are still two different materials — see the calculator.
      length: { imperialUnit: 'ft', metricUnit: 'm', acceptedAliases: ['foot', 'feet', 'ft', 'lf', 'linear foot', 'linear feet', 'meter', 'meters', 'm'], precision: 2 },
      count: { imperialUnit: 'each', metricUnit: 'each', acceptedAliases: ['each', 'ea', 'stick', 'sticks', 'piece', 'pieces', 'coil', 'coils', 'box', 'boxes'], precision: 0 }
    },
    roundingPolicies: {
      gutterOrder: 'round_up_to_increment',
      downspoutOrder: 'round_up_to_increment',
      accessoryOrder: 'round_up_to_whole_unit'
    }
  },
  settings: {
    schemaVersion: 1,
    groups: [
      {
        key: 'estimating',
        label: 'Estimating',
        description: 'Defaults used when presenting gutter quantity calculations.',
        fields: [
          {
            key: 'estimating.defaultWastePercent',
            label: 'Default waste',
            description: 'Suggested waste percentage for gutter and downspout material. It is always shown separately, is never applied to accessory counts, tear-out, or labor quantities, and is never silently saved.',
            type: 'number',
            min: 0,
            max: 25,
            step: 0.5,
            unit: 'percent'
          },
          {
            key: 'estimating.orderRoundingFt',
            label: 'Order rounding increment',
            description: 'Round order length up to this increment. Seamless gutter is cut to length, so 1 ft is usual; sectional shops often round to the 10 ft stick.',
            type: 'number',
            min: 0.5,
            max: 20,
            step: 0.5,
            unit: 'ft',
            measurementSystem: 'imperial'
          },
          {
            key: 'estimating.orderRoundingM',
            label: 'Order rounding increment',
            description: 'Round metric order length up to this increment.',
            type: 'number',
            min: 0.1,
            max: 6,
            step: 0.1,
            unit: 'm',
            measurementSystem: 'metric'
          }
        ]
      },
      {
        key: 'materials',
        label: 'Materials',
        description: 'Stock lengths and spacings taken from the products this tenant actually installs.',
        fields: [
          {
            key: 'materials.gutterStockLengthFt',
            label: 'Sectional gutter stock length',
            description: 'Length of one stick of sectional gutter. Leave blank for a seamless shop — stick counts are omitted entirely rather than assumed.',
            type: 'number',
            min: 0,
            max: 40,
            step: 0.5,
            unit: 'ft',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.gutterStockLengthM',
            label: 'Sectional gutter stock length',
            description: 'Metric length of one stick of sectional gutter. Leave blank to omit stick counts.',
            type: 'number',
            min: 0,
            max: 12,
            step: 0.1,
            unit: 'm',
            measurementSystem: 'metric'
          },
          {
            key: 'materials.gutterCoilLengthFt',
            label: 'Seamless coil length per roll',
            description: 'Run length produced by one coil on the machine. Leave blank to omit coil counts instead of assuming a value.',
            type: 'number',
            min: 0,
            max: 1500,
            step: 1,
            unit: 'ft',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.gutterCoilLengthM',
            label: 'Seamless coil length per roll',
            description: 'Metric run length produced by one coil. Leave blank to omit coil counts.',
            type: 'number',
            min: 0,
            max: 500,
            step: 1,
            unit: 'm',
            measurementSystem: 'metric'
          },
          {
            key: 'materials.downspoutStockLengthFt',
            label: 'Downspout stock length',
            description: 'Length of one stick of downspout. Leave blank to omit downspout stick counts.',
            type: 'number',
            min: 0,
            max: 40,
            step: 0.5,
            unit: 'ft',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.downspoutStockLengthM',
            label: 'Downspout stock length',
            description: 'Metric length of one stick of downspout. Leave blank to omit downspout stick counts.',
            type: 'number',
            min: 0,
            max: 12,
            step: 0.1,
            unit: 'm',
            measurementSystem: 'metric'
          },
          {
            key: 'materials.hangerSpacingIn',
            label: 'Hanger spacing',
            description: 'On-center hanger spacing this tenant installs to. Leave blank to omit hanger counts — spacing is a manufacturer and climate decision, not something to assume.',
            type: 'number',
            min: 0,
            max: 48,
            step: 1,
            unit: 'in',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.hangerSpacingMm',
            label: 'Hanger spacing',
            description: 'Metric on-center hanger spacing. Leave blank to omit hanger counts.',
            type: 'number',
            min: 0,
            max: 1200,
            step: 10,
            unit: 'mm',
            measurementSystem: 'metric'
          },
          {
            key: 'materials.elbowsPerDownspout',
            label: 'Elbows per downspout',
            description: 'Typical elbow count per downspout for this tenant. Leave blank to omit elbow counts — the real number depends on the overhang and the discharge point.',
            type: 'number',
            min: 0,
            max: 6,
            step: 1,
            unit: 'each'
          }
        ]
      },
      {
        key: 'operations',
        label: 'Operations',
        description: 'Tenant-specific supplier and field-review assumptions.',
        fields: [
          {
            key: 'operations.maxRunPerDownspoutFt',
            label: 'Run-per-downspout review threshold',
            description: 'Gutter length per downspout at or above which a calculation is flagged for drainage review. Flagging only — it never sizes a gutter, adds a downspout, or changes a price.',
            type: 'number',
            min: 0,
            max: 100,
            step: 1,
            unit: 'ft',
            measurementSystem: 'imperial'
          },
          {
            key: 'operations.maxRunPerDownspoutM',
            label: 'Run-per-downspout review threshold',
            description: 'Metric gutter length per downspout at or above which a calculation is flagged for drainage review.',
            type: 'number',
            min: 0,
            max: 30,
            step: 0.5,
            unit: 'm',
            measurementSystem: 'metric'
          },
          {
            key: 'operations.defaultSupplier',
            label: 'Default gutter supplier',
            description: 'Optional preferred supplier name.',
            type: 'text'
          },
          {
            key: 'operations.defaultGutterProfile',
            label: 'Default gutter profile',
            description: 'Optional catalog profile used when the user does not name one. It never overrides a profile the user states.',
            type: 'text'
          }
        ]
      }
    ],
    defaults: {
      estimating: {
        defaultWastePercent: 5,
        orderRoundingFt: 1,
        orderRoundingM: 0.5
      },
      materials: {
        // 0 means "not configured" — the calculator omits these outputs rather
        // than guessing. Only the downspout stick length is defaulted, because
        // it is a genuine stock constant rather than a product-specific value;
        // gutter stock, coil length, hanger spacing, and elbow count all vary
        // by shop and product and are left unset on purpose.
        gutterStockLengthFt: 0,
        gutterStockLengthM: 0,
        gutterCoilLengthFt: 0,
        gutterCoilLengthM: 0,
        downspoutStockLengthFt: 10,
        downspoutStockLengthM: 3,
        hangerSpacingIn: 0,
        hangerSpacingMm: 0,
        elbowsPerDownspout: 0
      },
      operations: {
        maxRunPerDownspoutFt: 40,
        maxRunPerDownspoutM: 12,
        defaultSupplier: '',
        defaultGutterProfile: ''
      }
    }
  },
  ai: {
    globalInstructions: [
      'Gutter industry context: interpret gutter and downspout vocabulary and abbreviations naturally while preserving every stated dimension, profile size, and unit.',
      'Inches in this trade name a profile size, not a measured run — "160 feet of 6 inch" is 160 linear feet of 6-inch gutter, not a 160 by 6 area; a "drop" is a downspout location, not a delivery or a discount; and a "run" is one continuous length of gutter, not a count of jobs.',
      'Never invent gutter profile or size, material, gauge or finish, hanger type or spacing, downspout size, count, height, or discharge point, fascia or roof-edge condition, the condition of existing gutter, waste, supplier constraints, drainage sizing, engineering requirements, or code requirements.',
      'Use tenant catalog products and services before generic pricing. Keep tear-out and haul-off, fascia repair, gutter supply, downspout supply, hangers and fittings, gutter guards, labor, and cleanup separate when the user actually named those concerns.',
      'For gutter length, downspout length, waste, rounded order quantities, stick or coil counts, hanger counts, or elbow counts, always use the registered deterministic calculator and report its assumptions; never calculate the result mentally and never add gutter and downspout length into a single figure.',
      'Treat calculations as material-planning estimates, not drainage design, roof-drainage capacity sizing, a structural or fascia assessment, or approval to install.'
    ].join(' '),
    contextInstructions: {
      job: 'For gutter jobs, preserve the complete scope and measurable dimensions. Record profile and size, material and finish, downspout count, stories, and discharge method only when the user states them. Ask only for information required for the requested record or calculation.',
      estimate: 'For gutter estimates, do not double-count scope across lines. Keep gutter supply distinct from downspout supply, tear-out and haul-off, fascia repair, hangers and fittings, gutter guards, labor, and cleanup. Waste applies to gutter and downspout material only — never apply it to an accessory count, a tear-out length, or a labor quantity. When the user explicitly accepts the latest calculation for an estimate, use its rounded order gutter length and rounded order downspout length as two separate quantity lines, resolve pricing from the tenant catalog, and never invent a price.',
      workOrder: 'For gutter work orders, keep operational scope and field instructions clear. Do not add prices or invent project specifications. When the user explicitly accepts the latest calculation for a work order, use the raw calculated gutter and downspout lengths as the lengths to be hung and carry waste and rounded order lengths as planning detail rather than extra installed length.',
      materialOrder: 'For gutter material orders, distinguish raw calculated length, waste, and rounded order length, and keep gutter and downspout as separate materials. When the user explicitly accepts the latest calculation, use the rounded order lengths as the gutter and downspout quantities. Stick, coil, hanger, and elbow counts are logistics information, not another material quantity, and are reported only when the tenant has configured that stock length or spacing. Miter, end cap, and outlet counts are reported only as the user stated them and are never derived from a footprint. Never silently substitute a default for a value the user supplied.'
    },
    intentAliases: {
      job: ['gutters', 'new gutters', 'gutter replacement', 'hang gutter', 'guard the gutters'],
      estimate: ['quote the gutters', 'price the gutter', 'bid the gutters'],
      materialOrder: ['order gutter', 'order coil', 'order downspout', 'material drop', 'pull the gutter material']
    },
    examples: [
      {
        input: '160 feet of 6 inch k-style, 4 drops, two story on the back.',
        expectedBehavior: 'Read 6 inch as the profile size and 160 feet as the gutter run, record four downspouts and the two-story access note as stated scope, and route the quantity question to the calculator; do not invent downspout height, material, gauge, hanger spacing, elbow count, or discharge point, and do not multiply 160 by 6.'
      },
      {
        input: 'Ranch is 28x52, gutter front and back only.',
        expectedBehavior: 'Use a rectangle_eaves section covering the two 52 ft sides rather than all four sides, and do not invent downspouts, profile, or material.'
      },
      {
        input: 'Skip the 12 ft over the porch.',
        expectedBehavior: 'Add a subtract section to the existing calculation rather than reducing a stated dimension, and recalculate deterministically.'
      }
    ]
  },
  // Matches the concrete adapter's 1.2.0 shape: durable record structure lives
  // in `extensions`, and `recommendations` carries job types only.
  extensions: {
    jobStatuses: ['measured', 'material-ordered', 'scheduled', 'hung', 'punch-list'],
    customFields: {
      jobs: [
        { key: 'industry_gutter_linear_feet', label: 'Gutter length (linear feet)', type: 'number' },
        { key: 'industry_gutter_profile', label: 'Gutter profile', type: 'text' },
        { key: 'industry_gutter_size', label: 'Gutter size', type: 'text' },
        { key: 'industry_gutter_material_gauge', label: 'Material and gauge', type: 'text' },
        { key: 'industry_gutter_color_finish', label: 'Color / finish', type: 'text' },
        { key: 'industry_gutter_downspout_count', label: 'Downspout count', type: 'number' },
        { key: 'industry_gutter_downspout_size', label: 'Downspout size', type: 'text' },
        { key: 'industry_gutter_hanger_type', label: 'Hanger type', type: 'text' },
        { key: 'industry_gutter_fascia_condition', label: 'Fascia condition', type: 'text' },
        { key: 'industry_gutter_discharge_method', label: 'Discharge method', type: 'text' }
      ]
    }
  },
  recommendations: {
    jobTypes: ['new gutter installation', 'gutter replacement', 'downspout only', 'gutter repair', 'gutter guards', 'gutter cleaning', 'storm damage', 'commercial']
  },
  calculators: [
    {
      id: 'gutter.length',
      version: '1.0.0',
      mode: 'read_only',
      shapes: ['gutter_run', 'rectangle_eaves']
    }
  ],
  featureFlags: ['industry_prompt_overlay', 'industry_calculators']
};

export default gutterIndustryAdapter;
