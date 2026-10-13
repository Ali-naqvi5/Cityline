import "server-only";

import { stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * The office's own logo for the driver payment statements: a file in
 * `public/brand/` named `statement-logo` (.svg, .png, .jpg or .webp), trimmed
 * of empty margins and sized for print. Replacing the file changes every
 * statement from then on. Without one, or if it cannot be read, statements
 * draw the built-in logo (`domain/finance/cityline-logo.ts`).
 */

const NAMES = ["svg", "png", "jpg", "jpeg", "webp"].map((ext) => `statement-logo.${ext}`);
/** About 600 dots per inch at the size the statement prints it. */
const PIXELS = { width: 2400, height: 600 };

let cached: { key: string; png: Uint8Array } | null = null;

export async function statementLogo(): Promise<Uint8Array | null> {
  for (const name of NAMES) {
    const file = path.join(process.cwd(), "public", "brand", name);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) continue;
    const key = `${file}:${info.mtimeMs}:${info.size}`;
    if (cached?.key === key) return cached.png;
    try {
      // A vector logo is drawn at the size it will be used, not enlarged after.
      const { width = PIXELS.width } = await sharp(file).metadata();
      const png = await sharp(file, {
        density: name.endsWith(".svg") ? Math.min(2400, (72 * PIXELS.width) / width) : 72,
      })
        .trim()
        .resize({ ...PIXELS, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      cached = { key, png: new Uint8Array(png) };
      return cached.png;
    } catch (error) {
      console.error(
        `The statement logo ${name} could not be read; using the built-in one.`,
        error,
      );
      return null;
    }
  }
  return null;
}
