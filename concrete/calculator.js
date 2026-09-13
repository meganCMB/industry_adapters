import {
  cubicMetersTo,
  measurementError,
  normalizedLength,
  roundMeasurement,
  roundUpToIncrement,
  volumeOutputUnit,
} from '../measurements.js';

const SHAPES = new Set(['rectangular_slab', 'continuous_footing', 'wall', 'circular_pier']);

function quantityText(quantity) {
  return `${quantity.value} ${quantity.unit}`;
}

function sectionVolume(section, outputUnit, index) {
  const shape = String(section?.shape || '');
  if (!SHAPES.has(shape)) throw measurementError(`Section ${index + 1} has an unsupported shape.`);
  const label = String(section.label || '').trim() || `Section ${index + 1}`;
  const count = section.count == null ? 1 : Number(section.count);
  if (!Number.isFinite(count) || count <= 0 || !Number.isInteger(count)) {
    throw measurementError(`${label} count must be a positive whole number.`);
  }

  let cubicMeters;
  let expression;
  if (shape === 'rectangular_slab' || shape === 'continuous_footing') {
    const length = normalizedLength(section.length, `${label} length`);
    const width = normalizedLength(section.width, `${label} width`);
    const thickness = normalizedLength(section.thickness, `${label} ${shape === 'continuous_footing' ? 'depth' : 'thickness'}`);
    cubicMeters = length.meters * width.meters * thickness.meters * count;
    expression = `${quantityText(length)} × ${quantityText(width)} × ${quantityText(thickness)}${count === 1 ? '' : ` × ${count}`}`;
  } else if (shape === 'wall') {
    const length = normalizedLength(section.length, `${label} length`);
    const height = normalizedLength(section.height, `${label} height`);
    const thickness = normalizedLength(section.thickness, `${label} thickness`);
    cubicMeters = length.meters * height.meters * thickness.meters * count;
    expression = `${quantityText(length)} × ${quantityText(height)} × ${quantityText(thickness)}${count === 1 ? '' : ` × ${count}`}`;
  } else {
    const diameter = normalizedLength(section.diameter, `${label} diameter`);
    const height = normalizedLength(section.height, `${label} height`);
    cubicMeters = Math.PI * ((diameter.meters / 2) ** 2) * height.meters * count;
    expression = `π × (${quantityText(diameter)} ÷ 2)² × ${quantityText(height)}${count === 1 ? '' : ` × ${count}`}`;
  }

  const volume = cubicMetersTo(cubicMeters, outputUnit);
  const operation = section.operation === 'subtract' ? 'subtract' : 'add';
  return {
    label,
    shape,
    operation,
    count,
    volume: { value: roundMeasurement(volume), unit: outputUnit, quantityKind: 'volume' },
    equation: `${expression} = ${roundMeasurement(volume)} ${outputUnit}`,
    signedCubicMeters: operation === 'subtract' ? -cubicMeters : cubicMeters,
  };
}

function configuredNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function calculateConcreteVolume(input = {}, context = {}) {
  const sections = Array.isArray(input.sections) ? input.sections : [];
  if (!sections.length) throw measurementError('At least one concrete section is required.');

  const measurementSystem = context.measurementSystem === 'metric' ? 'metric' : 'imperial';
  const outputUnit = volumeOutputUnit(measurementSystem);
  const config = context.config || {};
  const assumptions = [];
  const calculatedSections = sections.map((section, index) => sectionVolume(section, outputUnit, index));
  const rawCubicMeters = calculatedSections.reduce((sum, section) => sum + section.signedCubicMeters, 0);
  if (!(rawCubicMeters > 0)) throw measurementError('The calculated concrete volume must be greater than zero after deductions.');

  const configuredWaste = configuredNumber(config?.estimating?.defaultWastePercent, 0);
  const wastePercent = input.wastePercent == null ? configuredWaste : Number(input.wastePercent);
  if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) {
    throw measurementError('Waste percent must be between 0 and 100.');
  }
  if (input.wastePercent == null) assumptions.push(`Used the tenant waste setting of ${wastePercent}%.`);

  const defaultRounding = measurementSystem === 'metric'
    ? configuredNumber(config?.estimating?.orderRoundingM3, 0.1)
    : configuredNumber(config?.estimating?.orderRoundingYd3, 0.25);
  const roundingIncrement = input.orderRoundingIncrement == null
    ? defaultRounding
    : Number(input.orderRoundingIncrement);
  if (input.orderRoundingIncrement == null) {
    assumptions.push(`Used the tenant order-rounding setting of ${roundingIncrement} ${outputUnit}.`);
  }

  const rawVolume = cubicMetersTo(rawCubicMeters, outputUnit);
  const wasteVolume = rawVolume * (wastePercent / 100);
  const volumeWithWaste = rawVolume + wasteVolume;
  const roundedOrderVolume = roundUpToIncrement(volumeWithWaste, roundingIncrement);

  const configuredCapacity = measurementSystem === 'metric'
    ? configuredNumber(config?.operations?.truckCapacityM3, 0)
    : configuredNumber(config?.operations?.truckCapacityYd3, 0);
  const truckCapacity = input.truckCapacity == null ? configuredCapacity : Number(input.truckCapacity);
  let truckLoads = null;
  if (Number.isFinite(truckCapacity) && truckCapacity > 0) {
    truckLoads = Math.ceil((roundedOrderVolume - Number.EPSILON) / truckCapacity);
    if (input.truckCapacity == null) assumptions.push(`Used the tenant truck-capacity setting of ${truckCapacity} ${outputUnit}.`);
  } else if (input.truckCapacity != null) {
    throw measurementError('Truck capacity must be greater than zero.');
  }

  return {
    calculator: 'concrete.volume',
    calculatorVersion: '1.0.0',
    mode: 'read_only',
    measurementSystem,
    outputUnit,
    sections: calculatedSections.map(({ signedCubicMeters: _signed, ...section }) => section),
    rawVolume: { value: roundMeasurement(rawVolume), unit: outputUnit, quantityKind: 'volume' },
    waste: {
      percent: wastePercent,
      volume: { value: roundMeasurement(wasteVolume), unit: outputUnit, quantityKind: 'volume' },
    },
    volumeWithWaste: { value: roundMeasurement(volumeWithWaste), unit: outputUnit, quantityKind: 'volume' },
    orderRoundingIncrement: { value: roundingIncrement, unit: outputUnit, quantityKind: 'volume' },
    roundedOrderVolume: { value: roundMeasurement(roundedOrderVolume), unit: outputUnit, quantityKind: 'volume' },
    truckEstimate: truckLoads == null ? null : {
      capacity: { value: truckCapacity, unit: outputUnit, quantityKind: 'volume' },
      loads: truckLoads,
    },
    assumptions,
    warning: 'Material-planning estimate only. Verify project specifications, supplier requirements, engineering, field conditions, and local code before ordering or placement.',
  };
}

