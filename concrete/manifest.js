const concreteIndustryAdapter = {
  schemaVersion: 1,
  key: 'concrete',
  version: '1.1.0',
  label: 'Concrete',
  description: 'Concrete estimating, placement, material-order, and field-operation enhancements.',
  status: 'internal',
  aliases: [
    'concrete contractor',
    'concrete contracting',
    'concrete construction',
    'flatwork',
    'foundation contractor'
  ],
  terminology: {
    display: {
      job: { singular: 'concrete job', plural: 'concrete jobs' },
      work_order: { singular: 'work order', plural: 'work orders', short: 'pour plan' },
      material_order: { singular: 'material order', plural: 'material orders' },
      estimate: { singular: 'estimate', plural: 'estimates' },
      line_item: { singular: 'scope item', plural: 'scope items' },
      crew: { singular: 'crew', plural: 'crews' },
      site: { singular: 'jobsite', plural: 'jobsites' }
    },
    synonyms: {
      concrete_volume: ['yards', 'yardage', 'cy', 'cubic yards', 'ready-mix volume'],
      placement: ['pour', 'placement', 'placing concrete'],
      reinforcement: ['rebar', 'wire mesh', 'fiber', 'dowels'],
      crew:['laborer'],
      joints: ['saw cuts', 'control joints', 'expansion joints'],
      base_preparation: ['subgrade', 'base', 'stone base', 'compaction']
    }
  },
  measurements: {
    quantityKinds: {
      length: { imperialUnit: 'ft', metricUnit: 'm', acceptedAliases: ['foot', 'feet', 'ft', 'meter', 'meters', 'm'], precision: 2 },
      area: { imperialUnit: 'ft2', metricUnit: 'm2', acceptedAliases: ['square foot', 'square feet', 'sq ft', 'sf', 'square meter', 'm2'], precision: 2 },
      volume: { imperialUnit: 'yd3', metricUnit: 'm3', acceptedAliases: ['yard', 'yards', 'cy', 'cubic yard', 'cubic yards', 'yd3', 'cubic meter', 'm3'], precision: 2 },
      compressive_strength: { imperialUnit: 'psi', metricUnit: 'mpa', acceptedAliases: ['psi', 'mpa'], precision: 0 },
      slump: { imperialUnit: 'in', metricUnit: 'mm', acceptedAliases: ['inch', 'inches', 'in', 'millimeter', 'mm'], precision: 1 },
      reinforcement_spacing: { imperialUnit: 'in', metricUnit: 'mm', acceptedAliases: ['inch', 'inches', 'in', 'millimeter', 'mm'], precision: 1 },
      count: { imperialUnit: 'each', metricUnit: 'each', acceptedAliases: ['each', 'ea', 'truck', 'trucks'], precision: 0 }
    },
    roundingPolicies: {
      concreteOrder: 'round_up_to_increment'
    }
  },
  settings: {
    schemaVersion: 1,
    groups: [
      {
        key: 'estimating',
        label: 'Estimating',
        description: 'Defaults used when presenting concrete quantity calculations.',
        fields: [
          {
            key: 'estimating.defaultWastePercent',
            label: 'Default waste',
            description: 'Suggested waste percentage. It is always shown separately and is never silently saved.',
            type: 'number',
            min: 0,
            max: 30,
            step: 0.5,
            unit: 'percent'
          },
          {
            key: 'estimating.orderRoundingYd3',
            label: 'Order rounding increment',
            description: 'Round concrete order quantities up to this increment.',
            type: 'number',
            min: 0.25,
            max: 2,
            step: 0.25,
            unit: 'yd3',
            measurementSystem: 'imperial'
          },
          {
            key: 'estimating.orderRoundingM3',
            label: 'Order rounding increment',
            description: 'Round metric concrete order quantities up to this increment.',
            type: 'number',
            min: 0.05,
            max: 2,
            step: 0.05,
            unit: 'm3',
            measurementSystem: 'metric'
          }
        ]
      },
      {
        key: 'operations',
        label: 'Operations',
        description: 'Tenant-specific supplier and placement assumptions.',
        fields: [
          {
            key: 'operations.truckCapacityYd3',
            label: 'Truck capacity',
            description: 'Capacity used only when estimating truck loads.',
            type: 'number',
            min: 1,
            max: 20,
            step: 0.5,
            unit: 'yd3',
            measurementSystem: 'imperial'
          },
          {
            key: 'operations.truckCapacityM3',
            label: 'Truck capacity',
            description: 'Metric capacity used only when estimating truck loads.',
            type: 'number',
            min: 1,
            max: 20,
            step: 0.5,
            unit: 'm3',
            measurementSystem: 'metric'
          },
          {
            key: 'operations.defaultSupplier',
            label: 'Default ready-mix supplier',
            description: 'Optional preferred supplier name.',
            type: 'text'
          }
        ]
      }
    ],
    defaults: {
      estimating: {
        defaultWastePercent: 10,
        orderRoundingYd3: 0.25,
        orderRoundingM3: 0.1
      },
      operations: {
        truckCapacityYd3: 10,
        truckCapacityM3: 8,
        defaultSupplier: ''
      }
    }
  },
  ai: {
    globalInstructions: [
      'Concrete industry context: interpret concrete vocabulary and abbreviations naturally while preserving every stated dimension and unit.',
      'Never invent thickness, strength, slump, reinforcement, finish, waste, supplier constraints, engineering requirements, or code requirements.',
      'Use tenant catalog products and services before generic pricing. Keep preparation, formwork, reinforcement, concrete supply, placement, finishing, joints, curing, and cleanup separate when the user actually named those concerns.',
      'For concrete volume, yardage, waste, rounded order quantities, or truck-load questions, always use the registered deterministic calculator and report its assumptions; never calculate the result mentally.',
      'Treat calculations as material-planning estimates, not structural design or approval to place concrete.'
    ].join(' '),
    contextInstructions: {
      job: 'For concrete jobs, preserve the complete scope and measurable dimensions. Ask only for information required for the requested record or calculation.',
      estimate: 'For concrete estimates, do not double-count scope across lines. Keep concrete supply distinct from labor, preparation, forms, reinforcement, placement, finishing, curing, and cleanup. When the user explicitly accepts the latest volume calculation for an estimate, use its rounded order volume only for a ready-mix quantity line, resolve pricing from the tenant catalog, and never invent a price.',
      workOrder: 'For concrete work orders, keep operational scope and field instructions clear. Do not add prices or invent project specifications. When the user explicitly accepts the latest volume calculation for a work order, use raw calculated volume as the placement quantity and carry waste and rounded order volume as planning detail rather than extra placed volume.',
      materialOrder: 'For concrete material orders, distinguish raw calculated volume, waste, and rounded order quantity. When the user explicitly accepts the latest calculation, use rounded order volume as the ready-mix quantity. Truck loads are logistics information, not another material quantity. Never silently substitute a default for a value the user supplied.'
    },
    intentAliases: {
      job: ['pour', 'placement', 'flatwork'],
      estimate: ['quote the pour', 'price the flatwork'],
      materialOrder: ['order concrete', 'book the mud', 'ready-mix order']
    },
    examples: [
      {
        input: 'Create a driveway job 20x40 at 5 inches.',
        expectedBehavior: 'Preserve 20 ft by 40 ft by 5 in as structured scope; do not invent strength, reinforcement, finish, or waste.'
      }
    ]
  },
  recommendations: {
    jobTypes: ['driveway', 'patio', 'sidewalk', 'slab', 'foundation', 'footing', 'repair'],
    customFields: {
      jobs: [
        { id: 'concrete.job.placement_type', key: 'industry.concrete.placement_type', label: 'Placement type', type: 'text' },
        { id: 'concrete.job.design_strength', key: 'industry.concrete.design_strength', label: 'Design strength', type: 'text' },
        { id: 'concrete.job.thickness', key: 'industry.concrete.thickness', label: 'Thickness', type: 'text' },
        { id: 'concrete.job.estimated_volume', key: 'industry.concrete.estimated_volume', label: 'Estimated concrete volume', type: 'number' },
        { id: 'concrete.job.finish', key: 'industry.concrete.finish', label: 'Finish', type: 'text' },
        { id: 'concrete.job.reinforcement', key: 'industry.concrete.reinforcement', label: 'Reinforcement', type: 'text' }
      ]
    }
  },
  calculators: [
    {
      id: 'concrete.volume',
      version: '1.0.0',
      mode: 'read_only',
      shapes: ['rectangular_slab', 'continuous_footing', 'wall', 'circular_pier']
    }
  ],
  featureFlags: ['industry_prompt_overlay', 'industry_calculators']
};

export default concreteIndustryAdapter;
