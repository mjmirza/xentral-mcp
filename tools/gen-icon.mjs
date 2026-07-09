// Regenerate the connector icon assets and src/icon.ts from the source art.
// Run after changing assets/xentral.svg:  node tools/gen-icon.mjs
//
// Produces a 256px PNG (assets/xentral-icon.png, referenced by the README raw
// URL because npm does not render SVG) and a 128px PNG embedded into src/icon.ts
// as a data URI (the connector icon, self-contained and domain-independent).
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("assets/xentral.svg");
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

await sharp(svg, { density: 400 })
  .resize(256, 256, { fit: "contain", background: transparent })
  .png()
  .toFile("assets/xentral-icon.png");

const buf128 = await sharp(svg, { density: 400 })
  .resize(128, 128, { fit: "contain", background: transparent })
  .png()
  .toBuffer();
writeFileSync("assets/xentral-icon-128.png", buf128);

const dataUri = `data:image/png;base64,${buf128.toString("base64")}`;
const ts = `/**
 * The xentral-mcp connector icon, shared by the stdio bin, the hosted worker,
 * and the pages so there is one icon everywhere.
 *
 * The source art is the logo at assets/xentral.svg. This file embeds a 128x128
 * PNG render of it as a data URI, so the icon needs no hosting, ships inside the
 * package, and does not depend on any domain (a self-hosted worker still shows
 * it). The npm README references the raster PNG by an absolute raw URL, because
 * npm does not render SVG. Regenerate with tools/gen-icon.mjs after changing art.
 */

/** The connector icon as a self-contained PNG data URI (128x128). */
export const ICON_DATA_URI =
  "${dataUri}";

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
`;
writeFileSync("src/icon.ts", ts);
console.log("regenerated assets + src/icon.ts (data URI", dataUri.length, "chars)");
