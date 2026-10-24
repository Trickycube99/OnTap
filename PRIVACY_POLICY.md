# Privacy Policy

**Effective Date:** October 24, 2026  
**Last Updated:** October 24, 2026  
**Service Provider & Data Fiduciary:** OnTap Technologies Inc. ("OnTap", "we", "us", or "our")  
**Registered Physical Address:** 100 Innovation Way, Suite 400, Wilmington, DE 19801, USA  
**Regional Office (Asia-Pacific):** OnTap Technologies India Pvt. Ltd., Level 6, Prestige Meridian, MG Road, Bengaluru, Karnataka 560001, India  
**Dedicated Privacy Contact:** `privacy@ontap.app` | **Data Protection Officer (DPO):** `dpo@ontap.app`

---

## 1. Introduction & Statutory Scope

This Privacy Policy governs the collection, processing, storage, and transfer of personal data across the OnTap web application, QR table ordering platform, POS counter, and multi-tenant administrative systems.

We are committed to maintaining the highest standards of data protection and privacy compliance in strict adherence to:
- **General Data Protection Regulation (GDPR)** (Regulation (EU) 2016/679 and UK Data Protection Act 2018)
- **California Consumer Privacy Act (CCPA) / California Privacy Rights Act (CPRA)** (Cal. Civ. Code § 1798.100 et seq.)
- **Digital Personal Data Protection Act, 2023 (DPDP Act)** (Act No. 22 of 2023, India)
- **Children's Online Privacy Protection Act (COPPA)** (15 U.S.C. § 6501 et seq.)
- **California Invasion of Privacy Act (CIPA)** (Cal. Penal Code § 631)

---

## 2. Roles: Data Fiduciary vs. Data Processor

Depending on your relationship with OnTap, responsibilities are partitioned under statutory definitions:
1. **Diners & Customers (Data Principals):** When you scan a QR code at an OnTap-enabled restaurant, the individual restaurant entity is the **Data Fiduciary / Controller** determining why your data is collected. OnTap operates as the **Data Processor** providing software infrastructure.
2. **Restaurant Owners & Staff:** When you register an account or operate a point-of-sale terminal, OnTap acts as the **Data Fiduciary / Controller** regarding your business credentials, billing details, and staff management accounts.

---

## 3. Data We Collect & Data Minimization Principles

Under our strict **Data Minimization Doctrine**, we collect only information that is strictly necessary to fulfill transactions:

### A. Diners & Table Guests (QR Client)
- **Table Session Data (Strictly Necessary):** Cryptographically signed table identifier, restaurant branch ID, selected dishes, dietary custom notes, and timestamps.
- **Optional Diner Name:** Entered optionally for kitchen order ticket greeting. If unprovided, defaults to guest alias (e.g. `Table 04 Guest`).
- **Optional Phone Number:** Entered strictly at the diner's option to receive a digital receipt or order status updates. **Order placement and dining service are NEVER conditioned on providing a phone number.**
- **Payment Information:** For UPI QR payments, transactions occur directly through your authorized payment application. We do not capture or store debit/credit card numbers or banking PINs.

### B. Restaurant Owners & Staff
- **Registration & Account Information:** Business legal name, owner name, verified email address, hashed passwords/PINs, physical store address, and service model.
- **COPPA & Majority Verification:** Year of birth to verify legal age and contractual capacity (18+ for account holders; COPPA block under 13).
- **Billing Records:** Subscription plan tier, billing frequency, and transaction history.

---

## 4. Lawful Basis for Processing (GDPR Article 6)

We process personal data solely on legitimate statutory grounds:
1. **Contractual Performance (Art. 6(1)(b)):** Processing table food orders, preparing kitchen tickets, and managing business subscriptions.
2. **Explicit Consent (Art. 6(1)(a)):** Optional marketing updates, promotional notifications, and non-essential analytical cookies. Consent is always unbundled, granular, and freely revocable.
3. **Legal & Tax Obligation (Art. 6(1)(c)):** Retaining tax-compliant transaction records and FSSAI/statutory audit records as required by fiscal legislation.
4. **Legitimate Interests (Art. 6(1)(f)):** Preventing fraud, securing cryptographic table sessions, and defending against unauthorized system access.

---

## 5. Session Replay & Telemetry Prohibition (CIPA & Wiretap Compliance)

- **Zero Covert Recording:** We strictly **DO NOT** deploy third-party session replay software (e.g., FullStory, LogRocket, Hotjar) that records keystrokes or browsing behavior without prior affirmative opt-in consent.
- **Input Masking:** All sensitive form fields (passwords, PINs, contact inputs) carry automated privacy masking attributes (`data-private="true"`, `data-mask="true"`, `data-sl="mask"`).
- **Self-Hosted Assets:** All fonts and static assets are self-hosted on our first-party domains. We do not load fonts from external Google CDNs, eliminating unauthorized IP transmission without prior consent.

---

## 6. Children's Privacy (COPPA & DPDP Section 9)

- **Under 13 Restriction:** Our platform is not directed toward children under 13 years of age. We do not knowingly collect personal information from children under 13.
- **Minors in Dining Areas:** Diners under 18 years of age scanning table QR codes must do so under adult parental or guardian supervision.
- **Absolute Prohibition on Behavioral Profiling:** We never perform automated behavioral profiling, tracking, or targeted advertising directed at minors.

---

## 7. We Do Not Sell or Share Personal Data (CCPA / CPRA Notice)

- **No Sale of Personal Data:** OnTap has not sold, rented, or commercialized any consumer personal information in the preceding 12 months, and will never do so.
- **No Cross-Context Behavioral Advertising:** We do not share consumer data with third-party data brokers or ad networks.
- **Opt-Out Rights:** California residents have the statutory right to opt out of the sale or sharing of personal data (though we do not engage in such practices).

---

## 8. Your Statutory Privacy Rights

Under GDPR, CCPA, and the DPDP Act, you possess the following enforceable rights:
1. **Right to Know / Access:** Request copies of your personal data processed by OnTap.
2. **Right to Rectification:** Request correction of inaccurate or incomplete personal data.
3. **Right to Erasure ("Right to Be Forgotten"):** Request complete deletion and anonymization of your account and personal records.
4. **Right to Data Portability:** Obtain your data in a structured, commonly used, machine-readable format (JSON/CSV).
5. **Right to Withdraw Consent:** Revoke marketing or cookie consent at any time without penalty or degradation of service.
6. **Non-Discrimination:** We will never deny services, charge different prices, or provide a lower quality of service for exercising your privacy rights.

---

## 9. Data Deletion & Retention Procedures

- **Diners:** Table ordering session data stored in `sessionStorage` is automatically purged upon browser tab closure or after 2 hours of inactivity. Diners may also click "Clear My Diner Data" in the customer footer at any time.
- **Account Holders:** Restaurant owners may permanently delete their account and erase operational data directly via the Admin dashboard (*Settings -> Danger Zone -> Delete Business Account*) or by submitting an API request to `/api/privacy/delete-data`.
- **Statutory Tax Retention:** Tax and accounting records (invoices, sales ledgers) are preserved in an anonymized statutory archive solely to comply with government tax regulations.

---

## 10. Contacting Our Data Protection Officer & Filing Grievances

If you have questions, wish to exercise statutory privacy rights, or wish to file a grievance with our Data Protection Officer:

- **Email:** `privacy@ontap.app` or `dpo@ontap.app`
- **Mail:** OnTap Technologies Inc., Attn: Data Protection Officer, 100 Innovation Way, Suite 400, Wilmington, DE 19801, USA
- **Response Timeline:** We respond to all verified statutory requests within 30 days (or within timelines prescribed by applicable law).
