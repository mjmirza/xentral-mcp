// Unit tests for the OAuth consent page in src/oauth/consent.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConsentPage } from "../../src/oauth/consent.js";

test("renders the form, the carried request, and the prefilled host", () => {
  const html = renderConsentPage({
    clientName: "Claude",
    oauthRequestB64: "abc-_123",
    instanceValue: "https://acme.xentral.biz",
    nonce: "n0nce",
  });
  assert.match(html, /id="consent-form"/);
  assert.match(html, /action="\/authorize"/);
  assert.match(html, /name="oauth_req" value="abc-_123"/);
  assert.match(html, /value="https:\/\/acme\.xentral\.biz"/);
  assert.match(html, />Claude</);
});

test("includes the nonce'd loading script, spinner, and a recovery watchdog", () => {
  const html = renderConsentPage({ clientName: "x", oauthRequestB64: "q", instanceValue: "", nonce: "N123" });
  assert.match(html, /<script nonce="N123">/);
  assert.match(html, /addEventListener\('submit'/);
  assert.match(html, /class="spinner"/);
  assert.match(html, /id="submit-btn"/);
  // The watchdog re-enables the button so the spinner can never run forever.
  assert.match(html, /setTimeout\(/);
  assert.match(html, /id="status"/);
  assert.match(html, /taking longer than expected/);
  // The IIFE is actually invoked, not just defined.
  assert.match(html, /\}\)\(\);<\/script>/);
});

test("omits the script entirely when no nonce is given (still a working plain form)", () => {
  const html = renderConsentPage({ clientName: "x", oauthRequestB64: "q", instanceValue: "" });
  assert.ok(!html.includes("<script"), "no script tag without a nonce");
  assert.match(html, /<button id="submit-btn"/);
});

test("shows an error block only when a message is present, and escapes it", () => {
  const none = renderConsentPage({ clientName: "x", oauthRequestB64: "q", instanceValue: "" });
  assert.ok(!none.includes('class="error"'));
  const withErr = renderConsentPage({
    clientName: "x",
    oauthRequestB64: "q",
    instanceValue: "",
    errorMessage: "Bad <token> & \"stuff\"",
  });
  assert.match(withErr, /class="error"/);
  assert.match(withErr, /Bad &lt;token&gt; &amp; &quot;stuff&quot;/);
});

test("escapes untrusted values into attributes to block injection", () => {
  const html = renderConsentPage({
    clientName: '"><script>alert(1)</script>',
    oauthRequestB64: '"/><x',
    instanceValue: '"><img>',
    nonce: "n",
  });
  assert.ok(!html.includes("<script>alert(1)"), "client name must be escaped");
  assert.ok(!html.includes('value=""/><x'), "oauth_req must be escaped");
});
