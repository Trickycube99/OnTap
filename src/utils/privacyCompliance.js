/**
 * Privacy & Telemetry Compliance Engine
 * 
 * Complies with:
 * 1. California Invasion of Privacy Act (CIPA, Cal. Penal Code § 631) & Wiretap Acts:
 *    - Session replay tools (e.g. FullStory, LogRocket, Smartlook, PostHog, Hotjar) are strictly OFF by default.
 *    - Prohibits recording user keystrokes, browsing journeys, or interactions without explicit prior opt-in consent.
 * 2. Sensitive Input Masking:
 *    - All sensitive inputs (passwords, PINs, phone numbers, customer names, payment VPAs, bank accounts)
 *      are masked and tagged with standard privacy-masking attributes (`data-private`, `data-mask`, `data-sl="mask"`).
 */

export const PRIVACY_CONFIG = {
  // STRICT STATUTORY DEFAULT: Session Replay is OFF
  sessionReplayEnabled: false,
  
  // Input masking active across all form fields
  maskAllInputs: true,
  
  // Standard selectors recognized by privacy-first recorders & auditing proxies
  maskSelectors: [
    'input[type="password"]',
    'input[type="tel"]',
    'input[type="email"]',
    'input[name*="pin" i]',
    'input[name*="pass" i]',
    'input[name*="card" i]',
    'input[name*="upi" i]',
    'input[name*="phone" i]',
    'input[name*="account" i]',
    '[data-private="true"]',
    '[data-mask="true"]',
    '.privacy-mask'
  ],

  // Third-party telemetry allowed only if user explicitly opts in
  allowThirdPartyTelemetry: false
};

/**
 * Check if session replay is enabled (strictly false by default)
 */
export function isSessionReplayEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    // Only enabled if an explicit user consent cookie/flag was affirmative
    return localStorage.getItem('ontap_privacy_replay_consent') === 'granted' && PRIVACY_CONFIG.sessionReplayEnabled;
  } catch {
    return false;
  }
}

/**
 * Standard privacy attributes to attach to sensitive form inputs
 */
export const PRIVACY_MASK_ATTRS = {
  'data-private': 'true',
  'data-mask': 'true',
  'data-sl': 'mask',
  autoComplete: 'off'
};
