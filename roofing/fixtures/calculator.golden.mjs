// Golden math fixture for roofing.area v1.0.0.
// Run standalone:  cp ../../_skeleton/fixtures/measurements.stub.js ../../measurements.js && node calculator.golden.mjs
// In CI, point the calculator at the real measurements.js instead.
import { calculateRoofArea } from '../calculator.js';

const cfg = {
  estimating: { defaultWastePercent: 10, orderRoundingFt2: 100, orderRoundingM2: 5, steepSlopeThreshold: 8 },
  materials: { bundleCoverageFt2: 33.33, bundleCoverageM2: 3.1, ridgeCapCoverageFt: 20, starterCoverageFt: 100, underlaymentRollCoverageFt2: 400 },
};
const imp = { measurementSystem: 'imperial', config: cfg };
const met = { measurementSystem: 'metric', config: cfg };
let fails = 0;
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;
function check(name, got, want, tol) {
  const ok = near(got, want, tol);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got}, expected ${want}`);
}

// 1. Pitch multipliers against the published slope-factor table.
for (const [pitch, factor] of [['4/12',1.0541],['6/12',1.1180],['8/12',1.2019],['12/12',1.4142]]) {
  const r = calculateRoofArea({ sections: [{ shape:'plan_footprint', length:'100 ft', width:'100 ft', pitch }], wastePercent: 0, orderRoundingIncrement: 0.01 }, imp);
  check(`slope factor ${pitch}`, r.sections[0].pitch.slopeFactor, Math.round(factor*10000)/10000);
  check(`area ${pitch}`, r.rawArea.value, Math.round(10000*factor*100)/100, 1);
}

// 2. Degrees and ratio agree. 26.565 deg == 6/12.
const deg = calculateRoofArea({ sections: [{ shape:'plan_footprint', length:'32 ft', width:'46 ft', pitch:'26.565 deg' }] }, imp);
const rat = calculateRoofArea({ sections: [{ shape:'plan_footprint', length:'32 ft', width:'46 ft', pitch:'6/12' }] }, imp);
check('degrees == ratio', deg.rawArea.value, rat.rawArea.value, 0.05);

// 3. The headline case: 32x46 at 6/12, 10% waste, round to the square.
const a = calculateRoofArea({ sections: [{ shape:'plan_footprint', label:'Main', length:'32 ft', width:'46 ft', pitch:'6/12' }] }, imp);
check('32x46 @6/12 raw ft2', a.rawArea.value, 1472*1.118, 0.5);   // 1645.7
check('raw squares', a.squares.raw.value, 16.46, 0.02);
check('waste ft2', a.waste.area.value, 164.57, 0.5);
check('rounded order ft2', a.roundedOrderArea.value, 1900, 0);     // 1810.3 -> 1900
check('order squares', a.squares.order.value, 19, 0);
check('bundles', a.bundleEstimate.bundles, Math.ceil(1900/33.33), 0);
console.log('  equation:', a.sections[0].equation);
console.log('  assumptions:', a.assumptions);

// 4. Measured planes take no multiplier; three planes aggregate.
const p = calculateRoofArea({ sections: [
  { shape:'roof_plane', label:'A', length:'20 ft', width:'30 ft' },
  { shape:'roof_plane', label:'B', length:'20 ft', width:'30 ft' },
  { shape:'roof_plane', label:'Garage', length:'12 ft', width:'18 ft' },
], wastePercent: 0, orderRoundingIncrement: 1 }, imp);
check('3 planes raw', p.rawArea.value, 1416, 0.5);
check('3 planes squares', p.squares.raw.value, 14.16, 0.02);

// 5. Pitch on a measured plane is rejected.
try { calculateRoofArea({ sections:[{ shape:'roof_plane', length:'20 ft', width:'30 ft', pitch:'6/12' }] }, imp); console.log('FAIL  plane+pitch not rejected'); fails++; }
catch (e) { console.log('PASS  plane+pitch rejected:', e.message.slice(0,60)+'...'); }

// 6. Footprint without pitch is rejected, not defaulted.
try { calculateRoofArea({ sections:[{ shape:'plan_footprint', length:'32 ft', width:'46 ft' }] }, imp); console.log('FAIL  missing pitch not rejected'); fails++; }
catch (e) { console.log('PASS  missing pitch rejected:', e.message.slice(0,70)+'...'); }

// 7. Subtraction (skylight) and triangle.
const s = calculateRoofArea({ sections: [
  { shape:'roof_plane', label:'Field', length:'40 ft', width:'30 ft' },
  { shape:'triangle_plane', label:'Gable', base:'20 ft', height:'8 ft' },
  { shape:'roof_plane', label:'Skylight', length:'6 ft', width:'8 ft', operation:'subtract' },
], wastePercent: 0, orderRoundingIncrement: 1 }, imp);
check('subtract + triangle', s.rawArea.value, 1200 + 80 - 48, 0.5);

// 8. Over-subtraction errors.
try { calculateRoofArea({ sections:[{ shape:'roof_plane', length:'10 ft', width:'10 ft', operation:'subtract' }] }, imp); console.log('FAIL  net-zero not rejected'); fails++; }
catch (e) { console.log('PASS  net-zero rejected:', e.message.slice(0,50)+'...'); }

// 9. User-supplied zero waste is honored, not replaced by the tenant default.
const z = calculateRoofArea({ sections:[{ shape:'roof_plane', length:'10 ft', width:'10 ft' }], wastePercent: 0, orderRoundingIncrement: 1 }, imp);
check('explicit 0% waste honored', z.waste.area.value, 0, 0);
console.log(`${z.assumptions.some(x=>x.includes('waste')) ? 'FAIL' : 'PASS'}  no waste assumption emitted when user stated it`);
if (z.assumptions.some(x=>x.includes('waste'))) fails++;

// 10. Metric parity: same physical roof, same square meters, squares omitted.
const mi = calculateRoofArea({ sections:[{ shape:'roof_plane', length:'10 m', width:'10 m' }], wastePercent:0, orderRoundingIncrement:0.01 }, met);
const ii = calculateRoofArea({ sections:[{ shape:'roof_plane', length:'10 m', width:'10 m' }], wastePercent:0, orderRoundingIncrement:0.01 }, imp);
check('metric m2', mi.rawArea.value, 100, 0.01);
check('imperial ft2 of same roof', ii.rawArea.value, 1076.39, 0.05);
console.log(`${mi.squares === null ? 'PASS' : 'FAIL'}  squares omitted for metric tenant`);
if (mi.squares !== null) fails++;

// 11. Accessories gate on both a stated run and a configured coverage.
const acc = calculateRoofArea({ sections:[{ shape:'roof_plane', length:'40 ft', width:'30 ft' }],
  linears: { ridge:'32 ft', hip:'48 ft', eave:'96 ft', rake:'40 ft' } }, imp);
check('hip+ridge bundles (80ft / 20ft)', acc.accessoryEstimates.hipAndRidge.count, 4, 0);
check('starter bundles (96ft / 100ft)', acc.accessoryEstimates.starter.count, 1, 0);
console.log('  starter basis:', acc.accessoryEstimates.starter.basis);
check('underlayment rolls on RAW area (1200/400)', acc.accessoryEstimates.underlayment.count, 3, 0);
console.log('  underlayment basis:', acc.accessoryEstimates.underlayment.basis);
console.log('  linear totals:', JSON.stringify(acc.linearTotals));

// 12. No coverage configured -> counts omitted entirely, not guessed.
const bare = calculateRoofArea({ sections:[{ shape:'roof_plane', length:'40 ft', width:'30 ft' }], linears:{ ridge:'32 ft', eave:'96 ft' } },
  { measurementSystem:'imperial', config:{ estimating:{ defaultWastePercent:10, orderRoundingFt2:100 } } });
console.log(`${bare.bundleEstimate === null && bare.accessoryEstimates === null ? 'PASS' : 'FAIL'}  counts omitted when tenant coverage unset`);
if (!(bare.bundleEstimate === null && bare.accessoryEstimates === null)) fails++;

// 13. Steep-slope flag is advisory and threshold-driven.
const steep = calculateRoofArea({ sections:[{ shape:'plan_footprint', length:'30 ft', width:'40 ft', pitch:'10/12' }] }, imp);
const walk  = calculateRoofArea({ sections:[{ shape:'plan_footprint', length:'30 ft', width:'40 ft', pitch:'5/12' }] }, imp);
console.log(`${steep.flags.length === 1 && walk.flags.length === 0 ? 'PASS' : 'FAIL'}  steep flag fires at 10/12, not 5/12`);
if (!(steep.flags.length === 1 && walk.flags.length === 0)) fails++;
console.log('  flag:', steep.flags[0]);

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
