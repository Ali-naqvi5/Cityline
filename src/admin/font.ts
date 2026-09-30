import { Inter } from "next/font/google";

/**
 * Inter for the operations screens — the site's typeface, self-hosted by
 * next/font like the public site's. Exposed as `--font-inter`, which
 * `ops.css` reads into `--font-ui`. Payload's own screens keep Payload's font.
 */
export const adminFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
