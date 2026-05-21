/**
 * brevo-integration.js
 * Human Value Governance™ — Assessment email capture
 *
 * Calls the hvg-brevo-worker Cloudflare Worker.
 * No API key is present in this file or sent from the browser.
 *
 * After deploying the Worker, replace the placeholder below with
 * the URL shown by `wrangler deploy`.
 */

'use strict';

// ── Update this after `wrangler deploy` ──────────────────────────────────────
const WORKER_URL = 'https://hvg-brevo-worker.YOUR-SUBDOMAIN.workers.dev/api/brevo-contact';
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit assessment results to the Worker.
 *
 * @param {string}   email       - Recipient email address
 * @param {string}   orgName     - Organization name (may be empty string)
 * @param {number[]} scores      - Array of 7 covenant scores (0–5 each)
 * @param {number}   totalScore  - Sum of all covenant scores (0–35)
 * @param {string}   level       - Overall conformance level label
 * @returns {Promise<boolean>}   - true on success, false on any failure
 */
async function submitAssessmentResults(email, orgName, scores, totalScore, level) {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        orgName:    orgName || '',
        scores,
        totalScore,
        level,
        attributes: {
          SOURCE:    'HVG_ASSESSMENT',
          HVG_SCORE: totalScore,
          HVG_LEVEL: level,
          HVG_DATE:  today,
        },
      }),
    });

    const json = await res.json();
    return json.ok === true;
  } catch {
    return false;
  }
}

/**
 * Form submit handler — wire to the email capture form's submit event
 * or the Send button's click event.
 *
 * Reads assessment data from window.__assessment (set by assessment.html).
 * Reads form values by id: e-email, e-org, e-consent.
 * Updates button id="sendResultsBtn" and status div id="emailStatus".
 *
 * @param {Event} event
 */
async function handleEmailFormSubmit(event) {
  event.preventDefault();

  const emailInput   = document.getElementById('e-email');
  const orgInput     = document.getElementById('e-org');
  const consentInput = document.getElementById('e-consent');
  const btn          = document.getElementById('sendResultsBtn');
  const statusDiv    = document.getElementById('emailStatus');

  const email   = emailInput   ? emailInput.value.trim()   : '';
  const orgName = orgInput     ? orgInput.value.trim()     : '';
  const consent = consentInput ? consentInput.checked      : false;

  // Reset status
  if (statusDiv) {
    statusDiv.style.display = 'none';
    statusDiv.className     = '';
    statusDiv.textContent   = '';
  }

  // Guard: email required
  if (!email) {
    if (emailInput) emailInput.focus();
    return;
  }

  // Guard: consent required
  if (!consent) {
    if (consentInput) consentInput.focus();
    return;
  }

  // Pull assessment data set by assessment.html
  const assessment = window.__assessment;
  if (!assessment) {
    console.error('brevo-integration: window.__assessment not set');
    return;
  }

  const scores     = assessment.scores;
  const totalScore = assessment.total;
  const level      = assessment.level ? assessment.level.label : '';

  // Loading state
  if (btn) {
    btn.disabled     = true;
    btn.textContent  = 'Sending\u2026';
  }

  const ok = await submitAssessmentResults(email, orgName, scores, totalScore, level);

  // Re-enable button
  if (btn) {
    btn.disabled    = false;
    btn.textContent = 'Send My Results';
  }

  if (statusDiv) {
    statusDiv.style.display = 'block';

    if (ok) {
      statusDiv.className   = 'email-status-success';
      statusDiv.textContent =
        'Thank you. Check your email for your results. Reply directly with any questions \u2014 I read every message.';
      // Collapse the form fields; leave status visible
      const formFields = document.getElementById('email-form-fields');
      if (formFields) formFields.style.display = 'none';
    } else {
      statusDiv.className   = 'email-status-error';
      statusDiv.textContent =
        'Something went wrong. Please try again or visit humanvaluegovernance.com directly.';
    }
  }
}
