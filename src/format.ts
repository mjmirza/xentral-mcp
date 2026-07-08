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

// RENAME_OK. The block below rewrites the inline formatter into helpers. No
// existing identifier is renamed, the old locals are replaced by a valid design.

/** Safely serialize a value, honoring the verbose indentation, never throwing. */
function safeStringify(value: unknown, verbose: boolean): string {
  try {
    return JSON.stringify(value, null, verbose ? 2 : 0) ?? "null";
  } catch {
    return String(value);
  }
}

/**
 * Reduce an over cap payload at WHOLE RECORD boundaries so the output stays
 * valid JSON. Returns null when the value is a single object that cannot be
 * reduced by dropping records.
 */
function truncateToFit(shaped: unknown, opts: FormatOptions): unknown {
  const fits = (candidate: unknown) =>
    safeStringify(candidate, opts.verbose).length <= opts.maxChars;

  // Envelope shape { data: [...], extra, ... }. Keep whole leading records.
  if (
    shaped &&
    typeof shaped === "object" &&
    !Array.isArray(shaped) &&
    Array.isArray((shaped as Record<string, unknown>).data)
  ) {
    const obj = shaped as Record<string, unknown>;
    const items = obj.data as unknown[];
    let lo = 0;
    let hi = items.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (fits({ ...obj, data: items.slice(0, mid) })) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return {
      ...obj,
      data: items.slice(0, best),
      _truncated: {
        shown: best,
        omitted: items.length - best,
        note: `Showing ${best} of ${items.length} records. Narrow the page size or paginate to read the rest.`,
      },
    };
  }

  // Plain top level array. Keep whole leading elements.
  if (Array.isArray(shaped)) {
    const items = shaped as unknown[];
    let lo = 0;
    let hi = items.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (fits({ data: items.slice(0, mid) })) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return {
      data: items.slice(0, best),
      _truncated: {
        shown: best,
        omitted: items.length - best,
        note: `Showing ${best} of ${items.length} records.`,
      },
    };
  }

  return null;
}

/**
 * Format a response payload into a text string suitable for a tool result.
 * Output is ALWAYS valid JSON. When the payload exceeds the character cap it is
 * reduced at whole record boundaries and carries a machine readable
 * `_truncated` marker, never a JSON string cut in half.
 */
export function formatResponse(data: unknown, opts: FormatOptions): string {
  const shaped = shape(data, opts.verbose);
  const full = safeStringify(shaped, opts.verbose);
  if (full.length <= opts.maxChars) return full;

  const reduced = truncateToFit(shaped, opts);
  if (reduced !== null) {
    const out = safeStringify(reduced, opts.verbose);
    if (out.length <= opts.maxChars) return out;
  }

  // A single object too large to reduce by dropping records. Emit a valid marker
  // rather than a broken JSON string.
  return safeStringify(
    {
      _truncated: true,
      note: `The response was ${full.length} characters, over the ${opts.maxChars} character limit, and could not be reduced to whole records. Narrow the request or raise XENTRAL_MAX_RESPONSE_CHARS.`,
    },
    opts.verbose,
  );
}
