/**
 * roofing.area v1.0.0 — deterministic steep-slope roof takeoff.
 *
 * DEPENDENCY NOTE FOR IMPLEMENTATION
 *   This calculator needs two helpers that measurements.js does not have yet
 *   (concrete only needed the volume pair):
 *
 *     squareMetersTo(squareMeters, unit)   // 'ft2' | 'm2'
 *     areaOutputUnit(measurementSystem)    // 'imperial' -> 'ft2', 'metric' -> 'm2'
 *
 *   They are the exact analogues of cubicMetersTo / volumeOutputUnit. Adding
 *   them belongs in the shared measurement service, not here — area is a
 *   shared quantity kind and flooring, paint, and siding will all want it.
 *
 * WHAT THIS DOES NOT DO, ON PURPOSE
 *   No ventilation sizing (net free area is a code calculation).
 *   No fastener or nailing patterns (manufacturer specification).
 *   No deck, load, or structural assessment.
 *   No drip edge or valley metal piece counts (v1.1, needs a piece-length
 *   setting).
 */

import {
  areaOutputUnit,
  measurementError,
  normalizedLength,
  roundMeasurement,
  roundUpToIncrement,
  squareMetersTo,
} from '../measurements.js';

const SHAPES = new Set(['plan_footprint', 'roof_plane', 'triangle_plane']);

// A roofing square is 100 ft2 by definition, independent of tenant units.
const SQUARE_FEET_PER_SQUARE = 100;
const SQUARE_METERS_PER_SQUARE_FOOT = 0.09290304;

// Linear runs the calculator understands. Naming them by their run rather than
// by a product keeps the AI from deciding which run an accessory follows.
const LINEAR_RUNS = ['ridge', 'hip', 'valley', 'eave', 'rake'];

function quantityText(quantity) {
  return `${quantity.value} ${quantity.unit}`;
}

// Slope factors need more precision than the general 2-decimal measurement
// rounding: at 2 decimals the printed equation does not reproduce the printed
// area, which makes a correct answer look wrong to a contractor checking it.
function roundSlopeFactor(value) {
  return Math.round(value * 10000) / 10000;
}

function configuredNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Pitch -> slope factor, the multiplier that turns a plan (footprint) area
 * into the actual sloped surface area.
 *
 *   slopeFactor = hypotenuse / run = sqrt(rise^2 + run^2) / run
 *
 * Accepts every form a contractor actually uses:
 *   '6/12'  |  6  |  { rise: 6, run: 12 }  |  { degrees: 26.57 }  |  '26.57 deg'
 *
 * A bare number is rise per 12 of run, which is the universal US convention.
 * There is no default: a footprint without a pitch is an unanswerable question
 * and must produce a targeted error, not a guess.
 */
function slopeFactorFromPitch(pitch, label) {
  if (pitch == null || pitch === '') {
    throw measurementError(`${label} needs a pitch (for example 6/12) before a footprint can be converted to roof area.`);
  }

  let rise;
  let run;
  let degrees = null;
  let text;

  if (typeof pitch === 'object' && !Array.isArray(pitch)) {
    if (pitch.degrees != null) {
      degrees = Number(pitch.degrees);
    } else {
      rise = Number(pitch.rise);
      run = pitch.run == null ? 12 : Number(pitch.run);
    }
  } else {
    const raw = String(pitch).trim().toLowerCase();
    const degreeMatch = raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:deg|degree|degrees|°)$/);
    const ratioMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(?:\/|:|\s+in\s+|\s+on\s+)\s*(\d+(?:\.\d+)?)$/);
    if (degreeMatch) {
      degrees = Number(degreeMatch[1]);
    } else if (ratioMatch) {
      rise = Number(ratioMatch[1]);
      run = Number(ratioMatch[2]);
    } else if (/^\d+(?:\.\d+)?$/.test(raw)) {
      rise = Number(raw);
      run = 12;
    } else {
      throw measurementError(`${label} pitch "${pitch}" was not recognized. Use a rise over run such as 6/12, or degrees such as 26.6 deg.`);
    }
  }

  let factor;
  if (degrees != null) {
    if (!Number.isFinite(degrees) || degrees < 0 || degrees >= 85) {
      throw measurementError(`${label} pitch in degrees must be at least 0 and less than 85.`);
    }
    factor = 1 / Math.cos((degrees * Math.PI) / 180);
    text = `${degrees}°`;
    rise = null;
  } else {
    if (!Number.isFinite(rise) || rise < 0) throw measurementError(`${label} pitch rise must be zero or greater.`);
    if (!Number.isFinite(run) || run <= 0) throw measurementError(`${label} pitch run must be greater than zero.`);
    if (rise / run > 3) throw measurementError(`${label} pitch of ${rise}/${run} is outside the supported range. Confirm the rise and run.`);
    factor = Math.sqrt(rise * rise + run * run) / run;
    text = `${rise}/${run}`;
  }

  return {
    factor,
    text,
    // Normalized to rise per 12 so the steep-slope flag has one scale to
    // compare against regardless of how the pitch was entered.
    risePer12: rise == null ? Math.tan((degrees * Math.PI) / 180) * 12 : (rise / run) * 12,
  };
}

function sectionArea(section, outputUnit, index) {
  const shape = String(section?.shape || '');
  if (!SHAPES.has(shape)) throw measurementError(`Section ${index + 1} has an unsupported shape.`);
  const label = String(section.label || '').trim() || `Section ${index + 1}`;
  const count = section.count == null ? 1 : Number(section.count);
  if (!Number.isFinite(count) || count <= 0 || !Number.isInteger(count)) {
    throw measurementError(`${label} count must be a positive whole number.`);
  }

  let squareMeters;
  let expression;
  let pitch = null;

  if (shape === 'plan_footprint') {
    // Ground/plan dimensions. The pitch multiplier is applied here and only
    // here — a measured plane is already on the slope.
    const length = normalizedLength(section.length, `${label} length`);
    const width = normalizedLength(section.width, `${label} width`);
    pitch = slopeFactorFromPitch(section.pitch, label);
    squareMeters = length.meters * width.meters * pitch.factor * count;
    // The slope factor is shown at 4 decimals, not the usual 2, so the printed
    // equation actually reproduces the printed area when a contractor checks it
    // on a calculator.
    expression = `${quantityText(length)} × ${quantityText(width)} × ${roundSlopeFactor(pitch.factor)} (${pitch.text} slope factor)${count === 1 ? '' : ` × ${count}`}`;
  } else if (shape === 'roof_plane') {
    // Already measured on the slope (EagleView, drone, or a tape on the roof).
    // Applying a pitch multiplier here would double-count the slope.
    if (section.pitch != null) {
      throw measurementError(`${label} is a measured roof plane, so it is already on the slope. Remove the pitch, or use a plan_footprint section instead.`);
    }
    const length = normalizedLength(section.length, `${label} length`);
    const width = normalizedLength(section.width, `${label} width`);
    squareMeters = length.meters * width.meters * count;
    expression = `${quantityText(length)} × ${quantityText(width)}${count === 1 ? '' : ` × ${count}`}`;
  } else {
    // Gable ends, hip faces, and anything triangular, measured on the slope.
    const base = normalizedLength(section.base, `${label} base`);
    const height = normalizedLength(section.height, `${label} slope height`);
    squareMeters = (base.meters * height.meters / 2) * count;
    expression = `${quantityText(base)} × ${quantityText(height)} ÷ 2${count === 1 ? '' : ` × ${count}`}`;
  }

  const area = squareMetersTo(squareMeters, outputUnit);
  const operation = section.operation === 'subtract' ? 'subtract' : 'add';

  return {
    label,
    shape,
    operation,
    count,
    pitch: pitch == null ? null : { stated: pitch.text, slopeFactor: roundSlopeFactor(pitch.factor), risePer12: roundMeasurement(pitch.risePer12) },
    area: { value: roundMeasurement(area), unit: outputUnit, quantityKind: 'area' },
    equation: `${expression} = ${roundMeasurement(area)} ${outputUnit}`,
    signedSquareMeters: operation === 'subtract' ? -squareMeters : squareMeters,
  };
}

/**
 * Linear runs are reported as totals and used for accessory counts. They are
 * never derived from the area — a roof's ridge length is not a function of its
 * square footage, and guessing it would be inventing a measurement.
 */
function normalizeLinearRuns(linears, outputUnit) {
  if (linears == null) return null;
  if (typeof linears !== 'object' || Array.isArray(linears)) {
    throw measurementError('Linear runs must be given as named runs such as ridge, hip, valley, eave, or rake.');
  }
  const totals = {};
  let any = false;
  for (const run of LINEAR_RUNS) {
    if (linears[run] == null) continue;
    const length = normalizedLength(linears[run], `${run} length`);
    totals[run] = { meters: length.meters, value: roundMeasurement(length.meters * (outputUnit === 'm2' ? 1 : 1 / 0.3048)), unit: outputUnit === 'm2' ? 'm' : 'ft', quantityKind: 'length' };
    any = true;
  }
  return any ? totals : null;
}

function countableFromLength(meters, coveragePerUnit, linearUnit) {
  if (!Number.isFinite(coveragePerUnit) || coveragePerUnit <= 0) return null;
  const length = linearUnit === 'm' ? meters : meters / 0.3048;
  return {
    coverage: { value: coveragePerUnit, unit: linearUnit, quantityKind: 'length' },
    count: Math.ceil((length - Number.EPSILON) / coveragePerUnit),
  };
}

export function calculateRoofArea(input = {}, context = {}) {
  const sections = Array.isArray(input.sections) ? input.sections : [];
  if (!sections.length) throw measurementError('At least one roof section is required.');

  const measurementSystem = context.measurementSystem === 'metric' ? 'metric' : 'imperial';
  const outputUnit = areaOutputUnit(measurementSystem);
  const linearUnit = measurementSystem === 'metric' ? 'm' : 'ft';
  const config = context.config || {};
  const assumptions = [];
  const flags = [];

  const calculatedSections = sections.map((section, index) => sectionArea(section, outputUnit, index));
  const rawSquareMeters = calculatedSections.reduce((sum, section) => sum + section.signedSquareMeters, 0);
  if (!(rawSquareMeters > 0)) throw measurementError('The calculated roof area must be greater than zero after deductions.');

  // Waste. Field material only — the prompt overlay is responsible for keeping
  // it off tear-off and labor lines, and this result keeps the two numbers
  // separate so that stays possible.
  const configuredWaste = configuredNumber(config?.estimating?.defaultWastePercent, 0);
  const wastePercent = input.wastePercent == null ? configuredWaste : Number(input.wastePercent);
  if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) {
    throw measurementError('Waste percent must be between 0 and 100.');
  }
  if (input.wastePercent == null) assumptions.push(`Used the tenant waste setting of ${wastePercent}%.`);

  const defaultRounding = measurementSystem === 'metric'
    ? configuredNumber(config?.estimating?.orderRoundingM2, 5)
    : configuredNumber(config?.estimating?.orderRoundingFt2, 100);
  const roundingIncrement = input.orderRoundingIncrement == null
    ? defaultRounding
    : Number(input.orderRoundingIncrement);
  if (!Number.isFinite(roundingIncrement) || roundingIncrement <= 0) {
    throw measurementError('Order rounding increment must be greater than zero.');
  }
  if (input.orderRoundingIncrement == null) {
    assumptions.push(`Used the tenant order-rounding setting of ${roundingIncrement} ${outputUnit}.`);
  }

  const rawArea = squareMetersTo(rawSquareMeters, outputUnit);
  const wasteArea = rawArea * (wastePercent / 100);
  const areaWithWaste = rawArea + wasteArea;
  const roundedOrderArea = roundUpToIncrement(areaWithWaste, roundingIncrement);

  // Squares are a presentation convenience for imperial tenants. They are
  // always derived from the same canonical area, never stored, and omitted for
  // metric tenants who do not use the unit.
  const squareFeet = rawSquareMeters / SQUARE_METERS_PER_SQUARE_FOOT;
  const orderSquareFeet = measurementSystem === 'metric'
    ? roundedOrderArea / SQUARE_METERS_PER_SQUARE_FOOT
    : roundedOrderArea;
  const squares = measurementSystem === 'metric' ? null : {
    raw: { value: roundMeasurement(squareFeet / SQUARE_FEET_PER_SQUARE), unit: 'square', quantityKind: 'roofing_square' },
    order: { value: roundMeasurement(orderSquareFeet / SQUARE_FEET_PER_SQUARE), unit: 'square', quantityKind: 'roofing_square' },
  };

  // Bundles. Omitted entirely when the tenant has not set a coverage — a
  // bundle count from an assumed coverage is worse than no bundle count.
  const configuredCoverage = measurementSystem === 'metric'
    ? configuredNumber(config?.materials?.bundleCoverageM2, 0)
    : configuredNumber(config?.materials?.bundleCoverageFt2, 0);
  const bundleCoverage = input.bundleCoverage == null ? configuredCoverage : Number(input.bundleCoverage);
  let bundleEstimate = null;
  if (Number.isFinite(bundleCoverage) && bundleCoverage > 0) {
    bundleEstimate = {
      coverage: { value: bundleCoverage, unit: outputUnit, quantityKind: 'area' },
      bundles: Math.ceil((roundedOrderArea - Number.EPSILON) / bundleCoverage),
    };
    if (input.bundleCoverage == null) assumptions.push(`Used the tenant shingle coverage setting of ${bundleCoverage} ${outputUnit} per bundle.`);
  } else if (input.bundleCoverage != null) {
    throw measurementError('Shingle coverage per bundle must be greater than zero.');
  }

  // Accessories, each gated on both a stated run and a configured coverage.
  const linearTotals = normalizeLinearRuns(input.linears, outputUnit);
  const accessories = {};
  if (linearTotals) {
    const ridgeHipMeters = (linearTotals.ridge?.meters || 0) + (linearTotals.hip?.meters || 0);
    if (ridgeHipMeters > 0) {
      const coverage = measurementSystem === 'metric'
        ? configuredNumber(config?.materials?.ridgeCapCoverageM, 0)
        : configuredNumber(config?.materials?.ridgeCapCoverageFt, 0);
      const estimate = countableFromLength(ridgeHipMeters, coverage, linearUnit);
      if (estimate) {
        accessories.hipAndRidge = { ...estimate, basis: 'ridge + hip length' };
        assumptions.push(`Used the tenant hip-and-ridge coverage setting of ${coverage} ${linearUnit} per bundle.`);
      }
    }
    if (linearTotals.eave) {
      const coverage = measurementSystem === 'metric'
        ? configuredNumber(config?.materials?.starterCoverageM, 0)
        : configuredNumber(config?.materials?.starterCoverageFt, 0);
      // Rakes are included only on an explicit instruction. Whether starter
      // runs up the rakes is a system and manufacturer decision, not ours.
      const includeRakes = input.starterIncludesRakes === true;
      const starterMeters = linearTotals.eave.meters + (includeRakes ? (linearTotals.rake?.meters || 0) : 0);
      const estimate = countableFromLength(starterMeters, coverage, linearUnit);
      if (estimate) {
        accessories.starter = { ...estimate, basis: includeRakes ? 'eave + rake length' : 'eave length' };
        assumptions.push(`Used the tenant starter coverage setting of ${coverage} ${linearUnit} per bundle.`);
        if (!includeRakes && linearTotals.rake) {
          assumptions.push('Starter was figured on eaves only. Rakes were excluded because running starter up the rakes was not requested.');
        }
      }
    }
  }

  // Underlayment follows the roof, not the shingle order, so it uses raw area
  // rather than the waste-inflated and rounded shingle quantity.
  const rollCoverage = measurementSystem === 'metric'
    ? configuredNumber(config?.materials?.underlaymentRollCoverageM2, 0)
    : configuredNumber(config?.materials?.underlaymentRollCoverageFt2, 0);
  if (Number.isFinite(rollCoverage) && rollCoverage > 0) {
    accessories.underlayment = {
      coverage: { value: rollCoverage, unit: outputUnit, quantityKind: 'area' },
      count: Math.ceil((rawArea - Number.EPSILON) / rollCoverage),
      basis: 'raw roof area, before shingle waste',
    };
    assumptions.push(`Used the tenant underlayment coverage setting of ${rollCoverage} ${outputUnit} per roll.`);
  }

  // Advisory only. A flag prompts a human to look; it never changes a
  // quantity, a price, a crew, or a method.
  const steepThreshold = configuredNumber(config?.estimating?.steepSlopeThreshold, 0);
  if (steepThreshold > 0) {
    const steepest = calculatedSections.reduce((max, section) => Math.max(max, section.pitch?.risePer12 ?? 0), 0);
    if (steepest >= steepThreshold) {
      flags.push(`A stated pitch of ${roundMeasurement(steepest)}/12 is at or above the steep-slope review threshold of ${steepThreshold}/12. Review access, staging, and method before committing.`);
    }
  }

  return {
    calculator: 'roofing.area',
    calculatorVersion: '1.0.0',
    mode: 'read_only',
    measurementSystem,
    outputUnit,
    sections: calculatedSections.map(({ signedSquareMeters: _signed, ...section }) => section),
    rawArea: { value: roundMeasurement(rawArea), unit: outputUnit, quantityKind: 'area' },
    waste: {
      percent: wastePercent,
      area: { value: roundMeasurement(wasteArea), unit: outputUnit, quantityKind: 'area' },
    },
    areaWithWaste: { value: roundMeasurement(areaWithWaste), unit: outputUnit, quantityKind: 'area' },
    orderRoundingIncrement: { value: roundingIncrement, unit: outputUnit, quantityKind: 'area' },
    roundedOrderArea: { value: roundMeasurement(roundedOrderArea), unit: outputUnit, quantityKind: 'area' },
    squares,
    bundleEstimate,
    linearTotals: linearTotals == null ? null : Object.fromEntries(
      Object.entries(linearTotals).map(([run, total]) => [run, { value: total.value, unit: total.unit, quantityKind: 'length' }])
    ),
    accessoryEstimates: Object.keys(accessories).length ? accessories : null,
    assumptions,
    flags,
    warning: 'Material-planning estimate only. Verify field measurements, pitch, existing layers, deck condition, manufacturer coverage and installation requirements, ventilation, supplier availability, and local code before ordering or installing.',
  };
}
