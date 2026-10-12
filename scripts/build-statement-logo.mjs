/**
 * Builds src/domain/finance/cityline-logo.ts from public/brand/cityline-logo.svg:
 * the logo's shapes as data the PDF statements can draw as vector graphics,
 * plus the two regions of it they use: the mark (plane, skyline and car)
 * and the wordmark (CITYLINE AIRPORT TRANSFERS).
 *
 * Run after the logo changes: node scripts/build-statement-logo.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

import sharp from "sharp";

const SOURCE = "public/brand/cityline-logo.svg";
const TARGET = "src/domain/finance/cityline-logo.ts";
// The gap between the car's swoosh and the lettering, in the SVG's units.
const SPLIT = 331;

const svg = readFileSync(SOURCE, "utf8");
const [, width, height] = svg.match(/viewBox="0 0 (\d+) (\d+)"/) ?? [];
const paths = [...svg.matchAll(/<path([^>]*)\/?>/g)].map((match) => ({
  d: (match[1].match(/\bd="([^"]+)"/) ?? [])[1] ?? "",
  // SVG's default fill is black.
  fill: (match[1].match(/fill="([^"]+)"/) ?? [])[1] ?? "#000000",
}));

/** The drawn area within a band of the logo, in SVG units. */
async function region(top, bottom) {
  const band = await sharp(Buffer.from(svg))
    .extract({ left: 0, top, width: Number(width), height: bottom - top })
    .png()
    .toBuffer();
  const { info } = await sharp(band)
    .trim({ threshold: 0 })
    .toBuffer({ resolveWithObject: true });
  return {
    x: -info.trimOffsetLeft,
    y: top - info.trimOffsetTop,
    width: info.width,
    height: info.height,
  };
}

const mark = await region(0, SPLIT);
const wordmark = await region(SPLIT, Number(height));

/*
 * The lettering as a picture, cleaned: the trace's letter holes white, its
 * stray light fragments left out, and the letters one colour with a hairline
 * outline so the seams between traced pieces close. Drawn as vectors, one of
 * the traced pieces leaves a stray line in some PDF readers; a picture at
 * four times print size does not.
 */
const luminance = (hex) =>
  (0.299 * parseInt(hex.slice(1, 3), 16) +
    0.587 * parseInt(hex.slice(3, 5), 16) +
    0.114 * parseInt(hex.slice(5, 7), 16)) /
  255;
const SCALE = 4;
const letteringSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wordmark.width * SCALE}" height="${wordmark.height * SCALE}" viewBox="${wordmark.x} ${wordmark.y} ${wordmark.width} ${wordmark.height}"><rect x="${wordmark.x}" y="${wordmark.y}" width="${wordmark.width}" height="${wordmark.height}" fill="#ffffff"/>${paths
  .filter((path) => path.fill === "#000000" || luminance(path.fill) < 0.55)
  .map((path) =>
    path.fill === "#000000"
      ? `<path fill="#ffffff" d="${path.d}"/>`
      : `<path fill="#33414a" stroke="#33414a" stroke-width="1.2" d="${path.d}"/>`,
  )
  .join("")}</svg>`;
const lettering = await sharp(Buffer.from(letteringSvg))
  .png({ palette: true, colours: 32, compressionLevel: 9 })
  .toBuffer();

const source = `/**
 * The Cityline logo as vector shapes, for the PDF statements. Generated from
 * \`public/brand/cityline-logo.svg\` by \`scripts/build-statement-logo.mjs\`; do
 * not edit by hand. Coordinates are the SVG's (y down).
 */

export interface LogoShape {
  d: string;
  fill: string;
}

export interface LogoRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The plane, skyline and car. */
export const LOGO_MARK: LogoRegion = ${JSON.stringify(mark)};

/** CITYLINE AIRPORT TRANSFERS. */
export const LOGO_WORDMARK: LogoRegion = ${JSON.stringify(wordmark)};

export const LOGO_SHAPES: readonly LogoShape[] = ${JSON.stringify(paths)};

/** The wordmark's lettering, cleaned, as a PNG on white (base64). */
export const LOGO_LETTERING_PNG =
  "${lettering.toString("base64")}";
`;
writeFileSync(TARGET, source);
console.log(
  `wrote ${TARGET}: ${paths.length} shapes, lettering ${lettering.length} bytes`,
  {
    mark,
    wordmark,
  },
);
