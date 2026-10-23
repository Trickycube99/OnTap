// Cryptographic & Session Table Guard
// Prevents diners from accessing, snooping, or ordering on other tables by tampering with the URL

const TABLE_SECRET_SALT = 'ontap_secure_table_salt_8921_v5';

/**
 * Sanitize and format the scanned table or takeaway station parameter
 * Supports individual table numbers (e.g. '04', 'Table 04') and takeaway stations (e.g. 'Takeaway', 'Counter / Takeaway')
 */
export const sanitizeTableFromParam = (tableParam, defaultTable = 'Table 04') => {
  if (!tableParam) return defaultTable;
  const trimmed = String(tableParam).trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'stand' || lower === 'stall' || lower.includes('stand') || lower.includes('stall')) {
    return 'Counter / Stand & Eat';
  }
  if (lower === 'takeaway' || lower.includes('takeaway') || lower.includes('counter')) {
    return 'Counter / Takeaway';
  }
  if (lower.startsWith('table')) {
    const numPart = lower.replace(/\D/g, '');
    return numPart ? `Table ${numPart.padStart(2, '0')}` : trimmed;
  }
  const digits = lower.replace(/\D/g, '');
  if (digits) {
    return `Table ${digits.padStart(2, '0')}`;
  }
  return trimmed;
};

/**
 * Deterministically compute an unguessable 8-character verification signature
 * for a specific business ID and table.
 */
export function computeTableSignature(bizId, table) {
  const cleanBiz = (bizId || '').trim().toLowerCase();
  const cleanTable = sanitizeTableFromParam(table).toLowerCase();
  const payload = `${cleanBiz}::${cleanTable}::${TABLE_SECRET_SALT}`;

  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;

  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code + (i * 7)), 0x5bd1e995);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1.slice(-4)}${hex2.slice(0, 4)}`.toLowerCase();
}

/**
 * Verify whether a provided signature matches the business ID and table.
 */
export function verifyTableSignature(bizId, table, signature) {
  if (!signature || typeof signature !== 'string') return false;
  const expected = computeTableSignature(bizId, table);
  return signature.trim().toLowerCase() === expected.toLowerCase();
}

/**
 * Verify requested table against session lock or valid signature.
 * Prevents URL tampering where a diner manually modifies ?table=XX.
 *
 * @param {string} bizId - Active business ID
 * @param {string} requestedTable - Table number requested from URL or parameter
 * @param {string} incomingSig - Cryptographic signature from URL parameter
 * @param {boolean} isPrivileged - True if Admin or Developer (bypass URL tamper lock)
 * @returns {{ valid: boolean, table: string, reason: string, attemptedTable?: string }}
 */
export function verifyOrLockTable(bizId, requestedTable, incomingSig, isPrivileged = false, defaultTable = 'Table 04') {
  const cleanRequested = sanitizeTableFromParam(requestedTable, defaultTable);

  // 1. Privileged accounts (Admin / Developer) can test and switch any table freely
  if (isPrivileged) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('flowscape_guest_table', cleanRequested);
      sessionStorage.setItem('flowscape_table_sig', computeTableSignature(bizId, cleanRequested));
    }
    return { valid: true, table: cleanRequested, reason: 'privileged' };
  }

  const storedLockedTable = typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem('flowscape_guest_table')
    : null;

  // 2. Scenario: User already has a locked table in their dining session
  if (storedLockedTable) {
    // If URL has a different table requested:
    if (requestedTable && cleanRequested.toLowerCase() !== storedLockedTable.toLowerCase()) {
      // Check if they physically scanned a new table's authentic QR code:
      const hasValidNewSig = verifyTableSignature(bizId, cleanRequested, incomingSig);

      if (hasValidNewSig) {
        // Legitimate new physical QR code scanned at another table: update session lock
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('flowscape_guest_table', cleanRequested);
          sessionStorage.setItem('flowscape_table_sig', incomingSig);
          sessionStorage.setItem('flowscape_guest_scanned_qr', 'true');
        }
        return { valid: true, table: cleanRequested, reason: 'new_qr_scan' };
      }

      // TAMPER DETECTED: Customer edited ?table=... in the URL without a valid signature for that table!
      return {
        valid: false,
        table: storedLockedTable,
        attemptedTable: cleanRequested,
        reason: 'tamper_blocked'
      };
    }

    // Table matches or none was in URL: keep verified locked table
    return { valid: true, table: storedLockedTable, reason: 'session_locked' };
  }

  // 3. Scenario: Fresh guest arrival without an existing locked session
  if (requestedTable) {
    const isValidSig = verifyTableSignature(bizId, cleanRequested, incomingSig);

    if (isValidSig) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('flowscape_guest_table', cleanRequested);
        sessionStorage.setItem('flowscape_table_sig', incomingSig);
        sessionStorage.setItem('flowscape_guest_scanned_qr', 'true');
      }
      return { valid: true, table: cleanRequested, reason: 'verified_qr_scan' };
    }

    // Someone typed a table in the URL directly without scanning a valid QR code
    return {
      valid: false,
      table: cleanRequested,
      attemptedTable: cleanRequested,
      reason: 'unverified_url'
    };
  }

  // Fallback default
  return { valid: true, table: defaultTable, reason: 'default' };
}
