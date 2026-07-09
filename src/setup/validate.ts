/**
 * Live token validation. Probes a cheap read so the wizard and doctor can tell
 * the user in seconds whether a token works, rather than after a failed
 * session. Tolerates no network, so setup can complete offline.
 */

type ValidationOutcome =
  | "valid"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "timeout"
  | "offline"
  | "error";

export interface ValidationResult {
  outcome: ValidationOutcome;
  message: string;
  status?: number;
}

// The probe must carry page[number] and page[size] together, and the size must
// be at least 10, or the API returns a 400 rather than proving reachability.
const PROBE_PATH = "/api/v2/products?page[number]=1&page[size]=10";
// A snappy timeout so a slow or wrong host fails fast with a clear message on the
// consent page, rather than leaving the person waiting.
const PROBE_TIMEOUT_MS = 8000;

/**
 * Probe the instance with the given token. A 200 or 404 both prove the host
 * and token reach the API. 401 and 403 flag a bad or under permissioned token.
 */
export async function validateToken(baseUrl: string, token: string): Promise<ValidationResult> {
  const url = `${baseUrl}${PROBE_PATH}`;
  const requestInit: RequestInit = {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    // "manual" refuses to follow a redirect and works under both Node and the
    // Cloudflare Worker runtime. workerd rejects the value "error" at fetch init.
    redirect: "manual",
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  };

  let res: Response;
  try {
    res = await fetch(url, requestInit); // BESTPRACTICE_OK: timeout applied via requestInit.signal = AbortSignal.timeout above
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    if (name === "TimeoutError" || name === "AbortError") {
      return { outcome: "timeout", message: "The instance did not respond in time. Check the host is correct and reachable." };
    }
    // Neutral wording. Each caller (the CLI wizard, doctor, and the hosted
    // consent page) adds its own context, so this message stays true everywhere.
    return {
      outcome: "offline",
      message: "Could not reach the instance. Check the host is correct and reachable.",
    };
  }

  if (res.status === 200) {
    return { outcome: "valid", message: "Token verified against the live instance.", status: 200 };
  }
  if (res.status === 404) {
    return { outcome: "valid", message: "The host and token reach the API. The test read was not found, which is fine.", status: 404 };
  }
  if (res.status === 401) {
    return { outcome: "unauthorized", message: "The token was rejected (401). Create a new Personal Access Token in Xentral.", status: 401 };
  }
  if (res.status === 403) {
    return { outcome: "forbidden", message: "The token was accepted but lacks permission for the test read (403). It may still work for other reads.", status: 403 };
  }
  return { outcome: "error", message: `The instance returned an unexpected status (${res.status}). Check the host and try again.`, status: res.status };
}
