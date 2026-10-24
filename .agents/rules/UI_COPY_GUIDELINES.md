# User Interface Copy & Terminology Guidelines

This document establishes the mandatory user-facing copy and language rules across all interfaces (Admin/Owner Dashboard, Counter POS, Kitchen/KDS, and Customer Ordering screens).

## Core Principle
Every screen must read like a polished, consumer-ready commercial product. Never expose backend terminology, architecture details, developer notes, internal workflows, or technical mechanisms to end-users (owners, staff, or customers).

---

## Prohibited Patterns & Required Replacements

### 1. Developer & Backend Jargon
- **NEVER** use words describing internal mechanics:
  - ❌ `cross-tab broadcast`, `localStorage`, `database sync`, `payload`, `state management`, `real-time listener`, `partition`, `Firestore`, `cache`, `<50ms broadcast`.
  - ✅ Use natural, user-centric words: `Saved`, `Updated`, `Photo uploaded`, `Applied`.

### 2. Developer Console & Secret Triggers
- **NEVER** expose developer hashtags or console hooks in user dashboards:
  - ❌ `Synchronized in real-time with Developer Console (#manj)`
  - ❌ `Reset demonstration data to fresh defaults`
  - ❌ `All previous pre-made mock demo accounts have been purged`
  - ✅ Simple, relevant guidance: `Use your Owner Password to access financial settings and Counter PIN to unlock POS stations.` or standard business onboarding text.

### 3. Engineering / PRD Requirement Codes
- **NEVER** display functional requirement or specification codes:
  - ❌ `(FR-P6)`, `Section 5.4 Alert`, `Module 3.2`, `PRD-REF`
  - ✅ Friendly headings: `Suggestables & Upsell Pairing`, `Alert: Low Cash Balance`

### 4. Overly Verbose Backend Explanations in Error & Toast Messages
- Do not explain *how the backend or settings hierarchy works* when denying an action to staff:
  - ❌ `The restaurant owner can grant "Can Issue Offers" in the Owner Admin Staff & Payroll section.`
  - ❌ `Terminal operator successfully switched to ... (Master Override)`
  - ❌ `⚡ Terminal Permissions Updated: Staff permissions synchronized live from Owner Admin.`
  - ✅ Clean, respectful, non-technical feedback:
    - `Offer creation is restricted for this terminal. Please contact your manager.`
    - `You do not have permission to edit prices. Please contact your manager.`
    - `Switched to Owner.`
    - `Permissions updated.`

### 5. Fake Technical Jargon & Mock Batch Pipelines
- Do not display simulated low-level technical infrastructure details:
  - ❌ `Direct NEFT/IMPS Salary Transmission via ICICI/HDFC Corporate CMS`, `Statutory Verified batch #CMS-SAL-OCT2026`
  - ✅ Professional business terms: `Record Salary Payout`, `Export Salary Summary (CSV)`, `Monthly Salary Payout`

### 6. Image & File Upload Specifications
- Keep image upload instructions simple:
  - ❌ `PNG / Scaled for instant <50ms cross-tab broadcast`
  - ❌ `Auto-optimized for instant multi-device synchronization`
  - ✅ Clean format hints: `PNG, JPG, or WebP format`

### 7. Functional Integrity Rule (Zero Functional Impact)
- **CRITICAL REQUIREMENT**: Any UI copy, label, modal, or toast adjustment MUST NEVER affect, degrade, or break the application's functionality.
- All underlying event listeners, cross-device sync handlers, database transactions (IndexedDB & Cloud Firestore), component state managers, role permissions, and business logic MUST remain 100% intact and fully operational.
- Only visible user-facing text, error messages, feedback toasts, and instructional guidance are updated for clean consumer-ready presentation.

---

## Checklist Before Committing UI Changes
- [ ] Are all error and access restriction messages concise and actionable?
- [ ] Is there any mention of database, broadcast, sync, developer triggers, or requirement IDs?
- [ ] Would a non-technical restaurant owner or cashier understand every word without confusion?
- [ ] Has full functionality been verified with zero regressions to events, handlers, or state logic?

