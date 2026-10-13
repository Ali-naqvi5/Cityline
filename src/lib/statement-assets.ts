import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { StatementAssets } from "@/domain/finance/statement-pdf";

/**
 * What the driver payment statement draws with, from files the app ships in
 * `public/`: the Montserrat fonts (`public/fonts/montserrat`, SIL Open Font
 * Licence) and the Cityline logo (`public/brand/cityline-logo.svg`, the same
 * file the website and admin show). The logo is stacked, its picture above its
 * name; the statement sets them side by side, so it is split at the empty band
 * between them. Replacing the logo file changes the statements from then on.
 */

const PUBLIC = path.join(process.cwd(), "public");
const LOGO = path.join(PUBLIC, "brand", "cityline-logo.svg");
const FONT = (weight: string) =>
  path.join(PUBLIC, "fonts", "montserrat", `Montserrat-${weight}.ttf`);

let fonts: Promise<StatementAssets["fonts"]> | null = null;
let logo: { key: string; parts: Promise<StatementAssets["logo"]> } | null = null;

export async function statementAssets(): Promise<StatementAssets> {
  fonts ??= loadFonts().catch((error: unknown) => {
    fonts = null;
    throw error;
  });
  return { fonts: await fonts, logo: await logoParts() };
}

async function loadFonts(): Promise<StatementAssets["fonts"]> {
  const [regular, semibold, bold] = await Promise.all(
    ["Regular", "SemiBold", "Bold"].map((weight) => readFile(FONT(weight))),
  );
  return { regular: regular!, semibold: semibold!, bold: bold! };
}

/** The logo's parts, made again only when the file changes. */
async function logoParts(): Promise<StatementAssets["logo"]> {
  const info = await stat(LOGO).catch(() => null);
  if (!info?.isFile()) return null;
  const key = `${info.mtimeMs}:${info.size}`;
  if (logo?.key !== key) {
    logo = {
      key,
      parts: splitLogo(LOGO).catch((error: unknown) => {
        console.error("The logo could not be prepared for statements.", error);
        return null;
      }),
    };
  }
  return logo.parts;
}

/** About 2400 pixels across: sharp at the size the statement prints it. */
const RENDER_WIDTH = 2400;

export async function splitLogo(
  file: string,
): Promise<{ mark: Uint8Array; name: Uint8Array | null }> {
  const { width = RENDER_WIDTH } = await sharp(file).metadata();
  const rendered = await sharp(file, {
    density: Math.min(2400, (72 * RENDER_WIDTH) / width),
  })
    .png()
    .toBuffer();
  const { data, info } = await sharp(rendered)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Which rows have anything drawn on them.
  const drawn: boolean[] = [];
  for (let y = 0; y < info.height; y++) {
    let any = false;
    for (let x = 0; x < info.width && !any; x++) {
      any = data[(y * info.width + x) * info.channels + 3]! > 24;
    }
    drawn.push(any);
  }
  // The first empty band below the picture's middle separates it from the
  // name (the name's own lines have gaps between them too, further down).
  let gap: { from: number; to: number } | null = null;
  for (let y = Math.floor(info.height * 0.4); y < info.height * 0.92 && !gap; y++) {
    if (drawn[y]) continue;
    let end = y;
    while (end + 1 < info.height && !drawn[end + 1]) end++;
    if (end - y + 1 >= info.height * 0.004) gap = { from: y, to: end };
    y = end;
  }

  const part = async (top: number, bottom: number, maxWidth: number) =>
    new Uint8Array(
      await sharp(
        await sharp(rendered)
          .extract({ left: 0, top, width: info.width, height: bottom - top })
          .png()
          .toBuffer(),
      )
        .trim()
        .resize({ width: maxWidth, withoutEnlargement: true })
        .png()
        .toBuffer(),
    );

  if (!gap) {
    return { mark: await part(0, info.height, 1200), name: null };
  }
  return {
    mark: await part(0, gap.from, 900),
    name: await part(gap.to + 1, info.height, 1400),
  };
}
