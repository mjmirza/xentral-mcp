/**
 * Token lean formatting of API responses for tool output.
 *
 * The Xentral V3 envelope wraps real rows in a `data` field and puts totals,
 * cursors, and summaries in an `extra` field. This formatter keeps both. It
 * strips empty values to save tokens, then caps the string length with a
 * clear truncation note. verbose true returns the full payload with only the
 * character cap applied.
 */

export interface FormatOptions {
  verbose: boolean;
  maxChars: number;
}

/** Remove null, undefined, empty string, empty array, and empty object. */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const arr = value.map(prune).filter((v) => !isEmpty(v));
    return arr;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const pv = prune(v);
      if (!isEmpty(pv)) {
        out[k] = pv;
      }
    }
    return out;
  }
  return value;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

/**
 * Build the display object. In non verbose mode the `data` rows are pruned of
 * empty fields while `extra` (totals, cursor) is kept intact so a caller can
 * page correctly.
 */
function shape(data: unknown, verbose: boolean): unknown {
  if (verbose) return data;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if ("data" in obj || "extra" in obj) {
      const out: Record<string, unknown> = {};
      if ("data" in obj) out.data = prune(obj.data);
      if ("extra" in obj) out.extra = obj.extra;
      // Keep any other top level fields as is.
      for (const [k, v] of Object.entries(obj)) {
        if (k !== "data" && k !== "extra" && !isEmpty(v)) {
          out[k] = v;
        }
      }
      return out;
    }
  }

  return prune(data);
}

/**
 * Format a response payload into a text string suitable for a tool result.
 */
export function formatResponse(data: unknown, opts: FormatOptions): string {
  const shaped = shape(data, opts.verbose);
  let text: string;
  try {
    // JSON.stringify returns the value undefined for an undefined input (for
    // example a 204 no content response), which is not a string. Fall back to
    // the literal "null" so an empty body formats cleanly instead of throwing.
    text = JSON.stringify(shaped, null, opts.verbose ? 2 : 0) ?? "null";
  } catch {
    text = String(shaped);
  }

  if (text.length > opts.maxChars) {
    const note = `\n\n[Output truncated at ${opts.maxChars} characters. Pass verbose false or narrow the page size, or use pagination to read more.]`;
    return text.slice(0, opts.maxChars) + note;
  }
  return text;
}
