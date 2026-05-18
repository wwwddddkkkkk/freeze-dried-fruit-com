// Cross-fruit comparison data for the freeze-drying matrix.
//
// Each entry captures the rough freeze-drying personality of one fruit so a
// reader looking at any single fruit report can see how that fruit sits next
// to its natural siblings. Values are typical industry ranges — variety,
// origin, and harvest window shift them. The fields are deliberately scoped
// to what a buyer or curious reader actually wants to compare.
//
// Field meanings:
//   brix           — typical soluble-solids range at harvest, degrees Brix
//   fiber          — Low / Medium / High (perceived fiber in finished pieces)
//   aroma          — Quiet / Moderate / Strong (volatile aroma intensity)
//   colorStability — Poor / Moderate / Strong (resistance to fade/browning)
//   breakage       — Low / Medium / High (fragility risk after drying)
//   format         — typical commercial finished format(s)
//   oneLine        — short editorial summary for the comparison page
//   bestUse        — the fruit's strongest commercial use case
//   seasonality    — when the fruit is in commercial supply
//   costTier       — Budget / Mid / Premium / Luxury (rough price tier)
//   keyOrigins     — main commercial producing countries / regions
//
// CLUSTERS group fruits that naturally compare to each other — the table on
// a strawberry article shows berries, the one on a mango article shows
// tropical fruits, and so on. SLUG_TO_FRUIT routes any article slug to a
// fruit key so the rest of the build pipeline can find the right data.

export const FRUIT_DATA = {
  // Berries
  strawberry: {
    name: "Strawberry",
    brix: "7–12°",
    fiber: "Low",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Slices · whole · powder",
    oneLine: "Aroma-led berry. Bright color when fresh; fades quickly without barrier protection. Slices read clearly to consumers.",
    bestUse: "Snack slices, yogurt toppings, ingredient powder",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "California, Mexico, Spain, Egypt, Morocco",
  },
  blueberry: {
    name: "Blueberry",
    brix: "10–15°",
    fiber: "Low",
    aroma: "Moderate",
    colorStability: "Strong",
    breakage: "Low",
    format: "Whole · halves · powder",
    oneLine: "Skin protects color and structure. Whole berries dry slowly. Small wild types deliver the strongest flavor.",
    bestUse: "Snack bags, cereal inclusions, ingredient powder",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "Chile, Peru, U.S., Mexico, Canada",
  },
  raspberry: {
    name: "Raspberry",
    brix: "8–12°",
    fiber: "Low",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "High",
    format: "Whole · broken · powder",
    oneLine: "Hollow drupelet structure makes raspberry the most fragile common berry. High aroma earned through high breakage risk.",
    bestUse: "Premium snacks, ingredient powder, dessert toppings",
    seasonality: "Year-round (IQF-driven)",
    costTier: "Premium",
    keyOrigins: "Chile, Mexico, Serbia, Poland, U.S.",
  },
  blackberry: {
    name: "Blackberry",
    brix: "8–13°",
    fiber: "Medium",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "High",
    format: "Whole · broken · powder",
    oneLine: "Bolder, more seedy than raspberry. Dries into vivid pieces but with similar fragility and color-fade risk.",
    bestUse: "Yogurt toppings, granola, ingredient blends",
    seasonality: "Year-round (IQF-driven)",
    costTier: "Premium",
    keyOrigins: "Mexico, Chile, U.S. Pacific Northwest",
  },
  cranberry: {
    name: "Cranberry",
    brix: "6–9°",
    fiber: "Medium",
    aroma: "Sharp",
    colorStability: "Strong",
    breakage: "Low",
    format: "Slices · pieces · powder",
    oneLine: "Tart-forward; rarely a casual snack without sweetening. Color survives well; firm skin slows whole-berry drying.",
    bestUse: "Granola, holiday blends, drink mixes",
    seasonality: "Year-round (autumn harvest, cold-stored)",
    costTier: "Mid",
    keyOrigins: "Wisconsin, Massachusetts, Quebec, B.C.",
  },
  mulberry: {
    name: "Mulberry",
    brix: "9–15°",
    fiber: "Low",
    aroma: "Moderate",
    colorStability: "Strong",
    breakage: "Medium",
    format: "Whole · broken · powder",
    oneLine: "Dark color and soft acid. Aggregate structure makes whole-piece integrity difficult; powder and broken pieces dominate.",
    bestUse: "Specialty discovery snacks, powders",
    seasonality: "Limited (regional summer harvest)",
    costTier: "Premium",
    keyOrigins: "Turkey, Iran, China, Afghanistan",
  },
  gooseberry: {
    name: "Gooseberry",
    brix: "8–12°",
    fiber: "Medium",
    aroma: "Moderate",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Halves · powder",
    oneLine: "Tart with notable seeds. Less commercial supply than mainstream berries; works as a discovery accent.",
    bestUse: "Wellness powders, tea blends, ingredient accent",
    seasonality: "Limited (regional)",
    costTier: "Premium",
    keyOrigins: "India (amla), U.K., Eastern Europe (dessert)",
  },

  // Pome
  apple: {
    name: "Apple",
    brix: "12–18°",
    fiber: "Medium",
    aroma: "Moderate",
    colorStability: "Poor",
    breakage: "Low",
    format: "Slices · dices · powder",
    oneLine: "Familiar and format-friendly. Browns easily without pre-treatment. Variety choice decides whether the bag tastes bright or bland.",
    bestUse: "Budget snacks, cereal, baking inclusions, powder",
    seasonality: "Year-round (cold storage)",
    costTier: "Budget",
    keyOrigins: "China, U.S., Poland, Italy, Chile",
  },
  pear: {
    name: "Pear",
    brix: "10–16°",
    fiber: "Medium",
    aroma: "Moderate",
    colorStability: "Poor",
    breakage: "Medium",
    format: "Slices · dices · powder",
    oneLine: "Quiet aroma; buttery or crisp depending on cultivar. Browning-prone; smaller commercial freeze-dried presence than apple.",
    bestUse: "Premium snack slices, gentle blends, baking",
    seasonality: "Year-round (cold storage)",
    costTier: "Mid",
    keyOrigins: "China, Italy, Argentina, U.S., Netherlands",
  },

  // Stone fruit
  peach: {
    name: "Peach",
    brix: "10–15°",
    fiber: "Medium",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Slices · dices · halves",
    oneLine: "Aroma drives recognition; ripeness sets the ceiling. Clingstone suits processing; freestone gives cleaner slices.",
    bestUse: "Premium snack slices, dessert toppings, baking",
    seasonality: "Summer-heavy; processing year-round",
    costTier: "Mid",
    keyOrigins: "China, Italy, Greece, Spain, U.S.",
  },
  apricot: {
    name: "Apricot",
    brix: "11–14°",
    fiber: "Medium",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Halves · slices · dices",
    oneLine: "Tart-sweet with strong color when handled well. Browning risk pushes pre-treatment use; halves and slices common.",
    bestUse: "Premium slices, granola, baking inclusions",
    seasonality: "Limited (Turkish-driven summer)",
    costTier: "Mid",
    keyOrigins: "Turkey, Iran, Uzbekistan, U.S., Spain",
  },
  plum: {
    name: "Plum",
    brix: "12–15°",
    fiber: "Low",
    aroma: "Moderate",
    colorStability: "Strong",
    breakage: "Medium",
    format: "Slices · dices · powder",
    oneLine: "Skin tartness on top of sweet flesh. The freeze-dried version reads crisp and fresh, not prune-like.",
    bestUse: "Snack slices, granola, baking",
    seasonality: "Summer; processing year-round",
    costTier: "Mid",
    keyOrigins: "China, Romania, Serbia, U.S., Chile",
  },
  cherry: {
    name: "Cherry",
    brix: "14–22°",
    fiber: "Low",
    aroma: "Strong",
    colorStability: "Strong",
    breakage: "Medium",
    format: "Halves · whole · powder",
    oneLine: "Sweet or tart split decides the product. Pitting matters. Dark color and aroma carry the bag.",
    bestUse: "Premium snacks, granola, chocolate inclusions",
    seasonality: "Summer; IQF year-round",
    costTier: "Premium",
    keyOrigins: "U.S. (Pacific NW + Michigan), Turkey, Poland, Chile",
  },

  // Tropical
  mango: {
    name: "Mango",
    brix: "10–22°",
    fiber: "Low → High (cultivar)",
    aroma: "Very strong",
    colorStability: "Strong",
    breakage: "Medium",
    format: "Slices · cubes · powder",
    oneLine: "Variety dominates the outcome. Ataulfo and Alphonso produce premium fruit; Tommy Atkins is fibrous and budget.",
    bestUse: "Premium snacks (Ataulfo / Alphonso), cubes for ingredients (Kent / Keitt)",
    seasonality: "Year-round (multi-origin rolling harvest)",
    costTier: "Mid → Premium (cultivar)",
    keyOrigins: "Mexico, India (Alphonso, Kesar), Pakistan, Thailand, Philippines",
  },
  pineapple: {
    name: "Pineapple",
    brix: "11–15°",
    fiber: "High",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Chunks · tidbits · powder",
    oneLine: "High acidity and noticeable fiber. The sweet-acid balance concentrates when dried; chunks and tidbits dominate.",
    bestUse: "Tropical snack blends, chunks, drink powders",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "Thailand, Philippines, Costa Rica, Indonesia",
  },
  banana: {
    name: "Banana",
    brix: "15–22°",
    fiber: "Medium",
    aroma: "Strong (ripe)",
    colorStability: "Poor",
    breakage: "Low",
    format: "Slices · powder",
    oneLine: "Ripeness controls sweetness, aroma, and browning. Slices are the dominant format; very ripe fruit collapses.",
    bestUse: "Budget snacks, cereal, ingredient powder",
    seasonality: "Year-round",
    costTier: "Budget",
    keyOrigins: "Ecuador, Colombia, Philippines, Costa Rica",
  },
  papaya: {
    name: "Papaya",
    brix: "8–12°",
    fiber: "Low",
    aroma: "Mild",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Cubes · slices · powder",
    oneLine: "Mild flavor and color. Works as a supporting fruit in tropical blends rather than as a standalone snack.",
    bestUse: "Tropical blends, color and body ingredient",
    seasonality: "Year-round (tropical)",
    costTier: "Mid",
    keyOrigins: "Mexico, Belize, Brazil, India, Philippines",
  },
  "passion-fruit": {
    name: "Passion fruit",
    brix: "13–18°",
    fiber: "Low (seeds present)",
    aroma: "Very strong",
    colorStability: "Moderate",
    breakage: "n/a (pulp)",
    format: "Powder · flakes",
    oneLine: "Aroma-driven ingredient fruit. Mostly powder or flakes; seeds add identity but can be distracting.",
    bestUse: "Powder ingredient for beverages, desserts, coatings",
    seasonality: "Year-round (Latin American supply)",
    costTier: "Premium",
    keyOrigins: "Brazil, Peru, Ecuador, Colombia, Vietnam",
  },
  guava: {
    name: "Guava",
    brix: "8–13°",
    fiber: "High",
    aroma: "Very strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Slices · cubes · powder",
    oneLine: "High fiber and seeds add structure. Intense aroma; sliced or powdered both work depending on use.",
    bestUse: "Tropical blends, drink powders, yogurt toppings",
    seasonality: "Year-round (tropical)",
    costTier: "Mid",
    keyOrigins: "India, Mexico, Thailand, South Africa, Brazil",
  },

  // Asian tropical
  lychee: {
    name: "Lychee",
    brix: "16–20°",
    fiber: "Low",
    aroma: "Strong",
    colorStability: "Poor",
    breakage: "Medium",
    format: "Halves · whole · pieces",
    oneLine: "Floral sweetness. Thin skin and high water content; freeze-dried form preserves aroma surprisingly well.",
    bestUse: "Specialty premium snacks, dessert toppings, tea blends",
    seasonality: "Limited (summer Asian harvest)",
    costTier: "Premium → Luxury",
    keyOrigins: "China, Vietnam, Thailand, India",
  },
  longan: {
    name: "Longan",
    brix: "15–22°",
    fiber: "Low",
    aroma: "Moderate",
    colorStability: "Poor",
    breakage: "Medium",
    format: "Halves · whole",
    oneLine: "Similar to lychee but cleaner-flavored. Smaller market presence; halves and whole both used.",
    bestUse: "Asian premium snacks, tea, dessert applications",
    seasonality: "Limited (summer Asian harvest)",
    costTier: "Premium",
    keyOrigins: "China (Fujian, Guangdong), Thailand, Vietnam, Taiwan",
  },
  rambutan: {
    name: "Rambutan",
    brix: "16–21°",
    fiber: "Medium",
    aroma: "Moderate",
    colorStability: "Poor",
    breakage: "Medium",
    format: "Halves · pieces",
    oneLine: "Visually distinctive raw; more commercial as halves or pieces. Mild sweet flesh with quiet aroma.",
    bestUse: "Specialty tropical packs, dessert toppings",
    seasonality: "Limited (tropical seasonal)",
    costTier: "Premium",
    keyOrigins: "Indonesia, Malaysia, Thailand, Vietnam, Philippines",
  },
  mangosteen: {
    name: "Mangosteen",
    brix: "15–20°",
    fiber: "Low",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Segments · powder",
    oneLine: "Premium specialty. Bright sweetness; segment structure preserves identity; small commercial supply.",
    bestUse: "Luxury tropical packs, discovery snacks",
    seasonality: "Very limited (May–Oct)",
    costTier: "Luxury",
    keyOrigins: "Thailand, Indonesia, Malaysia, Philippines, Vietnam",
  },
  durian: {
    name: "Durian",
    brix: "20–28°",
    fiber: "Medium",
    aroma: "Very strong",
    colorStability: "Moderate",
    breakage: "Low",
    format: "Pieces · powder",
    oneLine: "Very strong aroma carries through drying. Niche but distinctive freeze-dried snack.",
    bestUse: "Premium specialty snacks, powders, mooncake fillings",
    seasonality: "Limited (mid-summer Asian)",
    costTier: "Premium → Luxury (cultivar)",
    keyOrigins: "Thailand, Malaysia, Indonesia, Philippines, Vietnam",
  },
  jackfruit: {
    name: "Jackfruit",
    brix: "15–24°",
    fiber: "Medium",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Pieces · slices · powder",
    oneLine: "Larger flesh segments. Sweet aromatic profile; chips and pieces are the most common formats.",
    bestUse: "Tropical snacks (ripe), plant-based meat (young), powders",
    seasonality: "Year-round (tropical)",
    costTier: "Mid",
    keyOrigins: "India, Bangladesh, Sri Lanka, Thailand, Vietnam",
  },
  jujube: {
    name: "Jujube",
    brix: "18–28°",
    fiber: "Medium",
    aroma: "Moderate",
    colorStability: "Strong",
    breakage: "Low",
    format: "Halves · slices · powder",
    oneLine: "Date-like sweetness with apple texture. Bright color holds; an under-discovered freeze-dried niche.",
    bestUse: "Asian snack mixes, tea blends, wellness products",
    seasonality: "Year-round (mostly Chinese supply)",
    costTier: "Mid",
    keyOrigins: "China (Xinjiang, Shaanxi, Hebei), Korea, Central Asia",
  },
  soursop: {
    name: "Soursop",
    brix: "10–18°",
    fiber: "Medium",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Pieces · powder",
    oneLine: "Tart-tropical aroma. Fibrous pulp makes powder and pieces more practical than whole formats.",
    bestUse: "Tropical powders, dairy-style applications, wellness",
    seasonality: "Year-round (tropical pulp supply)",
    costTier: "Premium",
    keyOrigins: "Brazil, Colombia, Costa Rica, Peru, Mexico",
  },
  sapodilla: {
    name: "Sapodilla",
    brix: "14–22°",
    fiber: "Medium",
    aroma: "Moderate",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Pieces · powder",
    oneLine: "Caramel-like sweetness. Flesh softer than mango; better as pieces or powder than whole.",
    bestUse: "Specialty dessert blends, bakery inclusions, powders",
    seasonality: "Year-round (regional supply)",
    costTier: "Premium",
    keyOrigins: "Mexico, India, Thailand, Philippines",
  },
  starfruit: {
    name: "Starfruit",
    brix: "5–11°",
    fiber: "Medium",
    aroma: "Mild",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Slices · powder",
    oneLine: "Mild flavor with star-shape visual appeal. Freeze-dried slices preserve the iconic cross-section.",
    bestUse: "Garnish, cocktail kits, premium visual blends",
    seasonality: "Year-round (tropical)",
    costTier: "Premium",
    keyOrigins: "Malaysia, Taiwan, Indonesia, Brazil, Hawaii",
  },

  // Citrus
  orange: {
    name: "Orange",
    brix: "10–14°",
    fiber: "Low",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Slices · segments · powder",
    oneLine: "Bright citrus aroma. Pith and peel risks become more pronounced when concentrated.",
    bestUse: "Snack segments, drink/coating powders, chocolate inclusions",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "Brazil, U.S. (Florida/California), Spain, Egypt, Mexico",
  },
  lemon: {
    name: "Lemon",
    brix: "7–9°",
    fiber: "Low",
    aroma: "Very strong",
    colorStability: "Strong",
    breakage: "Medium",
    format: "Slices · zest · powder",
    oneLine: "Ingredient fruit, not snack. Slices for tea, powder for formulation; bitterness control is central.",
    bestUse: "Tea, drink mixes, baking, savory seasoning",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "Argentina, Spain, Italy, U.S. (California), Turkey",
  },
  grapefruit: {
    name: "Grapefruit",
    brix: "8–12°",
    fiber: "Low",
    aroma: "Strong",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Slices · segments · powder",
    oneLine: "Bitter-tart citrus. Pith management decides whether it works as snack or ingredient.",
    bestUse: "Adult snack blends, drink mixes, cocktail kits",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "U.S. (Florida, Texas), Mexico, South Africa, Israel, Spain",
  },

  // Melons
  watermelon: {
    name: "Watermelon",
    brix: "8–12°",
    fiber: "Very low",
    aroma: "Mild",
    colorStability: "Moderate",
    breakage: "High",
    format: "Cubes · slices · powder",
    oneLine: "Extreme water content limits yield. Freeze-dried form is light and novel but flavor-delicate.",
    bestUse: "Novelty summer blends, color and body in tropical mixes",
    seasonality: "Summer-heavy (multi-origin)",
    costTier: "Premium (low yield)",
    keyOrigins: "China, Turkey, Iran, Brazil, Egypt",
  },
  cantaloupe: {
    name: "Cantaloupe",
    brix: "10–14°",
    fiber: "Low",
    aroma: "Moderate",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Cubes · slices · powder",
    oneLine: "Aromatic melon; mild sweetness. Cubes and slices preserve melon character with care.",
    bestUse: "Summer melon blends, dessert toppings",
    seasonality: "Summer (mainly U.S./Mexican)",
    costTier: "Mid",
    keyOrigins: "U.S., Mexico, Guatemala, Costa Rica",
  },
  honeydew: {
    name: "Honeydew",
    brix: "10–14°",
    fiber: "Low",
    aroma: "Mild",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Cubes · slices · powder",
    oneLine: "Quietly sweet; less aromatic than cantaloupe. Visual color limited but flesh dries cleanly.",
    bestUse: "Subtle melon blends, breakfast toppings",
    seasonality: "Summer (mainly U.S./Mexican)",
    costTier: "Mid",
    keyOrigins: "U.S., Mexico, Spain, Brazil",
  },

  // Unique / structural
  "dragon-fruit": {
    name: "Dragon fruit",
    brix: "8–13°",
    fiber: "Low",
    aroma: "Mild",
    colorStability: "Very strong (red)",
    breakage: "Low",
    format: "Pieces · powder",
    oneLine: "Color-led. Red flesh holds dramatic visual; flavor is mild — positioning matters more than taste.",
    bestUse: "Color-led blends, smoothie powders, premium visual snacks",
    seasonality: "Year-round (tropical multi-origin)",
    costTier: "Premium",
    keyOrigins: "Vietnam, Thailand, Ecuador, Israel, Australia",
  },
  pomegranate: {
    name: "Pomegranate",
    brix: "14–18°",
    fiber: "Low (seed core)",
    aroma: "Moderate",
    colorStability: "Strong",
    breakage: "Low",
    format: "Arils · powder",
    oneLine: "Arils, not flesh. Hard seed within each aril; premium accent for yogurt, dessert, drink mixes.",
    bestUse: "Yogurt toppings, premium granola, drink/coating powders",
    seasonality: "Autumn-heavy; cold-stored year-round",
    costTier: "Premium",
    keyOrigins: "California, Spain (Mollar), India (Bhagwa), Turkey, Iran",
  },
  kiwi: {
    name: "Kiwi",
    brix: "9–15°",
    fiber: "Low",
    aroma: "Moderate",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Slices · dices · powder",
    oneLine: "Green or gold flesh with iconic seed ring. Fragile slices; color is the strongest selling point.",
    bestUse: "Snack slices, mixed-fruit visual accent, powder",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "Italy, New Zealand, Greece, Chile, China",
  },
  fig: {
    name: "Fig",
    brix: "16–24°",
    fiber: "High (seeds)",
    aroma: "Moderate",
    colorStability: "Moderate",
    breakage: "Medium",
    format: "Halves · slices · powder",
    oneLine: "Dense flesh with seed-rich interior. Sweet and aromatic; less common but works well in slices.",
    bestUse: "Cheese boards, bakery, premium dessert blends",
    seasonality: "Late summer; dried-derived year-round",
    costTier: "Premium",
    keyOrigins: "Turkey, Greece, California, Spain, Iran",
  },
  persimmon: {
    name: "Persimmon",
    brix: "14–20°",
    fiber: "Low",
    aroma: "Mild",
    colorStability: "Moderate",
    breakage: "Low",
    format: "Slices · dices · powder",
    oneLine: "Mild sweetness. Less commercial supply; freeze-dried form holds shape and color cleanly.",
    bestUse: "Autumn-themed snacks, premium dessert slices, bakery",
    seasonality: "Autumn; cold-stored",
    costTier: "Premium",
    keyOrigins: "Japan (Fuyu/Hachiya), Spain (Rojo Brillante), Israel (Sharon), China, U.S.",
  },
  grape: {
    name: "Grape",
    brix: "15–22°",
    fiber: "Low (skin issue)",
    aroma: "Moderate",
    colorStability: "Strong",
    breakage: "High",
    format: "Halves · powder",
    oneLine: "Skin slows drying. Sticky when cut; halved and powder both more practical than whole.",
    bestUse: "Halved snack pieces, color and sweetness in blends, wine-flavored novelty powders",
    seasonality: "Year-round (multi-origin)",
    costTier: "Mid",
    keyOrigins: "China, Italy, U.S. (California), Chile, India",
  },

  // Andean specialty fruit — high-value premium category with concentrated
  // origin geography (Peru / Chile / Colombia / Ecuador). Sold primarily as
  // freeze-dried powder or whole pieces into supplement, ingredient, and
  // premium snack formulations. Strategic for the Spanish-speaking buyer
  // audience since most cultivation is in Spanish-speaking countries.
  lucuma: {
    name: "Lucuma",
    brix: "20–25°",
    fiber: "High",
    aroma: "Distinctive (maple-caramel)",
    colorStability: "Strong",
    breakage: "Low",
    format: "Powder · dice · slice",
    oneLine: "Andean superfruit with very low water content and a maple-caramel flavor profile. Mostly sold as freeze-dried powder for premium ingredient use.",
    bestUse: "Ingredient powder, smoothie bases, premium dessert applications, dairy-free ice cream",
    seasonality: "Year-round availability (Peruvian Andes harvest cycles)",
    costTier: "Premium",
    keyOrigins: "Peru (Andes), Chile, Ecuador",
  },
  maqui: {
    name: "Maqui",
    brix: "12–18°",
    fiber: "Medium",
    aroma: "Mild",
    colorStability: "Very strong",
    breakage: "Medium",
    format: "Whole · powder",
    oneLine: "Chilean Patagonian berry with extreme anthocyanin density. Tiny dark-purple fruit prized for natural color, antioxidant marketing, and supplement formulation.",
    bestUse: "Premium powder ingredient, supplement formulations, natural color blends, smoothie packs",
    seasonality: "January–March harvest (Chilean Patagonia)",
    costTier: "Premium",
    keyOrigins: "Chile (Patagonia), Argentina",
  },
  aguaymanto: {
    name: "Aguaymanto (Goldenberry)",
    brix: "13–18°",
    fiber: "Medium",
    aroma: "Strong (citrus-tropical)",
    colorStability: "Strong",
    breakage: "Low",
    format: "Whole · halves",
    oneLine: "Husk-wrapped Andean berry with bright citrus-tropical aroma. Holds shape and color well in freeze-drying, distinctive on shelf as a premium snack piece.",
    bestUse: "Premium snack pieces, granola inclusions, restaurant garnish, gourmet trail mix",
    seasonality: "Year-round (Peruvian Andes, Colombian highlands)",
    costTier: "Premium",
    keyOrigins: "Peru, Colombia, Ecuador, South Africa",
  },
};

// Cross-fruit clusters used to pick which siblings to display in any one
// fruit's comparison table. Each cluster is roughly the set of fruits a
// reader of one report might reasonably compare to.
export const CLUSTERS = [
  { id: "berries", label: "Berries", fruits: ["strawberry", "blueberry", "raspberry", "blackberry", "cranberry", "mulberry", "gooseberry"] },
  { id: "pome", label: "Pome fruit", fruits: ["apple", "pear"] },
  { id: "stone", label: "Stone fruit", fruits: ["peach", "apricot", "plum", "cherry"] },
  { id: "tropical", label: "Tropical fruit", fruits: ["mango", "pineapple", "banana", "papaya", "passion-fruit", "guava"] },
  { id: "asian-tropical", label: "Asian tropical fruit", fruits: ["lychee", "longan", "rambutan", "mangosteen", "durian", "jackfruit", "jujube", "soursop", "sapodilla", "starfruit"] },
  { id: "citrus", label: "Citrus", fruits: ["orange", "lemon", "grapefruit"] },
  { id: "melon", label: "Melons", fruits: ["watermelon", "cantaloupe", "honeydew"] },
  { id: "structural", label: "Visually distinctive fruit", fruits: ["dragon-fruit", "pomegranate", "kiwi", "fig", "persimmon", "grape"] },
  { id: "andean", label: "Andean specialty fruit", fruits: ["lucuma", "maqui", "aguaymanto"] },
];

// Article slug → fruit key. Covers both the "Field Guide to X for Freeze-Drying"
// reports and the "How Many Types of X Are There" variety guides, since both
// types benefit from the cross-fruit comparison.
export const SLUG_TO_FRUIT = {
  // Berries
  "strawberry-varieties-for-freeze-drying": "strawberry",
  "how-many-types-of-strawberries-are-there": "strawberry",
  "blueberry-varieties-for-freeze-drying": "blueberry",
  "how-many-types-of-blueberries-are-there": "blueberry",
  "raspberry-for-freeze-drying": "raspberry",
  "how-many-types-of-raspberries-are-there": "raspberry",
  "blackberry-for-freeze-drying": "blackberry",
  "how-many-types-of-blackberries-are-there": "blackberry",
  "cranberry-for-freeze-drying": "cranberry",
  "how-many-types-of-cranberries-are-there": "cranberry",
  "mulberry-for-freeze-drying": "mulberry",
  "how-many-types-of-mulberries-are-there": "mulberry",
  "gooseberry-for-freeze-drying": "gooseberry",
  "how-many-types-of-gooseberries-are-there": "gooseberry",

  // Pome
  "apple-varieties-for-freeze-drying": "apple",
  "how-many-types-of-apples-are-there": "apple",
  "pear-varieties-for-freeze-drying": "pear",
  "how-many-types-of-pears-are-there": "pear",

  // Stone fruit
  "peach-varieties-for-freeze-drying": "peach",
  "how-many-types-of-peaches-are-there": "peach",
  "apricot-for-freeze-drying": "apricot",
  "how-many-types-of-apricots-are-there": "apricot",
  "plum-for-freeze-drying": "plum",
  "how-many-types-of-plums-are-there": "plum",
  "cherry-for-freeze-drying": "cherry",
  "how-many-types-of-cherries-are-there": "cherry",

  // Tropical
  "mango-varieties": "mango",
  "how-many-types-of-mangoes-are-there": "mango",
  "pineapple-varieties-for-freeze-drying": "pineapple",
  "how-many-types-of-pineapples-are-there": "pineapple",
  "banana-varieties-for-freeze-drying": "banana",
  "how-many-types-of-bananas-are-there": "banana",
  "papaya-for-freeze-drying": "papaya",
  "how-many-types-of-papaya-are-there": "papaya",
  "passion-fruit-for-freeze-drying": "passion-fruit",
  "how-many-types-of-passion-fruit-are-there": "passion-fruit",
  "guava-for-freeze-drying": "guava",
  "how-many-types-of-guavas-are-there": "guava",

  // Asian tropical
  "lychee-for-freeze-drying": "lychee",
  "how-many-types-of-lychees-are-there": "lychee",
  "longan-for-freeze-drying": "longan",
  "how-many-types-of-longans-are-there": "longan",
  "rambutan-for-freeze-drying": "rambutan",
  "how-many-types-of-rambutans-are-there": "rambutan",
  "mangosteen-for-freeze-drying": "mangosteen",
  "how-many-types-of-mangosteens-are-there": "mangosteen",
  "durian-for-freeze-drying": "durian",
  "how-many-types-of-durians-are-there": "durian",
  "jackfruit-for-freeze-drying": "jackfruit",
  "how-many-types-of-jackfruit-are-there": "jackfruit",
  "jujube-for-freeze-drying": "jujube",
  "how-many-types-of-jujubes-are-there": "jujube",
  "soursop-for-freeze-drying": "soursop",
  "how-many-types-of-soursops-are-there": "soursop",
  "sapodilla-for-freeze-drying": "sapodilla",
  "how-many-types-of-sapodillas-are-there": "sapodilla",
  "starfruit-for-freeze-drying": "starfruit",
  "how-many-types-of-starfruit-are-there": "starfruit",

  // Citrus
  "orange-for-freeze-drying": "orange",
  "how-many-types-of-oranges-are-there": "orange",
  "lemon-for-freeze-drying": "lemon",
  "how-many-types-of-lemons-are-there": "lemon",
  "grapefruit-for-freeze-drying": "grapefruit",
  "how-many-types-of-grapefruit-are-there": "grapefruit",

  // Melons
  "watermelon-for-freeze-drying": "watermelon",
  "how-many-types-of-watermelon-are-there": "watermelon",
  "how-many-types-of-melons-are-there": "watermelon",
  "cantaloupe-for-freeze-drying": "cantaloupe",
  "honeydew-for-freeze-drying": "honeydew",
  "how-many-types-of-honeydew-are-there": "honeydew",

  // Structural
  "dragon-fruit-for-freeze-drying": "dragon-fruit",
  "how-many-types-of-dragon-fruit-are-there": "dragon-fruit",
  "pomegranate-for-freeze-drying": "pomegranate",
  "how-many-types-of-pomegranates-are-there": "pomegranate",
  "kiwi-for-freeze-drying": "kiwi",
  "how-many-types-of-kiwi-are-there": "kiwi",
  "figs-for-freeze-drying": "fig",
  "how-many-types-of-figs-are-there": "fig",
  "persimmon-for-freeze-drying": "persimmon",
  "how-many-types-of-persimmons-are-there": "persimmon",
  "grape-for-freeze-drying": "grape",
  "how-many-types-of-grapes-are-there": "grape",

  // Andean specialty
  "lucuma-for-freeze-drying": "lucuma",
  "maqui-for-freeze-drying": "maqui",
  "aguaymanto-for-freeze-drying": "aguaymanto",
};

// Locate the cluster that contains a given fruit key.
export function clusterForFruit(fruitKey) {
  for (const cluster of CLUSTERS) {
    if (cluster.fruits.includes(fruitKey)) return cluster;
  }
  return null;
}

// Notable cross-cluster pairs that get their own comparison pages on top of
// the automatic intra-cluster pairs. These are common search queries where
// readers actually want a side-by-side: typically a popular berry vs a
// popular tropical, or a pair where the cluster boundary is genuinely fuzzy.
const CROSS_CLUSTER_PAIRS = [
  ["strawberry", "mango"],
  ["strawberry", "apple"],
  ["strawberry", "banana"],
  ["strawberry", "pineapple"],
  ["blueberry", "pomegranate"],
  ["blueberry", "raspberry"],
  ["mango", "pineapple"],
  ["mango", "banana"],
  ["apple", "banana"],
  ["raspberry", "blackberry"],
  ["cherry", "cranberry"],
  ["cherry", "raspberry"],
];

// Canonical comparison-page slug from two fruit keys, always alphabetical
// so each pair has a single URL.
export function comparePathFor(a, b) {
  const [x, y] = [a, b].sort();
  return `${x}-vs-${y}`;
}

// Build the full set of comparison pairs the build emits. Pairs are emitted
// in canonical order, deduplicated, and only when BOTH fruits have data.
export function buildComparisonPairs() {
  const seen = new Set();
  const pairs = [];
  function add(a, b) {
    if (a === b) return;
    if (!FRUIT_DATA[a] || !FRUIT_DATA[b]) return;
    const key = comparePathFor(a, b);
    if (seen.has(key)) return;
    seen.add(key);
    const [x, y] = [a, b].sort();
    pairs.push({ slug: key, a: x, b: y });
  }
  // Every intra-cluster pair within each cluster.
  for (const cluster of CLUSTERS) {
    const fruits = cluster.fruits;
    for (let i = 0; i < fruits.length; i++) {
      for (let j = i + 1; j < fruits.length; j++) {
        add(fruits[i], fruits[j]);
      }
    }
  }
  // Selected cross-cluster celebrity pairs.
  for (const [a, b] of CROSS_CLUSTER_PAIRS) add(a, b);
  return pairs;
}
