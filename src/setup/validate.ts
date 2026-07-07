/**
 * Live token validation. Probes a cheap read so the wizard and doctor can tell
 * the user in seconds whether a token works, rather than after a failed
 * session. Tolerates no network, so setup can complete offline.
 */

export type ValidationOutcome =
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
const PROBE_TIMEOUT_MS = 12000;

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
      return { outcome: "timeout", message: "The instance did not respond in time. Check the host URL." };
    }
    return {
      outcome: "offline",
      message: "Could not reach the instance. Saved the config anyway. Run `xentral-mcp doctor` when online.",
    };
  }

  if (res.status === 200) {
    return { outcome: "valid", message: "Token verified against the live instance.", status: 200 };
  }
  if (res.status === 404) {
    return { outcome: "valid", message: "Host and token reach the API. The probe resource was not found, which is fine.", status: 404 };
  }
  if (res.status === 401) {
    return { outcome: "unauthorized", message: "The token was rejected (401). Create a new Personal Access Token.", status: 401 };
  }
  if (res.status === 403) {
    return { outcome: "forbidden", message: "The token lacks permission for the probe (403). It may still work for other reads.", status: 403 };
  }
  return { outcome: "error", message: `Unexpected status ${res.status} from the probe.`, status: res.status };
}
