// Stub standing in for the shared measurement service.
const FT = 0.3048;
export function measurementError(message) { const e = new Error(message); e.code = 'MEASUREMENT'; return e; }
export function roundMeasurement(v) { return Math.round(v * 100) / 100; }
export function roundUpToIncrement(v, inc) { return Math.ceil((v - 1e-9) / inc) * inc; }
export function areaOutputUnit(sys) { return sys === 'metric' ? 'm2' : 'ft2'; }
export function squareMetersTo(m2, unit) { return unit === 'm2' ? m2 : m2 / (FT * FT); }
export function normalizedLength(input, label) {
  if (input == null || input === '') throw measurementError(`${label} is required.`);
  let value, unit;
  if (typeof input === 'object') { value = Number(input.value); unit = String(input.unit || 'ft'); }
  else {
    const m = String(input).trim().match(/^(-?\d+(?:\.\d+)?)\s*([a-z"']*)$/i);
    if (!m) throw measurementError(`${label} was not recognized.`);
    value = Number(m[1]); unit = (m[2] || 'ft').toLowerCase();
  }
  const map = { ft: FT, foot: FT, feet: FT, "'": FT, in: FT/12, inch: FT/12, inches: FT/12, '"': FT/12, m: 1, meter: 1, meters: 1, mm: 0.001, cm: 0.01 };
  if (!(unit in map)) throw measurementError(`${label} has an unsupported unit "${unit}".`);
  if (!Number.isFinite(value) || value <= 0) throw measurementError(`${label} must be greater than zero.`);
  return { value, unit, meters: value * map[unit] };
}
// Length pair, added for the gutter adapter. The real implementations belong in
// the shared measurement service alongside the volume and area pairs.
export function lengthOutputUnit(sys) { return sys === 'metric' ? 'm' : 'ft'; }
export function metersTo(m, unit) { return unit === 'm' ? m : m / FT; }
