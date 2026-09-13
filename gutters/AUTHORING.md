# Writing an industry adapter

How to turn a trade into a JobHub adapter, extracted from the concrete
reference adapter and proven a second time on roofing.

Companion to the *JobHub Industry Adapter Architecture Plan* (Docs → Industry
Adapter Proposal). That document says what the platform does. This one says
what **you** write.

The whole point, restated from §1 of that plan:

> Adding a normal industry should require one adapter directory, one registry
> entry, adapter contract tests, and no new `if (industry === ...)` branches in
> core features.

If you find yourself wanting to edit a core route, a settings page, or a shared
prompt while adding an adapter, the contract is wrong. Fix the contract, not
the adapter.

---

## 1. What an adapter is allowed to be

Two files do all the work.

| File | What it is | What it must never be |
|---|---|---|
| `manifest.js` | **Data.** Vocabulary, units, settings schema, prompt overlays, recommendations. | Executable logic, a formula, a price, a permission |
| `calculator.js` | **Reviewed code** in the trusted runtime. Deterministic arithmetic. | A writer of records, a source of pricing, an engineering authority |

The AI decides *which* calculator and *what the user meant*. The calculator
decides *what the number is*. Neither decides whether it gets saved — that
stays with the existing tool, capability, and confirmation path.

---

## 2. The four questions that define a trade

Answer these before writing a line. They determine almost everything else.

**Q1. What is the one quantity this trade sells?**

Concrete sells volume. Roofing sells area. Fencing and gutter sell length.
Painting sells area. Excavation sells volume. That answer picks your primary
`quantityKind`, your calculator's canonical unit, and the shape of every
output field.

**Q2. What is the unit of purchase?**

The countable thing that shows up on a truck. Concrete: a truck (10 yd³).
Roofing: a bundle (33.33 ft²). Drywall: a sheet. This becomes an *optional*
tenant setting, and when it is unset the calculator **omits the count**
rather than assuming one.

**Q3. What must this trade never guess?**

The single most important line in the manifest. Concrete: thickness, strength,
slump, reinforcement. Roofing: pitch, existing layers, deck condition, product
coverage. Write these into `ai.globalInstructions` explicitly, by name. A
generic "don't invent specifications" does not work — the model needs the nouns.

**Q4. What word in this trade is ambiguous?**

Every trade has one, and it is where interpretation breaks.

- Concrete: *yards* — volume in a takeoff, distance everywhere else.
- Roofing: *square* — 100 ft², which is not "square feet"; and `6/12` is a
  pitch, not a date.
- Flooring: *board foot* vs *square foot*.
- Electrical: *run* — a cable path or a quantity.

Name it in `terminology.synonyms` and disarm it in `ai.globalInstructions`.

---

## 3. What is fixed, and what varies

### Fixed — the same in every adapter

- The manifest key set and its nesting (schema validator enforces it).
- The seven-stage calculator pipeline: validate → normalize → aggregate →
  waste → round → count → disclose.
- The three-number separation: **raw**, **waste**, **rounded order**. They go to
  three different records and must never be merged into one figure.
- The `== null` test for every tenant default. Never `!value` — a user-supplied
  `0` is a real answer and must survive.
- Every substituted default pushes a sentence onto `assumptions`.
- Every calculator returns a `warning`.
- Terminology renames labels only. Never an API field, collection, capability,
  tool name, or route.
- `mode: 'read_only'` on every calculator.

### Varies — per trade

- Which quantity kinds you declare, and the geometry inside the calculator.
- The settings values, ranges, and which unit-of-purchase fields exist.
- The nouns in the prompt overlay.
- Job types, custom fields, and their namespaced keys.

---

## 4. Where the three numbers go

The distinction every trade gets wrong, and the reason `raw` / `waste` /
`rounded order` stay separate all the way through:

| Record | Which number | Why |
|---|---|---|
| **Estimate** | rounded **order** quantity | You buy and bill the rounded amount. Price it from the tenant catalog, never invent a price. |
| **Work order** | **raw** quantity | This is what actually gets placed or installed. Waste and rounding ride along as planning detail, not as extra installed quantity. |
| **Material order** | rounded **order** quantity | What the supplier delivers. Countable units (trucks, bundles, pallets) are *logistics information*, not another material line. |

Roofing adds one more, and it is worth copying into any trade with a
tear-out phase:

> **Waste applies to field material only.** Never to a tear-off, disposal, or
> labor quantity. A roofer who bills 19 squares of tear-off on a 16.5-square
> roof is overcharging because we merged two numbers that should not have met.

---

## 5. Recipe

1. **Pick a canonical key and narrow aliases.** `key` is permanent. Aliases are
   the trap: `construction` would fire concrete at every GC, `exteriors` would
   fire roofing at siding and gutter crews. Aliases are collision-checked
   across all adapters at startup.
2. **Copy `_skeleton/` to `src/industryAdapters/<key>/`.** Fill every
   `<<slot>>`.
3. **Declare terminology and synonyms.** Group synonyms by *concept*, not word.
   Include the abbreviations a contractor actually texts.
4. **Pick quantity kinds from the shared set** (length, area, volume, mass,
   temperature, duration, count, rate). Add a trade specialization only when
   the shared set genuinely cannot express it — roofing added `roofing_square`
   (a presentation unit) and `roof_pitch`. Never invent a primitive that
   conflicts with an existing one.
5. **Write the settings schema.** One descriptor drives both the frontend
   renderer and server-side validation — there is no second copy. Imperial and
   metric are separate fields with `measurementSystem` set. Defaults must
   themselves validate against their own field definitions (a contract test
   checks this).
6. **Write the prompt overlay. Keep it small.** Six sentences in
   `globalInstructions`, four `contextInstructions`. Do not restate core
   policy; do not copy the base prompt. A fix to core prompt behavior must not
   need repeating in every adapter.
7. **Add recommendations with stable IDs.** Opt-in, previewable, idempotent.
   Applying the same recommendation twice must not duplicate a field.
8. **Write the calculator** against the seven stages. Reuse a shared
   measurement helper wherever one exists.
9. **Write golden fixtures** before you believe the math. See §7.
10. **Register as `internal`,** enable one tenant, read telemetry, then promote
    to `pilot` and `available`.

---

## 6. The safety property, in code

This is the pattern the whole design turns on. From roofing's calculator:

```js
const configuredWaste = configuredNumber(config?.estimating?.defaultWastePercent, 0);
const wastePercent = input.wastePercent == null ? configuredWaste : Number(input.wastePercent);
if (input.wastePercent == null) assumptions.push(`Used the tenant waste setting of ${wastePercent}%.`);
```

Three properties in three lines:

- **`== null`, not falsy.** A contractor who says "no waste on this one" gets 0.
- **The tenant default is a fallback, never an override.**
- **The substitution is disclosed.** If it is not in `assumptions`, the tenant
  cannot see it, and that is a bug regardless of whether the arithmetic is right.

And the corresponding rule for counts — omit rather than assume:

```js
if (Number.isFinite(bundleCoverage) && bundleCoverage > 0) {
  bundleEstimate = { /* ... */ };            // configured: report it
} else if (input.bundleCoverage != null) {
  throw measurementError('...must be greater than zero.');  // bad input: error
}
// unset: bundleEstimate stays null — no count, no guess
```

An explicitly bad value is an error. An absent setting is just silence.

---

## 7. Testing an adapter

Three layers. The plan's §19 has the full list; these are the ones that catch
real bugs.

**Contract tests** (every adapter, automatic)
- manifest validates against the schema; key/version/aliases unique
- setting defaults validate against their own field definitions
- units and aliases map to controlled quantity kinds
- `manifest.calculators[n].shapes` matches the calculator's `SHAPES` set exactly
- every referenced calculator exists; recommendation IDs and custom-field keys
  are unique
- no adapter attempts to override a protected policy section

**Golden math tests** (per adapter — `roofing/fixtures/calculator.golden.mjs`
is a working model, 30 checks, runnable with a stub measurement module)
- every geometry against a hand-checked figure
- both input forms agree (roofing: `6/12` and `26.565 deg` produce the same area)
- imperial and metric describe the same physical thing
- deductions work; over-deduction errors rather than returning zero
- **a user-supplied `0` survives and emits no assumption** — the regression that
  matters most
- counts are omitted, not guessed, when tenant coverage is unset
- an ambiguous or missing required input produces a *targeted* error naming the
  section, so the assistant asks one question instead of guessing

**Base-regression tests** (platform-wide)
- an unrecognized industry resolves to `labor-services`
- existing tenants produce identical effective settings when adapters are off
- adapter cache entries are tenant-scoped; one tenant never changes another's
- app and SMS resolve the same adapter version
- no adapter changes a capability or confirmation outcome

---

## 8. Things that look like adapter work but are not

Push back on these. They are core-platform improvements that an adapter has
merely surfaced, and doing them inside an adapter is how the contract rots.

- **A quantity kind the shared measurement service lacks.** Roofing needed
  `squareMetersTo()` and `areaOutputUnit()` — the exact analogues of concrete's
  volume pair. That belongs in `measurements.js`, because flooring, paint, and
  siding will all want it. Do not write a private converter in the adapter.
- **Custom fields on an object type that does not support them yet.** Extend the
  generic custom-field system for every industry. Do not hide durable business
  data in an unstructured `metadata` bag to avoid the general fix.
- **A new capability because the UI label is industry-specific.** Add one only
  for a genuinely new permission boundary.
- **Anything structural.** No load, capacity, bearing, code-compliance, mix
  design, fastening pattern, or ventilation sizing. Material takeoff only. This
  is a liability boundary, not a scoping preference.

---

## 9. Files

```
_skeleton/
  manifest.template.js          annotated, every contract rule inline
  calculator.template.js        annotated, the seven stages
  AUTHORING.md                  this file
  fixtures/measurements.stub.js standalone stub for running goldens

concrete/                       the reference adapter (v1.1.0)
  manifest.js
  calculator.js

roofing/                        adapter number two — the plug-and-play proof
  manifest.js
  calculator.js
  fixtures/calculator.golden.mjs
```
