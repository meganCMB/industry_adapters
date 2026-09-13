const roofingIndustryAdapter = {
  schemaVersion: 1,
  key: 'roofing',
  version: '1.0.0',
  label: 'Roofing',
  description: 'Steep-slope roofing estimating, takeoff, material-order, and field-operation enhancements.',
  status: 'internal',
  // Deliberately narrow. 'exteriors', 'restoration', and 'construction' are
  // excluded — they would activate roofing for siding, gutter, and general
  // contractors who are not in this trade.
  aliases: [
    'roofing contractor',
    'roofing company',
    'roofer',
    'residential roofing',
    'shingle roofing',
    'roof replacement'
  ],
  terminology: {
    display: {
      job: { singular: 'roofing job', plural: 'roofing jobs' },
      work_order: { singular: 'work order', plural: 'work orders', short: 'install plan' },
      material_order: { singular: 'material order', plural: 'material orders' },
      estimate: { singular: 'estimate', plural: 'estimates' },
      line_item: { singular: 'scope item', plural: 'scope items' },
      crew: { singular: 'crew', plural: 'crews' },
      site: { singular: 'jobsite', plural: 'jobsites' }
    },
    synonyms: {
      roof_area: ['squares', 'square', 'sq', 'sqs', 'roof area', 'field area'],
      pitch: ['pitch', 'slope', 'rise over run', 'rise/run', 'on a 6/12', 'steepness'],
      tear_off: ['tear off', 'tear-off', 'strip', 'strip the roof', 'layers', 'existing layers', 'overlay', 'go-over'],
      field_shingles: ['shingles', 'architectural', 'dimensional', 'laminate', 'three tab', '3-tab', 'comp', 'bundles'],
      underlayment: ['felt', 'synthetic', 'synthetic underlayment', 'ice and water', 'ice & water shield', 'peel and stick'],
      accessories: ['starter', 'starter strip', 'ridge cap', 'hip and ridge', 'drip edge', 'valley metal', 'pipe boot', 'step flashing', 'counter flashing'],
      ventilation: ['ridge vent', 'box vent', 'turtle vent', 'off-ridge vent', 'soffit vent', 'power vent'],
      decking: ['deck', 'decking', 'sheathing', 'osb', 'plywood', 'rotten deck', 'soft spots'],
      linear_runs: ['ridge', 'hip', 'valley', 'eave', 'rake', 'lf', 'linear feet'], 
      estimate:['bid', 'proposal'],
    }
  },
  measurements: {
    quantityKinds: {
      length: { imperialUnit: 'ft', metricUnit: 'm', acceptedAliases: ['foot', 'feet', 'ft', 'meter', 'meters', 'm'], precision: 2 },
      area: { imperialUnit: 'ft2', metricUnit: 'm2', acceptedAliases: ['square foot', 'square feet', 'sq ft', 'sf', 'square meter', 'm2'], precision: 2 },
      // A roofing square is 100 ft2 by definition. It is a presentation unit
      // derived from area, never a storage unit, and it is only meaningful for
      // imperial tenants.
      roofing_square: { imperialUnit: 'square', metricUnit: 'square', acceptedAliases: ['square', 'squares', 'sq', 'sqs'], precision: 2 },
      // Expressed as rise per 12 of run. The calculator also accepts degrees.
      roof_pitch: { imperialUnit: 'rise_per_12', metricUnit: 'rise_per_12', acceptedAliases: ['pitch', 'rise over run', 'rise/run', 'degrees', 'deg'], precision: 2 },
      count: { imperialUnit: 'each', metricUnit: 'each', acceptedAliases: ['each', 'ea', 'bundle', 'bundles', 'roll', 'rolls', 'piece', 'pieces'], precision: 0 }
    },
    roundingPolicies: {
      shingleOrder: 'round_up_to_increment',
      accessoryOrder: 'round_up_to_whole_unit'
    }
  },
  settings: {
    schemaVersion: 1,
    groups: [
      {
        key: 'estimating',
        label: 'Estimating',
        description: 'Defaults used when presenting roofing quantity calculations.',
        fields: [
          {
            key: 'estimating.defaultWastePercent',
            label: 'Default waste',
            description: 'Suggested waste percentage for field shingles. It is always shown separately, is never applied to tear-off or labor quantities, and is never silently saved.',
            type: 'number',
            min: 0,
            max: 30,
            step: 0.5,
            unit: 'percent'
          },
          {
            key: 'estimating.orderRoundingFt2',
            label: 'Order rounding increment',
            description: 'Round shingle order area up to this increment. 100 ft² is one roofing square; 33.33 ft² is roughly one bundle.',
            type: 'number',
            min: 1,
            max: 200,
            step: 1,
            unit: 'ft2',
            measurementSystem: 'imperial'
          },
          {
            key: 'estimating.orderRoundingM2',
            label: 'Order rounding increment',
            description: 'Round metric shingle order area up to this increment.',
            type: 'number',
            min: 0.5,
            max: 20,
            step: 0.5,
            unit: 'm2',
            measurementSystem: 'metric'
          },
          {
            key: 'estimating.steepSlopeThreshold',
            label: 'Steep-slope review threshold',
            description: 'Pitch at or above which a calculation is flagged for steep-slope review. Flagging only — it never changes a price, a crew, or a method.',
            type: 'number',
            min: 4,
            max: 16,
            step: 1,
            unit: 'rise_per_12'
          }
        ]
      },
      {
        key: 'materials',
        label: 'Materials',
        description: 'Coverage values taken from the products this tenant actually installs.',
        fields: [
          {
            key: 'materials.bundleCoverageFt2',
            label: 'Shingle coverage per bundle',
            description: 'Coverage per bundle from the product specification. Bundle counts are omitted entirely when this is blank rather than assumed.',
            type: 'number',
            min: 5,
            max: 100,
            step: 0.01,
            unit: 'ft2',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.bundleCoverageM2',
            label: 'Shingle coverage per bundle',
            description: 'Metric coverage per bundle from the product specification.',
            type: 'number',
            min: 0.5,
            max: 10,
            step: 0.01,
            unit: 'm2',
            measurementSystem: 'metric'
          },
          {
            key: 'materials.starterCoverageFt',
            label: 'Starter coverage per bundle',
            description: 'Linear coverage per starter bundle. Leave blank to omit starter counts instead of assuming a value.',
            type: 'number',
            min: 0,
            max: 300,
            step: 0.5,
            unit: 'ft',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.starterCoverageM',
            label: 'Starter coverage per bundle',
            description: 'Metric linear coverage per starter bundle. Leave blank to omit starter counts.',
            type: 'number',
            min: 0,
            max: 100,
            step: 0.1,
            unit: 'm',
            measurementSystem: 'metric'
          },
          {
            key: 'materials.ridgeCapCoverageFt',
            label: 'Hip and ridge coverage per bundle',
            description: 'Linear coverage per hip-and-ridge bundle. Leave blank to omit ridge-cap counts instead of assuming a value.',
            type: 'number',
            min: 0,
            max: 300,
            step: 0.5,
            unit: 'ft',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.ridgeCapCoverageM',
            label: 'Hip and ridge coverage per bundle',
            description: 'Metric linear coverage per hip-and-ridge bundle. Leave blank to omit ridge-cap counts.',
            type: 'number',
            min: 0,
            max: 100,
            step: 0.1,
            unit: 'm',
            measurementSystem: 'metric'
          },
          {
            key: 'materials.underlaymentRollCoverageFt2',
            label: 'Underlayment coverage per roll',
            description: 'Coverage per roll from the product specification. Leave blank to omit roll counts instead of assuming a value.',
            type: 'number',
            min: 0,
            max: 2000,
            step: 1,
            unit: 'ft2',
            measurementSystem: 'imperial'
          },
          {
            key: 'materials.underlaymentRollCoverageM2',
            label: 'Underlayment coverage per roll',
            description: 'Metric coverage per roll from the product specification. Leave blank to omit roll counts.',
            type: 'number',
            min: 0,
            max: 200,
            step: 1,
            unit: 'm2',
            measurementSystem: 'metric'
          }
        ]
      },
      {
        key: 'operations',
        label: 'Operations',
        description: 'Tenant-specific supplier and delivery assumptions.',
        fields: [
          {
            key: 'operations.defaultSupplier',
            label: 'Default roofing supplier',
            description: 'Optional preferred supplier name.',
            type: 'text'
          },
          {
            key: 'operations.defaultShingleProduct',
            label: 'Default shingle product',
            description: 'Optional catalog product used when the user does not name one. It never overrides a product the user states.',
            type: 'text'
          }
        ]
      }
    ],
    defaults: {
      estimating: {
        defaultWastePercent: 10,
        orderRoundingFt2: 100,
        orderRoundingM2: 5,
        steepSlopeThreshold: 8
      },
      materials: {
        bundleCoverageFt2: 33.33,
        bundleCoverageM2: 3.1,
        // 0 means "not configured" — the calculator omits these outputs rather
        // than guessing a coverage the tenant's product may not have.
        starterCoverageFt: 0,
        starterCoverageM: 0,
        ridgeCapCoverageFt: 0,
        ridgeCapCoverageM: 0,
        underlaymentRollCoverageFt2: 0,
        underlaymentRollCoverageM2: 0
      },
      operations: {
        defaultSupplier: '',
        defaultShingleProduct: ''
      }
    }
  },
  ai: {
    globalInstructions: [
      'Roofing industry context: interpret steep-slope roofing vocabulary and abbreviations naturally while preserving every stated dimension, pitch, and unit.',
      'A "square" means 100 square feet of roof area only in a takeoff context; square feet are not squares, and a value like 6/12 is a pitch, not a date or a fraction.',
      'Never invent pitch, roof complexity, the number of existing layers, deck condition, shingle product or its coverage, waste, ventilation requirements, supplier constraints, engineering requirements, or code requirements.',
      'Use tenant catalog products and services before generic pricing. Keep tear-off and disposal, deck repair, underlayment, starter, field shingles, hip and ridge, flashing and accessories, ventilation, and cleanup separate when the user actually named those concerns.',
      'For roof area, squares, waste, rounded order quantities, bundle counts, or accessory quantities, always use the registered deterministic calculator and report its assumptions; never calculate the result mentally and never apply a pitch multiplier by hand.',
      'Treat calculations as material-planning estimates, not a roof inspection, a structural assessment, or approval to install.'
    ].join(' '),
    contextInstructions: {
      job: 'For roofing jobs, preserve the complete scope and measurable dimensions. Record pitch, story count, and existing layers only when the user states them. Ask only for information required for the requested record or calculation.',
      estimate: 'For roofing estimates, do not double-count scope across lines. Keep shingle supply distinct from tear-off and disposal, deck repair, underlayment, starter, hip and ridge, flashing, ventilation, labor, and cleanup. Waste applies to field material only — never apply it to a tear-off, disposal, or labor quantity. When the user explicitly accepts the latest calculation for an estimate, use its rounded order area only for a shingle quantity line, resolve pricing from the tenant catalog, and never invent a price.',
      workOrder: 'For roofing work orders, keep operational scope and field instructions clear. Do not add prices or invent project specifications. When the user explicitly accepts the latest calculation for a work order, use the raw calculated roof area as the area to be covered and carry waste and rounded order area as planning detail rather than extra installed area.',
      materialOrder: 'For roofing material orders, distinguish raw calculated area, waste, and rounded order area. When the user explicitly accepts the latest calculation, use the rounded order area as the shingle quantity. Bundle, roll, and piece counts are logistics information, not another material quantity, and are reported only when the tenant has configured that product coverage. Never silently substitute a default for a value the user supplied.'
    },
    intentAliases: {
      job: ['roof', 'reroof', 're-roof', 'roof replacement', 'tear off and replace'],
      estimate: ['quote the roof', 'price the reroof', 'bid the roof'],
      materialOrder: ['order shingles', 'order the roof', 'roof load', 'material drop']
    },
    examples: [
      {
        input: 'Reroof at 118 Oak, house is 32x46, 6/12, walkable.',
        expectedBehavior: 'Preserve 32 ft by 46 ft footprint and a 6/12 pitch as structured scope and route the area question to the calculator; do not invent layers, deck condition, shingle product, or waste, and do not treat "walkable" as a pitch value.'
      },
      {
        input: 'Three planes — 20x30, 20x30, and a 12x18 over the garage. How many squares?',
        expectedBehavior: 'Treat each as an already-measured roof plane with no pitch multiplier applied, aggregate them, and report raw area, waste, and rounded order area separately.'
      },
      {
        input: 'Take off the 6x8 skylight.',
        expectedBehavior: 'Add a subtract section to the existing calculation rather than reducing a stated dimension, and recalculate deterministically.'
      }
    ]
  },
  recommendations: {
    jobTypes: ['roof replacement', 'overlay', 'repair', 'storm damage', 'new construction', 'ventilation', 'skylight'],
    customFields: {
      jobs: [
        { id: 'roofing.job.roof_area_squares', key: 'industry.roofing.roof_area_squares', label: 'Roof area (squares)', type: 'number' },
        { id: 'roofing.job.predominant_pitch', key: 'industry.roofing.predominant_pitch', label: 'Predominant pitch', type: 'text' },
        { id: 'roofing.job.existing_layers', key: 'industry.roofing.existing_layers', label: 'Existing layers', type: 'number' },
        { id: 'roofing.job.tear_off_required', key: 'industry.roofing.tear_off_required', label: 'Tear-off required', type: 'text' },
        { id: 'roofing.job.stories', key: 'industry.roofing.stories', label: 'Stories', type: 'number' },
        { id: 'roofing.job.deck_type', key: 'industry.roofing.deck_type', label: 'Deck type', type: 'text' },
        { id: 'roofing.job.shingle_product', key: 'industry.roofing.shingle_product', label: 'Shingle product', type: 'text' },
        { id: 'roofing.job.underlayment_type', key: 'industry.roofing.underlayment_type', label: 'Underlayment type', type: 'text' },
        { id: 'roofing.job.ventilation_type', key: 'industry.roofing.ventilation_type', label: 'Ventilation type', type: 'text' },
        { id: 'roofing.job.access_limitations', key: 'industry.roofing.access_limitations', label: 'Access limitations', type: 'text' }
      ]
    }
  },
  calculators: [
    {
      id: 'roofing.area',
      version: '1.0.0',
      mode: 'read_only',
      shapes: ['plan_footprint', 'roof_plane', 'triangle_plane']
    }
  ],
  featureFlags: ['industry_prompt_overlay', 'industry_calculators']
};

export default roofingIndustryAdapter;
