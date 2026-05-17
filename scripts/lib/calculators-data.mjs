// Data tables for the on-site calculators. Kept separate from FRUIT_DATA
// so the calculator math has a clean single source of truth — and so we can
// update water content / density assumptions without touching the field-guide
// fruit profile data.

// Fruit equivalency table. Approximations from USDA FoodData Central +
// published density references. Each entry covers:
//   waterPct  — fresh-fruit water content (% by mass)
//   freshDensity — g/mL (cup of prepped fruit)
//   fdDensity    — g/mL (cup of freeze-dried pieces, loose-packed)
//   moisturePctFinal — residual moisture in finished freeze-dried product
// Values are typical for category-average fruit; specific cultivars vary.
export const FRUIT_EQUIVALENCY = [
  { key: "strawberry", name: "Strawberry",   waterPct: 91, freshDensity: 0.60, fdDensity: 0.10, moisturePctFinal: 3 },
  { key: "blueberry",  name: "Blueberry",    waterPct: 84, freshDensity: 0.68, fdDensity: 0.14, moisturePctFinal: 3 },
  { key: "raspberry",  name: "Raspberry",    waterPct: 86, freshDensity: 0.50, fdDensity: 0.10, moisturePctFinal: 3 },
  { key: "blackberry", name: "Blackberry",   waterPct: 88, freshDensity: 0.55, fdDensity: 0.10, moisturePctFinal: 3 },
  { key: "cherry",     name: "Cherry (pitted)", waterPct: 82, freshDensity: 0.62, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "cranberry",  name: "Cranberry",    waterPct: 87, freshDensity: 0.46, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "banana",     name: "Banana",       waterPct: 75, freshDensity: 0.94, fdDensity: 0.18, moisturePctFinal: 3 },
  { key: "apple",      name: "Apple",        waterPct: 86, freshDensity: 0.55, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "pear",       name: "Pear",         waterPct: 84, freshDensity: 0.58, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "peach",      name: "Peach",        waterPct: 88, freshDensity: 0.65, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "apricot",    name: "Apricot",      waterPct: 86, freshDensity: 0.66, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "plum",       name: "Plum",         waterPct: 87, freshDensity: 0.62, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "mango",      name: "Mango",        waterPct: 83, freshDensity: 0.66, fdDensity: 0.14, moisturePctFinal: 3 },
  { key: "pineapple",  name: "Pineapple",    waterPct: 86, freshDensity: 0.66, fdDensity: 0.14, moisturePctFinal: 3 },
  { key: "kiwi",       name: "Kiwi",         waterPct: 84, freshDensity: 0.61, fdDensity: 0.14, moisturePctFinal: 3 },
  { key: "papaya",     name: "Papaya",       waterPct: 88, freshDensity: 0.66, fdDensity: 0.14, moisturePctFinal: 3 },
  { key: "dragonfruit",name: "Dragon fruit", waterPct: 87, freshDensity: 0.62, fdDensity: 0.14, moisturePctFinal: 3 },
  { key: "passionfruit",name: "Passion fruit",waterPct: 73, freshDensity: 0.63, fdDensity: 0.16, moisturePctFinal: 3 },
  { key: "grape",      name: "Grape",        waterPct: 81, freshDensity: 0.62, fdDensity: 0.14, moisturePctFinal: 3 },
  { key: "orange",     name: "Orange (segmented)", waterPct: 87, freshDensity: 0.64, fdDensity: 0.13, moisturePctFinal: 3 },
  { key: "watermelon", name: "Watermelon",   waterPct: 92, freshDensity: 0.64, fdDensity: 0.10, moisturePctFinal: 3 },
  { key: "cantaloupe", name: "Cantaloupe",   waterPct: 90, freshDensity: 0.64, fdDensity: 0.11, moisturePctFinal: 3 },
];

// Pouch barrier guidance matrix. Editorial guideline values — not a
// replacement for a real packaging engineer's specification. Each row maps
// (fragility × climate × shelf life × pack size) → recommended film tier,
// MVTR target, OTR target, nitrogen flush recommendation, desiccant.
//
// Film tier definitions:
//   "clear"      — PET / PE laminations or AlOx clear barrier; clear film,
//                  moderate barrier, lowest cost, retail-shelf friendly
//   "metallized" — PET / metPET / PE; opaque, high barrier, moderate cost
//   "foil"       — PET / Foil / PE; opaque, highest barrier, highest cost
//
// MVTR / OTR are typical industry targets (lower = better barrier).
// Climate zones are simplified into three bands using ambient relative
// humidity ranges that govern dried-product hygroscopic risk.
export const CLIMATE_ZONES = [
  { key: "dry",       label: "Dry climate (under 40% RH avg)",         hrFactor: 0.7 },
  { key: "temperate", label: "Temperate climate (40–65% RH avg)",      hrFactor: 1.0 },
  { key: "humid",     label: "Humid / tropical climate (over 65% RH)", hrFactor: 1.5 },
];

export const SHELF_LIFE_OPTIONS = [
  { months: 6,  label: "6 months",  factor: 0.7 },
  { months: 12, label: "12 months", factor: 1.0 },
  { months: 18, label: "18 months", factor: 1.3 },
  { months: 24, label: "24 months", factor: 1.6 },
];

export const PACK_SIZES = [
  { key: "small",  label: "Small (under 50g, single-serve)",        factor: 0.8 },
  { key: "medium", label: "Medium (50–200g, retail snack pouch)",   factor: 1.0 },
  { key: "large",  label: "Large (200–500g, family pouch)",         factor: 1.2 },
  { key: "bulk",   label: "Bulk / foodservice (over 500g)",         factor: 1.4 },
];

export const FRAGILITY_LEVELS = [
  { key: "low",    label: "Low fragility — banana coins, apple dice, mango dice",      factor: 0.8 },
  { key: "medium", label: "Medium fragility — strawberry slices, peach slices, blueberry", factor: 1.0 },
  { key: "high",   label: "High fragility — raspberry, blackberry, cherry halves",     factor: 1.3 },
];

// Base MVTR / OTR targets at "medium fragility × temperate × 12 months ×
// medium pack." Other combinations scale via the factors above (inverse
// scaling — higher factor = tighter required barrier = lower allowed MVTR).
export const BASE_BARRIER_TARGETS = {
  mvtr: 1.5,   // g/m²/day at 38°C, 90% RH
  otr:  5.0,   // cc/m²/day at 23°C, 0% RH
};
