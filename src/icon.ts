/**
 * The xentral-mcp connector icon, shared by the stdio bin, the hosted worker,
 * and the pages so there is one icon everywhere.
 *
 * The source art is the logo at assets/icon.svg. This file embeds a 128x128
 * PNG render of it as a data URI, so the icon needs no hosting, ships inside the
 * package, and does not depend on any domain (a self-hosted worker still shows
 * it). The npm README references the raster PNG by an absolute raw URL, because
 * npm does not render SVG. Regenerate with tools/gen-icon.mjs after changing art.
 */

/** The connector icon as a self-contained PNG data URI (128x128). */
export const ICON_DATA_URI =
  "data:image/png;base64,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";

/** The raw PNG bytes, for the worker to serve at /icon.png and as a favicon. */
export function iconPngBytes(): Uint8Array {
  const b64 = ICON_DATA_URI.slice(ICON_DATA_URI.indexOf(",") + 1);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * The serverInfo icons array for the MCP initialize response. Defaults to the
 * self-contained data URI so it needs no hosting and does not depend on a domain.
 */
export function serverIcons(src: string = ICON_DATA_URI): Array<{ src: string; mimeType: string; sizes: string[] }> {
  return [{ src, mimeType: "image/png", sizes: ["128x128"] }];
}
