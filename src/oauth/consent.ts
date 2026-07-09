/**
 * The consent page for the Phase C2 OAuth flow.
 *
 * A person authorizing an MCP client sees this page once. They enter their
 * Xentral instance host and a Personal Access Token. The page states plainly
 * that the token is stored encrypted and used only to call their own Xentral,
 * and how to remove access later. The markup is light, neutral, and a single
 * centered card, with visible focus states and no external assets.
 *
 * This module is pure. It renders strings and escapes untrusted values. It
 * never touches a credential store and never logs.
 */

/** Fields the page needs to render. */
export interface ConsentPageInput {
  /** The registered client name, shown so the person knows who is asking. */
  clientName: string;
  /** Base64url of the parsed OAuth request, carried back on submit. */
  oauthRequestB64: string;
  /** Prefilled instance host, if the person is re-submitting after an error. */
  instanceValue: string;
  /** A message shown when a previous submit failed, already human readable. */
  errorMessage?: string;
  /** A per-response CSP nonce so the one small loading script may run. */
  nonce?: string;
}

/** Escape a string for safe placement in HTML text or an attribute value. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #f6f7f9;
    color: #1c2024;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  .card {
    width: 100%;
    max-width: 460px;
    background: #ffffff;
    border: 1px solid #e3e6ea;
    border-radius: 12px;
    padding: 28px;
    box-shadow: 0 1px 2px rgba(20, 24, 28, 0.06);
  }
  h1 { font-size: 20px; margin: 0 0 6px; font-weight: 650; }
  .lead { margin: 0 0 18px; color: #566069; font-size: 14px; }
  .who { font-weight: 600; color: #1c2024; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
  input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    border: 1px solid #cdd3d9;
    border-radius: 8px;
    background: #ffffff;
    color: #1c2024;
  }
  input:focus-visible {
    outline: 2px solid #1f6f43;
    outline-offset: 1px;
    border-color: #1f6f43;
  }
  .hint { font-size: 12px; color: #6b747d; margin: 6px 0 0; }
  .hint a { color: #1f6f43; }
  .privacy {
    font-size: 12.5px;
    color: #566069;
    background: #f1f4f2;
    border: 1px solid #dfe7e2;
    border-radius: 8px;
    padding: 12px 14px;
    margin: 18px 0 4px;
  }
  .error {
    font-size: 13px;
    color: #8a1f1f;
    background: #fbecec;
    border: 1px solid #f2cccc;
    border-radius: 8px;
    padding: 10px 12px;
    margin: 0 0 16px;
  }
  button {
    width: 100%;
    margin-top: 20px;
    padding: 11px 14px;
    font-size: 15px;
    font-weight: 600;
    color: #ffffff;
    background: #1f6f43;
    border: 1px solid #1a5d38;
    border-radius: 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
  }
  button:hover { background: #1a5d38; }
  button:focus-visible { outline: 2px solid #0d3a22; outline-offset: 2px; }
  button[disabled] { background: #3f7d5b; border-color: #3f7d5b; cursor: progress; opacity: 0.92; }
  .spinner {
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
    border-radius: 50%;
    display: none;
  }
  button.loading .spinner { display: inline-block; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    button.loading .spinner { animation: none; }
  }
  .status {
    font-size: 13px;
    color: #8a5a1f;
    background: #fdf3e6;
    border: 1px solid #f2ddc0;
    border-radius: 8px;
    padding: 10px 12px;
    margin: 14px 0 0;
  }
  .legal {
    font-size: 11.5px;
    line-height: 1.45;
    color: #8a929b;
    margin: 18px 0 0;
    text-align: center;
  }
`;

/**
 * Render the full consent page. All dynamic values are escaped. The form posts
 * back to /authorize with the instance host, the token, and the carried OAuth
 * request.
 */
export function renderConsentPage(input: ConsentPageInput): string {
  const clientName = escapeHtml(input.clientName || "an application");
  const oauthReq = escapeHtml(input.oauthRequestB64);
  const instanceValue = escapeHtml(input.instanceValue || "");
  const errorBlock = input.errorMessage
    ? `<div class="error" role="alert">${escapeHtml(input.errorMessage)}</div>`
    : "";
  // The one small script shows a loading state on submit and blocks a double
  // submit. It runs only under the per-response CSP nonce. Without a nonce it is
  // omitted, and the form still works as a plain post, just with no spinner.
  const nonce = input.nonce ? escapeHtml(input.nonce) : "";
  const loadingScript = nonce
    ? `<script nonce="${nonce}">(function(){var f=document.getElementById('consent-form');var b=document.getElementById('submit-btn');if(!f||!b)return;f.addEventListener('submit',function(){if(b.dataset.sent==='1'){return;}b.dataset.sent='1';b.disabled=true;b.classList.add('loading');var l=document.getElementById('btn-label');if(l){l.textContent='Verifying your token';}setTimeout(function(){b.dataset.sent='';b.disabled=false;b.classList.remove('loading');if(l){l.textContent='Authorize';}var s=document.getElementById('status');if(s){s.textContent='This is taking longer than expected. Check your network, a VPN, or a firewall, then try Authorize again.';s.style.display='block';}},20000);});})();</script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect Xentral</title>
  <link rel="icon" href="/favicon.ico" />
  <style>${STYLE}</style>
</head>
<body>
  <main class="card">
    <h1>Connect Xentral</h1>
    <p class="lead"><span class="who">${clientName}</span> wants to read data from your Xentral instance. Enter your instance host and a Personal Access Token to allow it.</p>
    ${errorBlock}
    <form id="consent-form" method="post" action="/authorize" autocomplete="off">
      <input type="hidden" name="oauth_req" value="${oauthReq}" />
      <label for="instance">Xentral instance host</label>
      <input id="instance" name="instance" type="text" inputmode="url" placeholder="https://acme.xentral.biz" value="${instanceValue}" required autofocus />
      <p class="hint">Your instance URL, or the instance id alone.</p>
      <label for="token">Personal Access Token</label>
      <input id="token" name="token" type="password" placeholder="Paste your token" required />
      <p class="hint">Create a token in your Xentral admin under the API settings. Read the <a href="https://developer.xentral.com/" target="_blank" rel="noopener noreferrer">Xentral developer docs</a> for details.</p>
      <div class="privacy">
        Your token is verified once, then stored encrypted at rest and used only to call your own Xentral. It is not shared and it is never combined with other accounts. Remove access at any time by revoking this authorization in your client and deleting the token in your Xentral admin.
      </div>
      <button id="submit-btn" type="submit"><span class="spinner" aria-hidden="true"></span><span id="btn-label">Authorize</span></button>
      <p id="status" class="status" role="status" style="display:none"></p>
    </form>
    <p class="legal">Independent tool, not affiliated with, endorsed by, or sponsored by Xentral ERP Software GmbH. Xentral&reg; is a trademark of Xentral ERP Software GmbH. To request removal of any reference, email support@next8n.com.</p>
  </main>
  ${loadingScript}
</body>
</html>`;
}
