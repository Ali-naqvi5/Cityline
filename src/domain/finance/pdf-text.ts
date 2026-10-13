import type { PDFFont } from "pdf-lib";

/**
 * Text helpers for the finance PDFs (driver statements in Montserrat,
 * partner invoices in the standard Helvetica, which draws only Latin-1).
 */

/** Only what the font can draw: anything else becomes "?". */
export function drawable(font: PDFFont): (text: string) => string {
  const allowed = new Set(font.getCharacterSet());
  return (text) =>
    [...text.replace(/[\r\n\t]+/g, " ")]
      .map((char) => (allowed.has(char.codePointAt(0)!) ? char : "?"))
      .join("");
}

/** Cut to fit a width, with an ellipsis. */
export function fit(text: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}
