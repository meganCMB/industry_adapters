/**
 * INDUSTRY ADAPTER CALCULATOR — TEMPLATE
 *
 * Derived from concrete/calculator.js (concrete.volume v1.0.0).
 *
 * WHAT A CALCULATOR IS
 *   Reviewed, deterministic code in the trusted runtime. The AI interprets the
 *   user's words and picks a calculator; THIS file does the arithmetic. The AI
 *   never does the math in its head and never rounds on its own.
 *
 * THE SEVEN-STAGE PIPELINE — every trade's takeoff calculator has this shape.
 * Keep the stages and the output field names; swap the geometry.
 *
 *   1. VALIDATE      at least one section; every section shape is registered
 *   2. NORMALIZE     each user dimension → canonical SI via normalized*()
 *   3. AGGREGATE     signed sum (add/subtract) so deductions are first-class
 *   4. WASTE         from input, else tenant setting; recorded as an assumption
 *   5. ROUND         up to the tenant's order increment
 *   6. COUNT         rounded quantity ÷ unit-of-purchase — ONLY if configured
 *   7. DISCLOSE      assumptions, per-section equations, versions, warning
 *
 * FOUR RULES THAT ARE NOT NEGOTIABLE
 *   A. Never substitute a default for a value the user supplied. `== null` is
 *      the test — NOT falsy. A user-supplied 0 is a real answer.
 *   B. Every substituted default pushes a sentence onto `assumptions`. If it
 *      is not in `assumptions`, the tenant cannot see it, and it is a bug.
 *   C. Raw, waste, and rounded stay SEPARATE in the output. Never return one
 *      merged number — the three go to three different records.
 *   D. Throw measurementError() with a human sentence naming the section. The
 *      AI surfaces it to ask ONE targeted question; a generic throw makes the
 *      assistant guess.
 */

import {
  measurementError,
  normalizedLength,
  roundMeasurement,
  roundUpToIncrement,
  // <<import the canonical-unit converter and output-unit helper for this
  //   trade's primary quantity kind, e.g.:
  //   cubicMetersTo, volumeOutputUnit   (volume — concrete)
  //   squareMetersTo, areaOutputUnit    (area   — roofing, flooring, paint)
  //   metersTo,       lengthOutputUnit  (length — gutter, fence, trim) >>
} from '../measurements.js';

// CONTRACT: this Set must match manifest.calculators[n].shapes exactly.
// A contract test compares them.
const SHAPES = new Set([/* '<<shape_a>>', '<<shape_b>>' */]);

function quantityText(quantity) {
  return `${quantity.value} ${quantity.unit}`;
}

/**
 * STAGE 2 + geometry. One section → one canonical-unit figure plus a
 * human-readable equation.
 *
 * `expression` is not decoration. It is what lets a contractor check our work
 * and what makes a wrong answer debuggable in telemetry. Build it from the
 * NORMALIZED quantities, so it shows the units the user actually typed.
 */
function sectionQuantity(section, outputUnit, index) {
  const shape = String(section?.shape || '');
  if (!SHAPES.has(shape)) throw measurementError(`Section ${index + 1} has an unsupported shape.`);
  const label = String(section.label || '').trim() || `Section ${index + 1}`;

  // `count` repeats an identical section (4 piers, 6 dormers). Integer > 0.
  const count = section.count == null ? 1 : Number(section.count);
  if (!Number.isFinite(count) || count <= 0 || !Number.isInteger(count)) {
    throw measurementError(`${label} count must be a positive whole number.`);
  }

  let canonical; // SI: m, m2, or m3 depending on the trade's primary kind
  let expression;

  if (shape === '<<shape_a>>') {
    // const a = normalizedLength(section.<<dim>>, `${label} <<dim>>`);
    // canonical = a.meters * ... * count;
    // expression = `${quantityText(a)} × ... ${count === 1 ? '' : ` × ${count}`}`;
  } else {
    throw measurementError(`${label} has an unsupported shape.`);
  }

  const converted = /* <<canonicalTo>> */ (canonical, outputUnit);

  // STAGE 3: deductions are a first-class shape, not a negative dimension.
  // Openings, cutouts, skylights, windows all come through here.
  const operation = section.operation === 'subtract' ? 'subtract' : 'add';

  return {
    label,
    shape,
    operation,
    count,
    quantity: { value: roundMeasurement(converted), unit: outputUnit, quantityKind: '<<kind>>' },
    equation: `${expression} = ${roundMeasurement(converted)} ${outputUnit}`,
    // Signed canonical value is internal plumbing — it is stripped before the
    // result leaves this function's caller.
    signedCanonical: operation === 'subtract' ? -canonical : canonical,
  };
}

function configuredNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function calculate<<Trade>><<Quantity>>(input = {}, context = {}) {
  // ── STAGE 1: validate ──────────────────────────────────────────────────
  const sections = Array.isArray(input.sections) ? input.sections : [];
  if (!sections.length) throw measurementError('At least one <<trade>> section is required.');

  const measurementSystem = context.measurementSystem === 'metric' ? 'metric' : 'imperial';
  const outputUnit = /* <<kind>>OutputUnit */ (measurementSystem);
  const config = context.config || {};
  const assumptions = [];

  // ── STAGE 2 + 3: normalize and aggregate ───────────────────────────────
  const calculatedSections = sections.map((section, index) => sectionQuantity(section, outputUnit, index));
  const rawCanonical = calculatedSections.reduce((sum, section) => sum + section.signedCanonical, 0);
  // Guard the deduction case: subtracting more than was added is a user error,
  // not a zero-quantity order.
  if (!(rawCanonical > 0)) throw measurementError('The calculated <<quantity>> must be greater than zero after deductions.');

  // ── STAGE 4: waste ─────────────────────────────────────────────────────
  // RULE A in action: `input.wastePercent == null`, never `!input.wastePercent`.
  // A contractor who says "no waste" means 0 and must get 0.
  const configuredWaste = configuredNumber(config?.estimating?.defaultWastePercent, 0);
  const wastePercent = input.wastePercent == null ? configuredWaste : Number(input.wastePercent);
  if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) {
    throw measurementError('Waste percent must be between 0 and 100.');
  }
  // RULE B: disclose the substitution.
  if (input.wastePercent == null) assumptions.push(`Used the tenant waste setting of ${wastePercent}%.`);

  // ── STAGE 5: round ─────────────────────────────────────────────────────
  const defaultRounding = measurementSystem === 'metric'
    ? configuredNumber(config?.estimating?.orderRounding<<Metric>>, <<fallback>>)
    : configuredNumber(config?.estimating?.orderRounding<<Imperial>>, <<fallback>>);
  const roundingIncrement = input.orderRoundingIncrement == null
    ? defaultRounding
    : Number(input.orderRoundingIncrement);
  if (input.orderRoundingIncrement == null) {
    assumptions.push(`Used the tenant order-rounding setting of ${roundingIncrement} ${outputUnit}.`);
  }

  const rawQuantity = /* <<canonicalTo>> */ (rawCanonical, outputUnit);
  const wasteQuantity = rawQuantity * (wastePercent / 100);
  const quantityWithWaste = rawQuantity + wasteQuantity;
  const roundedOrderQuantity = roundUpToIncrement(quantityWithWaste, roundingIncrement);

  // ── STAGE 6: countable units ───────────────────────────────────────────
  // OPTIONAL BY DESIGN. If the tenant has not configured the unit of purchase,
  // return null rather than assuming an industry-standard value. An explicit
  // bad value from the user is an error; an absent setting is just silence.
  const configuredUnitSize = measurementSystem === 'metric'
    ? configuredNumber(config?.operations?.<<unitOfPurchaseMetric>>, 0)
    : configuredNumber(config?.operations?.<<unitOfPurchaseImperial>>, 0);
  const unitSize = input.<<unitOfPurchase>> == null ? configuredUnitSize : Number(input.<<unitOfPurchase>>);
  let unitCount = null;
  if (Number.isFinite(unitSize) && unitSize > 0) {
    unitCount = Math.ceil((roundedOrderQuantity - Number.EPSILON) / unitSize);
    if (input.<<unitOfPurchase>> == null) assumptions.push(`Used the tenant <<unit-of-purchase>> setting of ${unitSize} ${outputUnit}.`);
  } else if (input.<<unitOfPurchase>> != null) {
    throw measurementError('<<Unit of purchase>> must be greater than zero.');
  }

  // ── STAGE 7: disclose ──────────────────────────────────────────────────
  // Field names below are the cross-adapter contract. Downstream prompt text,
  // estimate/work-order/material-order mapping, and telemetry all key off them.
  return {
    calculator: '<<key>>.<<quantity>>',
    calculatorVersion: '1.0.0',
    mode: 'read_only',
    measurementSystem,
    outputUnit,
    // Strip the internal signed value before it leaves.
    sections: calculatedSections.map(({ signedCanonical: _signed, ...section }) => section),
    rawQuantity: { value: roundMeasurement(rawQuantity), unit: outputUnit, quantityKind: '<<kind>>' },
    waste: {
      percent: wastePercent,
      quantity: { value: roundMeasurement(wasteQuantity), unit: outputUnit, quantityKind: '<<kind>>' },
    },
    quantityWithWaste: { value: roundMeasurement(quantityWithWaste), unit: outputUnit, quantityKind: '<<kind>>' },
    orderRoundingIncrement: { value: roundingIncrement, unit: outputUnit, quantityKind: '<<kind>>' },
    roundedOrderQuantity: { value: roundMeasurement(roundedOrderQuantity), unit: outputUnit, quantityKind: '<<kind>>' },
    unitEstimate: unitCount == null ? null : {
      size: { value: unitSize, unit: outputUnit, quantityKind: '<<kind>>' },
      count: unitCount,
    },
    assumptions,
    // CONTRACT: every calculator returns a warning. It is what keeps a takeoff
    // from reading as professional authority. Name this trade's real
    // verification points — the ones a contractor would actually check.
    warning: 'Material-planning estimate only. Verify <<project specifications, supplier requirements, engineering, field conditions, and local code>> before ordering or <<installing>>.',
  };
}
