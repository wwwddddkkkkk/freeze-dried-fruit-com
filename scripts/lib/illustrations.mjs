// SVG hero illustrations — string-returning, no React.
// To add a new variant, add a function below and register it in HEROES.
// Reference one from an article's frontmatter: `hero: <key>`.

function heroQuality() {
  const jars = [
    { x: 160, fill: 280, label: "A", color: "#0A2540" },
    { x: 400, fill: 200, label: "B", color: "#3CCFA1" },
    { x: 640, fill: 110, label: "C", color: "#B95F72" },
  ];
  const jarsSvg = jars.map(j => {
    const dots = Array.from({ length: 12 }).map((_, k) => {
      const cx = j.x - 60 + (k % 4) * 40;
      const cy = 356 - 20 - Math.floor(k / 4) * 28;
      return `<circle cx="${cx}" cy="${cy}" r="6" fill="#fff" opacity="0.4"/>`;
    }).join("");
    return `
      <g>
        <rect x="${j.x - 70}" y="80" width="140" height="36" fill="none" stroke="#0A2540" stroke-width="1.5"/>
        <rect x="${j.x - 80}" y="116" width="160" height="240" fill="#fff" stroke="#0A2540" stroke-width="1.5"/>
        <rect x="${j.x - 80}" y="${356 - j.fill}" width="160" height="${j.fill}" fill="${j.color}" opacity="0.85"/>
        ${dots}
        <text x="${j.x}" y="390" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="14" font-weight="700" fill="#0A2540" letter-spacing="2">SAMPLE ${j.label}</text>
      </g>`;
  }).join("");
  return `
    <svg class="illust" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="hq-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#0A2540" stroke-opacity="0.05" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="800" height="450" fill="#F2F7F6"/>
      <rect width="800" height="450" fill="url(#hq-grid)"/>
      ${jarsSvg}
      <text x="40" y="40" font-family="Source Serif 4, serif" font-size="14" font-style="italic" fill="#0A2540">Fig.01 — Quality variance across freeze-dried fruit samples</text>
    </svg>`;
}

function heroFreshFrozen() {
  const sunRays = Array.from({ length: 12 }, (_, i) => {
    const deg = i * 30;
    const r = deg * Math.PI / 180;
    const x1 = 200 + Math.cos(r) * 75, y1 = 160 + Math.sin(r) * 75;
    const x2 = 200 + Math.cos(r) * 90, y2 = 160 + Math.sin(r) * 90;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0A2540" stroke-width="1.5"/>`;
  }).join("");
  const flakes = [
    { x: 600, y: 140 }, { x: 540, y: 200 }, { x: 660, y: 220 }, { x: 580, y: 280 },
  ].map(s => `
    <g stroke="#0A2540" stroke-width="1.5" stroke-linecap="round">
      <line x1="${s.x - 18}" y1="${s.y}" x2="${s.x + 18}" y2="${s.y}"/>
      <line x1="${s.x}" y1="${s.y - 18}" x2="${s.x}" y2="${s.y + 18}"/>
      <line x1="${s.x - 13}" y1="${s.y - 13}" x2="${s.x + 13}" y2="${s.y + 13}"/>
      <line x1="${s.x - 13}" y1="${s.y + 13}" x2="${s.x + 13}" y2="${s.y - 13}"/>
    </g>`).join("");
  return `
    <svg class="illust" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="450" fill="#F6F4EE"/>
      <rect x="400" width="400" height="450" fill="#F2F7F6"/>
      <line x1="400" y1="0" x2="400" y2="450" stroke="#0A2540" stroke-width="1"/>
      <circle cx="200" cy="160" r="60" fill="#F2C28A" opacity="0.5"/>
      <circle cx="200" cy="160" r="60" fill="none" stroke="#0A2540" stroke-width="1.5"/>
      ${sunRays}
      <circle cx="170" cy="300" r="34" fill="#B95F72" stroke="#0A2540" stroke-width="1.5"/>
      <circle cx="220" cy="320" r="28" fill="#B95F72" opacity="0.8" stroke="#0A2540" stroke-width="1.5"/>
      <circle cx="200" cy="270" r="22" fill="#3CCFA1" stroke="#0A2540" stroke-width="1.5"/>
      <text x="200" y="410" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="14" font-weight="700" fill="#0A2540" letter-spacing="3">FRESH</text>
      ${flakes}
      <rect x="560" y="330" width="50" height="50" fill="#3CCFA1" stroke="#0A2540" stroke-width="1.5"/>
      <rect x="615" y="330" width="50" height="50" fill="#B95F72" stroke="#0A2540" stroke-width="1.5" opacity="0.8"/>
      <text x="600" y="410" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="14" font-weight="700" fill="#0A2540" letter-spacing="3">FROZEN</text>
      <text x="400" y="50" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#0A2540" letter-spacing="3" font-weight="600">VS</text>
      <circle cx="400" cy="50" r="20" fill="none" stroke="#0A2540" stroke-width="1.5"/>
    </svg>`;
}

function heroSugar() {
  const items = Array.from({ length: 24 }).map((_, i) => {
    const x = 60 + (i % 8) * 90;
    const y = 70 + Math.floor(i / 8) * 110;
    const isFruit = (i + Math.floor(i / 8)) % 3 === 0;
    return isFruit
      ? `<circle cx="${x}" cy="${y}" r="22" fill="#B95F72" stroke="#0A2540" stroke-width="1.5" opacity="0.85"/>`
      : `<rect x="${x - 22}" y="${y - 22}" width="44" height="44" fill="#fff" stroke="#0A2540" stroke-width="1.5"/>`;
  }).join("");
  return `
    <svg class="illust" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="450" fill="#F6F4EE"/>
      ${items}
      <rect x="40" y="380" width="720" height="36" fill="#fff" stroke="#0A2540" stroke-width="1.5"/>
      <text x="56" y="404" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="#0A2540" letter-spacing="2">INGREDIENTS: FRUIT, CANE SUGAR, MALTODEXTRIN, NATURAL FLAVOR…</text>
    </svg>`;
}

function heroPricing() {
  const fruitsLeft = Array.from({ length: 6 }).map((_, i) => {
    const cx = 120 + (i % 3) * 60, cy = 200 + Math.floor(i / 3) * 60;
    const opacity = 0.4 + (i % 3) * 0.15;
    return `<circle cx="${cx}" cy="${cy}" r="22" fill="#3CCFA1" opacity="${opacity}" stroke="#0A2540" stroke-width="1.5"/>`;
  }).join("");
  const fruitsRight = Array.from({ length: 18 }).map((_, i) => {
    const cx = 465 + (i % 6) * 42, cy = 170 + Math.floor(i / 6) * 50;
    const r = 6 + (i % 4) * 2;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#F2C28A" stroke="#0A2540" stroke-width="1.2"/>`;
  }).join("");
  return `
    <svg class="illust" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="450" fill="#F2F7F6"/>
      <g>
        <rect x="80" y="80" width="280" height="290" fill="#fff" stroke="#0A2540" stroke-width="1.5"/>
        <rect x="80" y="80" width="280" height="48" fill="#0A2540"/>
        <text x="100" y="111" font-family="Source Serif 4, serif" font-size="20" font-weight="600" fill="#fff">$3.99</text>
        <text x="340" y="111" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#3CCFA1" letter-spacing="2">/ 1.2OZ</text>
        ${fruitsLeft}
        <text x="100" y="350" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#0A2540" letter-spacing="2">100% FRUIT · WHOLE PIECES</text>
      </g>
      <g>
        <rect x="440" y="80" width="280" height="290" fill="#fff" stroke="#0A2540" stroke-width="1.5"/>
        <rect x="440" y="80" width="280" height="48" fill="#B95F72"/>
        <text x="460" y="111" font-family="Source Serif 4, serif" font-size="20" font-weight="600" fill="#fff">$2.49</text>
        <text x="700" y="111" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#fff" letter-spacing="2">/ 1.2OZ</text>
        ${fruitsRight}
        <text x="460" y="350" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#0A2540" letter-spacing="2">FRUIT, SUGAR, STARCH</text>
      </g>
      <text x="400" y="225" text-anchor="middle" font-family="Source Serif 4, serif" font-size="22" font-style="italic" font-weight="500" fill="#0A2540">vs</text>
    </svg>`;
}

function heroProcess() {
  const steps = [
    { x: 100, label: "FRESH", icon: "fruit" },
    { x: 290, label: "FREEZE", icon: "snow" },
    { x: 480, label: "VACUUM", icon: "vac" },
    { x: 670, label: "CRISP", icon: "crisp" },
  ];
  const stepsSvg = steps.map((step, i) => {
    let icon = "";
    if (step.icon === "fruit") icon = `<circle cx="${step.x}" cy="190" r="36" fill="#B95F72" stroke="#0A2540" stroke-width="1.5"/>`;
    if (step.icon === "snow") icon = `
      <g stroke="#0A2540" stroke-width="1.5" stroke-linecap="round">
        <line x1="${step.x - 30}" y1="190" x2="${step.x + 30}" y2="190"/>
        <line x1="${step.x}" y1="160" x2="${step.x}" y2="220"/>
        <line x1="${step.x - 22}" y1="168" x2="${step.x + 22}" y2="212"/>
        <line x1="${step.x - 22}" y1="212" x2="${step.x + 22}" y2="168"/>
      </g>`;
    if (step.icon === "vac") icon = `
      <g>
        <circle cx="${step.x}" cy="190" r="36" fill="none" stroke="#0A2540" stroke-width="1.5"/>
        <path d="M${step.x - 24} 190 Q${step.x} 165 ${step.x + 24} 190 Q${step.x} 215 ${step.x - 24} 190" fill="none" stroke="#3CCFA1" stroke-width="1.5"/>
        <circle cx="${step.x}" cy="190" r="5" fill="#0A2540"/>
      </g>`;
    if (step.icon === "crisp") icon = `
      <g stroke="#0A2540" stroke-width="1.5" stroke-linecap="round" fill="none">
        <path d="M${step.x - 30} 180 Q${step.x - 18} 168 ${step.x - 6} 180 Q${step.x + 6} 192 ${step.x + 18} 180 Q${step.x + 30} 168 ${step.x + 30} 180"/>
        <path d="M${step.x - 30} 195 Q${step.x - 18} 207 ${step.x - 6} 195 Q${step.x + 6} 183 ${step.x + 18} 195 Q${step.x + 30} 207 ${step.x + 30} 195"/>
        <path d="M${step.x - 30} 210 Q${step.x - 18} 198 ${step.x - 6} 210 Q${step.x + 6} 222 ${step.x + 18} 210 Q${step.x + 30} 198 ${step.x + 30} 210"/>
      </g>`;
    const next = steps[i + 1];
    const arrow = next ? `
      <g>
        <line x1="${step.x + 70}" y1="190" x2="${next.x - 70}" y2="190" stroke="#0A2540" stroke-width="1.5"/>
        <path d="M${next.x - 78} 184 L${next.x - 70} 190 L${next.x - 78} 196" fill="none" stroke="#0A2540" stroke-width="1.5"/>
      </g>` : "";
    return `
      <g>
        <rect x="${step.x - 70}" y="120" width="140" height="140" fill="#fff" stroke="#0A2540" stroke-width="1.5"/>
        ${icon}
        <text x="${step.x}" y="290" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#0A2540" letter-spacing="2">${step.label}</text>
        <text x="${step.x}" y="310" text-anchor="middle" font-family="Source Serif 4, serif" font-size="14" font-weight="600" fill="#0A2540">0${i + 1}</text>
        ${arrow}
      </g>`;
  }).join("");
  return `
    <svg class="illust" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="450" fill="#F6F4EE"/>
      ${stepsSvg}
      <text x="400" y="60" text-anchor="middle" font-family="Source Serif 4, serif" font-size="16" font-style="italic" fill="#0A2540">The freeze-drying cycle, in four parts</text>
    </svg>`;
}

function heroMoisture() {
  return `
    <svg class="illust" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="450" fill="#F2F7F6"/>
      <g transform="translate(140, 80)">
        <path d="M80 0 C40 80, 0 130, 0 180 a80 80 0 0 0 160 0 c0 -50 -40 -100 -80 -180z" fill="#3CCFA1" opacity="0.25" stroke="#0A2540" stroke-width="1.8"/>
        <path d="M50 200 c0 30 20 50 50 50" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      </g>
      <g transform="translate(420, 90)">
        <line x1="0" y1="0" x2="0" y2="240" stroke="#0A2540" stroke-width="1.5"/>
        <line x1="0" y1="240" x2="280" y2="240" stroke="#0A2540" stroke-width="1.5"/>
        <text x="-30" y="10" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#0A2540">10%</text>
        <text x="-30" y="245" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#0A2540">0%</text>
        <text x="0" y="265" font-family="JetBrains Mono, monospace" font-size="10" fill="#0A2540">DAY 0</text>
        <text x="280" y="265" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#0A2540">DAY 30</text>
        <path d="M0 220 L280 215" stroke="#3CCFA1" stroke-width="3" fill="none"/>
        <path d="M0 220 Q70 200 140 140 T280 40" stroke="#B95F72" stroke-width="3" fill="none"/>
        <text x="285" y="45" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#B95F72">OPENED</text>
        <text x="285" y="218" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#3CCFA1">SEALED</text>
        <text x="0" y="-20" font-family="Source Serif 4, serif" font-size="14" font-style="italic" fill="#0A2540">Residual moisture over time</text>
      </g>
    </svg>`;
}

export const HEROES = {
  quality: heroQuality,
  "fresh-frozen": heroFreshFrozen,
  sugar: heroSugar,
  pricing: heroPricing,
  process: heroProcess,
  moisture: heroMoisture,
};

// Pick a hero illustration by frontmatter key, with a sensible fallback.
export function renderHero(key) {
  const fn = HEROES[key] || HEROES.quality;
  return fn();
}
