/**
 * OKLCH to sRGB hex.
 *
 * The palettes in `templates.config.ts` are authored in OKLCH because that is what keeps
 * perceived lightness even across hues — two templates at the same L genuinely look equally
 * light, which CSS `hsl()` cannot promise. Browsers read it natively.
 *
 * Satori, which renders the link-preview images, does not. Rather than keep a second set of
 * hex values in config for it to drift out of step with, the conversion happens here: one
 * palette definition, converted on demand.
 *
 * Straight from the OKLab paper — OKLCH → OKLab → linear sRGB → gamma-encoded sRGB.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Linear light to gamma-encoded sRGB, the standard piecewise transfer function. */
function encode(channel: number): number {
  const c = clamp01(channel);
  const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(clamp01(encoded) * 255);
}

/** Parses `oklch(L C H)`, accepting L as either 0–1 or a percentage. */
function parse(css: string): { l: number; c: number; h: number } | null {
  const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i.exec(css.trim());
  if (!match) return null;

  const [, rawL, rawC, rawH] = match;
  if (rawL === undefined || rawC === undefined || rawH === undefined) return null;

  const l = rawL.endsWith('%') ? Number(rawL.slice(0, -1)) / 100 : Number(rawL);
  const c = Number(rawC);
  const h = Number(rawH);
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return null;
  return { l, c, h };
}

/**
 * Returns `#rrggbb`, or the fallback when the input is not OKLCH — a preview card with
 * slightly wrong colours beats one that fails to render.
 */
export function oklchToHex(css: string, fallback = '#000000'): string {
  const parsed = parse(css);
  if (!parsed) return /^#[0-9a-f]{3,8}$/i.test(css.trim()) ? css.trim() : fallback;

  const { l: lightness, c: chroma, h: hue } = parsed;
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const lCube = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCube = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCube = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const r = 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const g = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const blue = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube;

  const hex = (v: number) => encode(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(blue)}`;
}
