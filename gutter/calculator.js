/**
 * gutter.length v1.0.0 — deterministic gutter and downspout takeoff.
 *
 * DEPENDENCY NOTE FOR IMPLEMENTATION
 *   This calculator needs two helpers that measurements.js does not have yet
 *   (concrete added the volume pair, roofing the area pair):
 *
 *     metersTo(meters, unit)             // 'ft' | 'm'
 *     lengthOutputUnit(measurementSystem) // 'imperial' -> 'ft', 'metric' -> 'm'
 *
 *   They are the exact analogues of cubicMetersTo / volumeOutputUnit and
 *   squareMetersTo / areaOutputUnit. Adding them belongs in the shared
 *   measurement service, not here — length is a shared quantity kind and
 *   fencing, trim, and siding will all want it.
 *
 * ⚠ NEW PLATFORM FUNCTIONALITY REQUIRED — RAISED, NOT WORKED AROUND
 *   Concrete and roofing each sell ONE material, so the shared result contract
 *   has exactly one slot for the raw / waste / rounded-order trio. Gutter sells
 *   TWO — gutter and downspout — and they are ordered, priced, and installed
 *   separately.
 *
 *   This calculator does not invent a second contract. The gutter trio sits at
 *   the top level under the same field names concrete and roofing use
 *   (rawLength, waste, lengthWithWaste, roundedOrderLength), so every existing
 *   consumer reads a gutter takeoff with no special case. The downspout trio
 *   rides in an additional `downspout` block that today only this adapter's
 *   prompt overlay knows how to map.
 *
 *   That block is the gap: a general multi-material result contract — one the
 *   estimate, work-order, and material-order mappers understand generically —
 *   is core-platform work, not adapter work. Fencing (fence + posts + gates),
 *   siding (panel + trim), and flooring (plank + underlayment) all hit it next.
 *   Until it exists, a downspout quantity reaches a record only through the
 *   materialOrder / estimate instructions in this adapter's manifest.
 *
 * THE STRUCTURAL DECISION IN THIS FILE
 *   Gutter and downspout are both measured in feet and are NOT the same
 *   material. Summing them is the mistake this trade's takeoffs actually make.
 *   So downspouts are a separate input key (`input.downspouts`), never a
 *   section shape — the shape of the input makes the merge impossible rather
 *   than relying on the prompt overlay to prevent it. Every downstream total
 *   stays in its own branch of the result.
 *
 * WHAT THIS DOES NOT DO, ON PURPOSE
 *   No gutter or downspout capacity sizing (roof drainage area, rainfall
 *     intensity, and outlet sizing are code calculations — IPC / SMACNA).
 *   No slope-of-run or expansion-joint specification.
 *   No fascia, structural, or attachment assessment.
 *   No miter, end cap, or outlet derivation from a footprint — a footprint
 *     does not say where a run stops, so those are reported only as stated.
 *   No gutter guard fitment or length (v1.1, needs a product setting).
 *   No per-run stick allocation or end-hanger allowance (v1.1) — the stick and
 *     hanger counts below are whole-job divisions and say so in their `basis`.
 */

import {
  lengthOutputUnit,
  measurementError,
  metersTo,
  normalizedLength,
  roundMeasurement,
  roundUpToIncrement,
} from '../measurements.js';

// CONTRACT: must match manifest.calculators[0].shapes exactly.
const SHAPES = new Set(['gutter_run', 'rectangle_eaves']);

const INCHES_PER_FOOT = 12;
const MILLIMETERS_TO_METERS = 0.001;

/**
 * Every countable unit in this file goes through here.
 *
 * `Math.ceil(total / per)` is wrong for this trade. Gutter lengths land on
 * exact multiples of their spacing constantly — 160 ft at 24 in on centre is
 * exactly 80 hangers — and after a round trip through canonical metres the
 * quotient comes back as 80.000000000000014, which ceils to 81. A relative
 * tolerance absorbs that without ever turning a real partial unit into a whole
 * one: 80.5 still rounds up to 81.
 */
function countUnits(total, per) {
  return Math.ceil(total / per - 1e-9);
}

/**
 * Which sides of a footprint carry gutter. There is no default: "gutter on a
 * 28x52 ranch" without naming the sides is an unanswerable question and must
 * produce a targeted error rather than a guess, the same way a roofing
 * footprint without a pitch does.
 */
const EAVE_SIDES = {
  all: { meters: (l, w) => 2 * (l + w), text: 'all four sides' },
  length_sides: { meters: (l) => 2 * l, text: 'both length sides' },
  width_sides: { meters: (l, w) => 2 * w, text: 'both width sides' },
  one_length: { meters: (l) => l, text: 'one length side' },
  one_width: { meters: (l, w) => w, text: 'one width side' },
};

function quantityText(quantity) {
  return `${quantity.value} ${quantity.unit}`;
}

function configuredNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInteger(value, label) {
  const count = value == null ? 1 : Number(value);
  if (!Number.isFinite(count) || count <= 0 || !Number.isInteger(count)) {
    throw measurementError(`${label} count must be a positive whole number.`);
  }
  return count;
}

// ── STAGE 2 + geometry ──────────────────────────────────────────────────────
function sectionLength(section, outputUnit, index) {
  const shape = String(section?.shape || '');
  if (!SHAPES.has(shape)) throw measurementError(`Section ${index + 1} has an unsupported shape.`);
  const label = String(section.label || '').trim() || `Section ${index + 1}`;
  const count = positiveInteger(section.count, label);

  let meters;
  let expression;
  let sides = null;

  if (shape === 'gutter_run') {
    // A measured run of gutter, front to back. Nothing is derived here.
    const length = normalizedLength(section.length, `${label} length`);
    meters = length.meters * count;
    expression = `${quantityText(length)}${count === 1 ? '' : ` × ${count}`}`;
  } else {
    // A building footprint plus an explicit statement of which sides carry
    // gutter. The side selection is the whole point of the shape — without it
    // we would be inventing scope.
    const key = section.sides == null ? '' : String(section.sides);
    if (!key) {
      throw measurementError(`${label} needs which sides carry gutter (all, length_sides, width_sides, one_length, or one_width) before a footprint can be converted to gutter length.`);
    }
    if (!Object.prototype.hasOwnProperty.call(EAVE_SIDES, key)) {
      throw measurementError(`${label} side selection "${section.sides}" was not recognized. Use all, length_sides, width_sides, one_length, or one_width.`);
    }
    sides = EAVE_SIDES[key];
    const length = normalizedLength(section.length, `${label} length`);
    const width = normalizedLength(section.width, `${label} width`);
    meters = sides.meters(length.meters, width.meters) * count;
    expression = `${quantityText(length)} × ${quantityText(width)} footprint, ${sides.text}${count === 1 ? '' : ` × ${count}`}`;
  }

  const length = metersTo(meters, outputUnit);
  const operation = section.operation === 'subtract' ? 'subtract' : 'add';

  return {
    label,
    shape,
    operation,
    count,
    sides: sides == null ? null : { stated: String(section.sides), description: sides.text },
    length: { value: roundMeasurement(length), unit: outputUnit, quantityKind: 'length' },
    equation: `${expression} = ${roundMeasurement(length)} ${outputUnit}`,
    signedMeters: operation === 'subtract' ? -meters : meters,
  };
}

/**
 * Downspouts. A separate material with a separate total — see the header.
 * A downspout entry is a drop height and a count; the calculator never infers
 * how many drops a roof needs or how tall they are.
 */
function normalizeDownspouts(downspouts, outputUnit) {
  if (downspouts == null) return null;
  if (!Array.isArray(downspouts)) {
    throw measurementError('Downspouts must be given as a list of drops, each with a height and a count.');
  }
  if (!downspouts.length) return null;

  let totalMeters = 0;
  let totalCount = 0;
  const entries = downspouts.map((entry, index) => {
    const label = String(entry?.label || '').trim() || `Downspout ${index + 1}`;
    const count = positiveInteger(entry?.count, label);
    const height = normalizedLength(entry?.height, `${label} height`);
    const meters = height.meters * count;
    totalMeters += meters;
    totalCount += count;
    return {
      label,
      count,
      height: { value: height.value, unit: height.unit, quantityKind: 'length' },
      length: { value: roundMeasurement(metersTo(meters, outputUnit)), unit: outputUnit, quantityKind: 'length' },
      equation: `${quantityText(height)} × ${count} = ${roundMeasurement(metersTo(meters, outputUnit))} ${outputUnit}`,
    };
  });

  return { entries, totalMeters, totalCount };
}

/**
 * Stated accessory counts pass through untouched. Deriving a miter count from a
 * footprint would be inventing scope: a footprint does not say where a run
 * stops, whether a corner is inside or outside, or whether two runs meet at all.
 */
function normalizeStatedAccessories(accessories) {
  if (accessories == null) return null;
  if (typeof accessories !== 'object' || Array.isArray(accessories)) {
    throw measurementError('Accessory counts must be given as named counts such as insideMiters, outsideMiters, endCaps, or outlets.');
  }
  const allowed = ['insideMiters', 'outsideMiters', 'endCaps', 'outlets'];
  const stated = {};
  let any = false;
  for (const key of allowed) {
    if (accessories[key] == null) continue;
    const value = Number(accessories[key]);
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw measurementError(`${key} must be a whole number of zero or more.`);
    }
    stated[key] = { count: value, basis: 'stated by the user' };
    any = true;
  }
  return any ? stated : null;
}

/**
 * STAGES 4 + 5 for one material. Raw, waste, and rounded order stay three
 * separate numbers all the way out — they go to three different records.
 */
function applyWasteAndRound(rawLength, wastePercent, roundingIncrement, outputUnit) {
  const wasteLength = rawLength * (wastePercent / 100);
  const lengthWithWaste = rawLength + wasteLength;
  const roundedOrderLength = roundUpToIncrement(lengthWithWaste, roundingIncrement);
  const quantity = (value) => ({ value: roundMeasurement(value), unit: outputUnit, quantityKind: 'length' });
  return {
    rawLength: quantity(rawLength),
    waste: { percent: wastePercent, length: quantity(wasteLength) },
    lengthWithWaste: quantity(lengthWithWaste),
    roundedOrderLength: quantity(roundedOrderLength),
    _rounded: roundedOrderLength,
  };
}

function stockEstimate(orderLength, stockLength, outputUnit, basis) {
  if (!Number.isFinite(stockLength) || stockLength <= 0) return null;
  return {
    stockLength: { value: stockLength, unit: outputUnit, quantityKind: 'length' },
    count: countUnits(orderLength, stockLength),
    basis,
  };
}

export function calculateGutterLength(input = {}, context = {}) {
  // ── STAGE 1: validate ─────────────────────────────────────────────────────
  const sections = Array.isArray(input.sections) ? input.sections : [];
  const downspoutDetail = normalizeDownspouts(input.downspouts, lengthOutputUnit(context.measurementSystem === 'metric' ? 'metric' : 'imperial'));
  if (!sections.length && !downspoutDetail) {
    throw measurementError('At least one gutter section or one downspout is required.');
  }

  const measurementSystem = context.measurementSystem === 'metric' ? 'metric' : 'imperial';
  const outputUnit = lengthOutputUnit(measurementSystem);
  const config = context.config || {};
  const assumptions = [];
  const flags = [];

  // ── STAGE 2 + 3: normalize and aggregate ─────────────────────────────────
  const calculatedSections = sections.map((section, index) => sectionLength(section, outputUnit, index));
  const rawMeters = calculatedSections.reduce((sum, section) => sum + section.signedMeters, 0);
  if (sections.length && !(rawMeters > 0)) {
    throw measurementError('The calculated gutter length must be greater than zero after deductions.');
  }

  // ── STAGE 4: waste ────────────────────────────────────────────────────────
  // `== null`, never falsy: a contractor who says "no waste on this one" gets 0.
  const configuredWaste = configuredNumber(config?.estimating?.defaultWastePercent, 0);
  const wastePercent = input.wastePercent == null ? configuredWaste : Number(input.wastePercent);
  if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) {
    throw measurementError('Waste percent must be between 0 and 100.');
  }
  if (input.wastePercent == null) assumptions.push(`Used the tenant waste setting of ${wastePercent}%.`);

  // ── STAGE 5: round ────────────────────────────────────────────────────────
  const defaultRounding = measurementSystem === 'metric'
    ? configuredNumber(config?.estimating?.orderRoundingM, 0.5)
    : configuredNumber(config?.estimating?.orderRoundingFt, 1);
  const roundingIncrement = input.orderRoundingIncrement == null
    ? defaultRounding
    : Number(input.orderRoundingIncrement);
  if (!Number.isFinite(roundingIncrement) || roundingIncrement <= 0) {
    throw measurementError('Order rounding increment must be greater than zero.');
  }
  if (input.orderRoundingIncrement == null) {
    assumptions.push(`Used the tenant order-rounding setting of ${roundingIncrement} ${outputUnit}.`);
  }

  const rawGutterLength = sections.length ? metersTo(rawMeters, outputUnit) : null;
  const gutter = rawGutterLength == null
    ? null
    : applyWasteAndRound(rawGutterLength, wastePercent, roundingIncrement, outputUnit);

  // Downspout carries its own copy of the same three numbers. Same waste
  // percentage, because it is field material cut from stock too — but a
  // separate total, so nothing downstream can merge the two materials.
  const downspout = downspoutDetail
    ? applyWasteAndRound(metersTo(downspoutDetail.totalMeters, outputUnit), wastePercent, roundingIncrement, outputUnit)
    : null;

  // ── STAGE 6: countable units ──────────────────────────────────────────────
  // Every count below is omitted rather than guessed when the tenant has not
  // configured the stock length or spacing it depends on.
  const materialEstimates = {};

  if (gutter) {
    const configuredStock = measurementSystem === 'metric'
      ? configuredNumber(config?.materials?.gutterStockLengthM, 0)
      : configuredNumber(config?.materials?.gutterStockLengthFt, 0);
    const stock = input.gutterStockLength == null ? configuredStock : Number(input.gutterStockLength);
    const sticks = stockEstimate(gutter._rounded, stock, outputUnit, 'rounded order length ÷ stock length; it does not allocate an offcut to each individual run');
    if (sticks) {
      materialEstimates.gutterSticks = sticks;
      if (input.gutterStockLength == null) assumptions.push(`Used the tenant sectional gutter stock length of ${stock} ${outputUnit}.`);
    } else if (input.gutterStockLength != null) {
      throw measurementError('Gutter stock length must be greater than zero.');
    }

    const configuredCoil = measurementSystem === 'metric'
      ? configuredNumber(config?.materials?.gutterCoilLengthM, 0)
      : configuredNumber(config?.materials?.gutterCoilLengthFt, 0);
    const coil = input.gutterCoilLength == null ? configuredCoil : Number(input.gutterCoilLength);
    const coils = stockEstimate(gutter._rounded, coil, outputUnit, 'rounded order length ÷ coil run length');
    if (coils) {
      materialEstimates.gutterCoils = coils;
      if (input.gutterCoilLength == null) assumptions.push(`Used the tenant seamless coil length of ${coil} ${outputUnit}.`);
    } else if (input.gutterCoilLength != null) {
      throw measurementError('Gutter coil length must be greater than zero.');
    }
  }

  if (downspout) {
    const configuredDs = measurementSystem === 'metric'
      ? configuredNumber(config?.materials?.downspoutStockLengthM, 0)
      : configuredNumber(config?.materials?.downspoutStockLengthFt, 0);
    const stock = input.downspoutStockLength == null ? configuredDs : Number(input.downspoutStockLength);
    const sticks = stockEstimate(downspout._rounded, stock, outputUnit, 'rounded order downspout length ÷ stock length; it does not allocate an offcut to each individual drop');
    if (sticks) {
      materialEstimates.downspoutSticks = sticks;
      if (input.downspoutStockLength == null) assumptions.push(`Used the tenant downspout stock length of ${stock} ${outputUnit}.`);
    } else if (input.downspoutStockLength != null) {
      throw measurementError('Downspout stock length must be greater than zero.');
    }
  }

  // Hangers follow the gutter that actually gets hung, so they are figured on
  // the raw length — never on the waste-inflated, rounded order length.
  const accessoryEstimates = {};
  if (gutter) {
    // Hanger spacing is stated in inches or millimetres, the way the trade
    // actually says it. Converting it into the output unit — rather than the
    // gutter length into the spacing unit — keeps the division in the same
    // units the contractor is reading.
    const spacingValue = measurementSystem === 'metric'
      ? configuredNumber(config?.materials?.hangerSpacingMm, 0)
      : configuredNumber(config?.materials?.hangerSpacingIn, 0);
    const spacingUnit = measurementSystem === 'metric' ? 'mm' : 'in';
    const spacingInOutputUnit = measurementSystem === 'metric'
      ? spacingValue * MILLIMETERS_TO_METERS
      : spacingValue / INCHES_PER_FOOT;
    if (spacingInOutputUnit > 0) {
      accessoryEstimates.hangers = {
        spacing: { value: spacingValue, unit: spacingUnit, quantityKind: 'length' },
        count: countUnits(rawGutterLength, spacingInOutputUnit),
        basis: 'raw gutter length ÷ on-center spacing, before waste; it does not add an end hanger per run',
      };
      assumptions.push(`Used the tenant hanger spacing of ${spacingValue} ${spacingUnit} on center.`);
    }
  }

  if (downspoutDetail) {
    const elbowsPer = configuredNumber(config?.materials?.elbowsPerDownspout, 0);
    const stated = input.elbowsPerDownspout == null ? elbowsPer : Number(input.elbowsPerDownspout);
    if (Number.isFinite(stated) && stated > 0) {
      accessoryEstimates.elbows = {
        perDownspout: stated,
        count: stated * downspoutDetail.totalCount,
        basis: 'downspout count × elbows per downspout',
      };
      if (input.elbowsPerDownspout == null) assumptions.push(`Used the tenant elbow allowance of ${stated} per downspout.`);
    } else if (input.elbowsPerDownspout != null && !(Number.isFinite(stated) && stated >= 0)) {
      throw measurementError('Elbows per downspout must be zero or greater.');
    }
  }

  const statedAccessories = normalizeStatedAccessories(input.accessories);
  if (statedAccessories) Object.assign(accessoryEstimates, statedAccessories);

  // ── Advisory flags. A flag prompts a human to look; it never changes a
  // quantity, a price, a crew, a gutter size, or a downspout count. ─────────
  const maxRunPerDownspout = measurementSystem === 'metric'
    ? configuredNumber(config?.operations?.maxRunPerDownspoutM, 0)
    : configuredNumber(config?.operations?.maxRunPerDownspoutFt, 0);
  if (gutter && maxRunPerDownspout > 0) {
    if (!downspoutDetail) {
      flags.push('No downspouts were stated for this gutter length. Confirm the drop count and locations before ordering — the calculation does not add one.');
    } else {
      const perDownspout = gutter.rawLength.value / downspoutDetail.totalCount;
      if (perDownspout >= maxRunPerDownspout) {
        flags.push(`About ${roundMeasurement(perDownspout)} ${outputUnit} of gutter per downspout is at or above the review threshold of ${maxRunPerDownspout} ${outputUnit}. Review drainage, gutter size, and drop count before committing.`);
      }
    }
  }

  // ── STAGE 7: disclose ─────────────────────────────────────────────────────
  const strip = (material) => {
    if (!material) return null;
    const { _rounded: _r, ...rest } = material;
    return rest;
  };

  return {
    calculator: 'gutter.length',
    calculatorVersion: '1.0.0',
    mode: 'read_only',
    measurementSystem,
    outputUnit,
    sections: calculatedSections.map(({ signedMeters: _signed, ...section }) => section),

    // ── Primary material: gutter. Same field names as concrete and roofing, so
    // no downstream consumer needs a gutter-specific branch. Null only on a
    // downspout-only takeoff, where there is no gutter to report.
    rawLength: gutter ? gutter.rawLength : null,
    waste: gutter ? gutter.waste : { percent: wastePercent, length: null },
    lengthWithWaste: gutter ? gutter.lengthWithWaste : null,
    orderRoundingIncrement: { value: roundingIncrement, unit: outputUnit, quantityKind: 'length' },
    roundedOrderLength: gutter ? gutter.roundedOrderLength : null,

    // ── Second material: downspout. See the flag at the top of this file — the
    // trio is deliberately kept separate from gutter's and is never summed with
    // it, which is the error this trade's takeoffs actually make.
    downspout: downspout == null ? null : {
      ...strip(downspout),
      count: downspoutDetail.totalCount,
      drops: downspoutDetail.entries,
    },
    materialEstimates: Object.keys(materialEstimates).length ? materialEstimates : null,
    accessoryEstimates: Object.keys(accessoryEstimates).length ? accessoryEstimates : null,
    assumptions,
    flags,
    warning: 'Material-planning estimate only. Verify field measurements, gutter profile and size, material, gauge and finish, fascia and roof-edge condition, hanger type and spacing, downspout size, count and discharge, manufacturer requirements, supplier availability, and local code before ordering or installing.',
  };
}
