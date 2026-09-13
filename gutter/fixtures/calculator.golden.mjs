// Golden math fixture for gutter.length v1.0.0.
// Run standalone:  cp ../../_skeleton/fixtures/measurements.stub.js ../../measurements.js && node calculator.golden.mjs
// In CI, point the calculator at the real measurements.js instead.
import { calculateGutterLength } from '../calculator.js';

const cfg = {
  estimating: { defaultWastePercent: 5, orderRoundingFt: 1, orderRoundingM: 0.5 },
  materials: {
    gutterStockLengthFt: 10, gutterCoilLengthFt: 300, downspoutStockLengthFt: 10,
    hangerSpacingIn: 24, elbowsPerDownspout: 2,
  },
  operations: { maxRunPerDownspoutFt: 40, maxRunPerDownspoutM: 12 },
};
const imp = { measurementSystem: 'imperial', config: cfg };
const met = { measurementSystem: 'metric', config: { ...cfg, materials: { hangerSpacingMm: 600 } } };
let fails = 0;
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;
function check(name, got, want, tol) {
  const ok = near(got, want, tol);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got}, expected ${want}`);
}
function ok(name, condition) {
  if (!condition) fails++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
}
function throws(name, fn) {
  try { fn(); console.log(`FAIL  ${name} — did not throw`); fails++; }
  catch (e) { console.log(`PASS  ${name}: ${e.message.slice(0, 72)}...`); }
}

// 1. A measured run is taken at face value — nothing is derived from it.
const one = calculateGutterLength({ sections: [{ shape: 'gutter_run', label: 'Front', length: '160 ft' }], wastePercent: 0, orderRoundingIncrement: 1 }, imp);
check('single 160 ft run', one.rawLength.value, 160, 0);
console.log('  equation:', one.sections[0].equation);

// 2. The headline case: 160 ft, four two-story drops, tenant defaults.
const a = calculateGutterLength({
  sections: [{ shape: 'gutter_run', label: 'Front + back', length: '160 ft' }],
  downspouts: [{ label: 'Rear', height: '22 ft', count: 4 }],
}, imp);
check('gutter raw ft', a.rawLength.value, 160, 0);
check('gutter waste ft (5%)', a.waste.length.value, 8, 0);
check('gutter rounded order ft', a.roundedOrderLength.value, 168, 0);
check('downspout raw ft', a.downspout.rawLength.value, 88, 0);
check('downspout rounded order ft', a.downspout.roundedOrderLength.value, 93, 0);
check('downspout count', a.downspout.count, 4, 0);
check('gutter sticks (168/10)', a.materialEstimates.gutterSticks.count, 17, 0);
check('gutter coils (168/300)', a.materialEstimates.gutterCoils.count, 1, 0);
check('downspout sticks (93/10)', a.materialEstimates.downspoutSticks.count, 10, 0);
check('elbows (4 × 2)', a.accessoryEstimates.elbows.count, 8, 0);
console.log('  assumptions:', a.assumptions);

// 3. THE STRUCTURAL PROPERTY: gutter and downspout are never summed.
ok('gutter and downspout stay separate materials',
  a.rawLength.value === 160 && a.downspout.rawLength.value === 88 && a.rawLength.value !== 248);
ok('the two materials are never summed into one figure',
  a.rawLength.value !== 248 && !('totalLength' in a));
ok('gutter uses the same top-level field names as concrete and roofing',
  ['rawLength', 'waste', 'lengthWithWaste', 'orderRoundingIncrement', 'roundedOrderLength'].every((k) => k in a));

// 4. Hangers follow the RAW gutter length, not the waste-inflated order length.
check('hangers on raw 160 ft @ 24 in oc', a.accessoryEstimates.hangers.count, 80, 0);
ok('hangers are not figured on the 168 ft order length', a.accessoryEstimates.hangers.count !== 84);
console.log('  hanger basis:', a.accessoryEstimates.hangers.basis);

// 5. Footprint sides: each selection resolves to a hand-checked perimeter.
const sides = (key) => calculateGutterLength({
  sections: [{ shape: 'rectangle_eaves', label: 'Ranch', length: '52 ft', width: '28 ft', sides: key }],
  wastePercent: 0, orderRoundingIncrement: 1,
}, imp).rawLength.value;
check('28x52 all four sides', sides('all'), 160, 0);
check('28x52 both length sides', sides('length_sides'), 104, 0);
check('28x52 both width sides', sides('width_sides'), 56, 0);
check('28x52 one width side', sides('one_width'), 28, 0);

// 6. A footprint with no side selection is rejected, not defaulted to all four.
throws('missing side selection rejected', () => calculateGutterLength({
  sections: [{ shape: 'rectangle_eaves', length: '52 ft', width: '28 ft' }],
}, imp));
throws('unrecognized side selection rejected', () => calculateGutterLength({
  sections: [{ shape: 'rectangle_eaves', length: '52 ft', width: '28 ft', sides: 'front' }],
}, imp));

// 7. Deductions are a section, not an edited dimension.
const sub = calculateGutterLength({ sections: [
  { shape: 'gutter_run', label: 'Perimeter', length: '160 ft' },
  { shape: 'gutter_run', label: 'Porch', length: '12 ft', operation: 'subtract' },
], wastePercent: 0, orderRoundingIncrement: 1 }, imp);
check('160 ft less a 12 ft porch', sub.rawLength.value, 148, 0);

// 8. Over-subtraction errors rather than returning a zero order.
throws('net-zero gutter rejected', () => calculateGutterLength({
  sections: [{ shape: 'gutter_run', length: '20 ft', operation: 'subtract' }],
}, imp));

// 9. A user-supplied 0 survives and emits no assumption. The regression that matters most.
const z = calculateGutterLength({ sections: [{ shape: 'gutter_run', length: '100 ft' }], wastePercent: 0, orderRoundingIncrement: 1 }, imp);
check('explicit 0% waste honored', z.waste.length.value, 0, 0);
ok('no waste assumption emitted when the user stated it', !z.assumptions.some((x) => x.includes('waste')));

// 10. Metric parity: the same physical run, described two ways.
const mi = calculateGutterLength({ sections: [{ shape: 'gutter_run', length: '100 m' }], wastePercent: 0, orderRoundingIncrement: 0.01 }, met);
const ii = calculateGutterLength({ sections: [{ shape: 'gutter_run', length: '100 m' }], wastePercent: 0, orderRoundingIncrement: 0.01 }, imp);
check('metric m', mi.rawLength.value, 100, 0.01);
check('imperial ft of the same run', ii.rawLength.value, 328.08, 0.05);
check('metric hangers @ 600 mm oc', mi.accessoryEstimates.hangers.count, 167, 0);

// 11. Counts are omitted, not guessed, when the tenant has configured nothing.
const bare = calculateGutterLength({
  sections: [{ shape: 'gutter_run', length: '160 ft' }],
  downspouts: [{ height: '22 ft', count: 4 }],
}, { measurementSystem: 'imperial', config: { estimating: { defaultWastePercent: 5, orderRoundingFt: 1 } } });
ok('stick, coil, hanger and elbow counts omitted when unset',
  bare.materialEstimates === null && bare.accessoryEstimates === null);

// 12. Stated accessory counts pass through; they are never derived.
const acc = calculateGutterLength({
  sections: [{ shape: 'rectangle_eaves', length: '52 ft', width: '28 ft', sides: 'all' }],
  accessories: { insideMiters: 0, outsideMiters: 4, endCaps: 2, outlets: 3 },
  wastePercent: 0, orderRoundingIncrement: 1,
}, { measurementSystem: 'imperial', config: {} });
check('stated outside miters pass through', acc.accessoryEstimates.outsideMiters.count, 4, 0);
check('a stated zero passes through as zero', acc.accessoryEstimates.insideMiters.count, 0, 0);
ok('no miter count is derived from the footprint', acc.accessoryEstimates.outsideMiters.basis === 'stated by the user');
throws('fractional accessory count rejected', () => calculateGutterLength({
  sections: [{ shape: 'gutter_run', length: '100 ft' }], accessories: { endCaps: 2.5 },
}, imp));

// 13. Downspout-only work is a valid takeoff.
const dsOnly = calculateGutterLength({ downspouts: [{ height: '11 ft', count: 2 }], wastePercent: 0, orderRoundingIncrement: 1 }, imp);
check('downspout-only raw ft', dsOnly.downspout.rawLength.value, 22, 0);
ok('gutter fields are null on a downspout-only takeoff', dsOnly.rawLength === null && dsOnly.roundedOrderLength === null);

// 14. Advisory flags: threshold-driven, never quantity-changing.
ok('40 ft per downspout hits the review threshold', a.flags.length === 1);
console.log('  flag:', a.flags[0]);
const easy = calculateGutterLength({
  sections: [{ shape: 'gutter_run', length: '160 ft' }],
  downspouts: [{ height: '22 ft', count: 6 }],
}, imp);
ok('26.7 ft per downspout does not flag', easy.flags.length === 0);
const noDrops = calculateGutterLength({ sections: [{ shape: 'gutter_run', length: '160 ft' }] }, imp);
ok('a gutter run with no stated drops is flagged, not auto-filled',
  noDrops.flags.length === 1 && noDrops.downspout === null);

// 15. Nothing else is invented.
ok('empty input rejected', (() => { try { calculateGutterLength({}, imp); return false; } catch { return true; } })());

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
