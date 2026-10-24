# DPDP Act, 2023 — Statutory Compliance, Anomaly Analysis & Architecture Rules

> **Applicability:** Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023, Parliament of India), DPDP Rules, and Adjudications of the Data Protection Board of India (DPBI).  
> **Target System:** QR Ordering, POS Counter & Back-Office Multi-Tenant Restaurant Web Application (*Restaurant OS / OnTap / Flowscape*).  
> **Parties Bound:** Platform Creators/Developers (Data Processors / Joint Fiduciaries), Restaurant Operators/Admins (Data Fiduciaries), Restaurant Staff/Cashiers (Authorized Agents), and Diners/Staff (Data Principals).

---

## 1. Statutory Roles & Regulatory Mapping

Under the DPDP Act, 2023, data obligations depend on statutory classification. This application operates across three distinct roles:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          DATA PRINCIPALS                               │
│  • Diners / Customers (Dine-in, Takeaway, Online QR Scanners, Minors)  │
│  • Restaurant Employees / Staff (Waiters, Cashiers, Chefs, Managers)   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Personal Data Flow
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    DATA FIDUCIARY (Section 2(i))                       │
│  • Restaurant Owner / Operating Entity                                 │
│  • Determines the purpose and means of collecting customer phone       │
│    numbers, diner names, dietary notes, staff payroll, and sales logs. │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Processing Instructions & Infra
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    DATA PROCESSOR (Section 2(k))                       │
│  • Platform Creators / Software Developers / Hosting Providers         │
│  • Firebase Firestore, Vercel, Cloud Database, WhatsApp Cloud API,     │
│    SMS Gateways, UPI / Payment Aggregators.                            │
│  *CRITICAL ANOMALY:* If Creators aggregate diner profiles across       │
│    multiple tenant restaurants, Creators become a Joint Data Fiduciary │
│    with full statutory liability.                                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Exhaustive Section-by-Section DPDP Anomalies & Operational Risks

### Anomaly 1: The "Conditionality Trap" & Coercive Phone Collection
* **DPDP Section:** **Section 6(1)** Proviso & **Section 5(1)**.
* **The Law:** Consent must be *free, specific, informed, unconditional, and unambiguous*. The proviso to Section 6(1) explicitly prohibits conditioning the provision of any service or good upon the customer agreeing to the collection of personal data that is **not strictly necessary** for that transaction.
* **The Application Conflict:**
  * In `CustomerView.jsx` and `PunchWalkInOrders.jsx`, mobile number input fields are often treated by counter staff or automated validation as a prerequisite for placing a dine-in order.
  * In a dine-in restaurant, the table number and order items are strictly necessary to deliver food to the table. **A customer's phone number and name are NOT strictly necessary** to serve a burger or cup of coffee at Table 03.
* **The Legal Exposure:**
  * Forcing a walk-in diner to enter their phone number or refusing to generate a kitchen order ticket without phone entry constitutes **coercive consent under Section 6(1)**.
  * Penalty under Schedule item 4: **Up to ₹50 Crores**.
* **Mandatory Technical Rule:**
  1. Phone number and Diner Name on the QR interface MUST be strictly labeled as `(Optional)` in all languages.
  2. The checkout and order placement actions (`handleConfirmOrder`) must NEVER block on empty phone or name fields.
  3. Default to guest aliases (e.g., `Table 04 Guest`) if unprovided. No intrusive prompt or banner may shame or degrade the diner experience if they decline to provide contact info.

---

### Anomaly 2: "Purpose Creep" in the Customer Loyalty Engine
* **DPDP Section:** **Section 6(1)**, **Section 7(a)**, & **Section 8(7)**.
* **The Law:** Personal data collected for one specified purpose cannot be repurposed, combined, or reused for another purpose without fresh, itemised affirmative consent.
* **The Application Conflict:**
  * In `LoyaltyView.jsx`, the app takes a customer's phone number (collected during an order or walk-in punch) and searches all historical database orders (`orders.filter(o => o.phone.includes(query))`) to compute:
    1. Lifetime spend (`lifetimeSpent`).
    2. Total visits count (`visitsCount`).
    3. Automated categorization into tiers (`Silver`, `Gold`, `Platinum VIP`).
  * In `WhatsAppAlertModal.jsx` and `AdminView.jsx`, customer phone numbers are pulled into WhatsApp dispatch links and promo tools.
  * **The Anomaly:** A diner who typed their phone number into `CustomerView.jsx` simply to receive an order completion SMS or bill receipt did **NOT** consent to:
    * Behavioral profiling.
    * Lifetime spending scoring and algorithmic tier categorisation.
    * Promotional broadcasts and discount remarketing.
* **The Legal Exposure:**
  * Repurposing transactional contact info for loyalty profiling or promotional messaging without a distinct, unbundled opt-in checkbox is a direct violation of Section 6(1) and Section 8(7).
  * Penalty: **Up to ₹50 Crores**.
* **Mandatory Technical Rule:**
  1. Customer registration into `LoyaltyView` must be an explicit, independent affirmative action (e.g., an un-checked by default opt-in: *"Join VIP Dining Club & Earn Reward Points"*).
  2. Transactional order alerts (e.g., *"Your food is cooking"*) must be strictly decoupled from marketing broadcasts.
  3. If a diner enters their phone solely for a digital receipt, that number MUST be scrubbed from loyalty query indexes.

---

### Anomaly 3: The Child Diner & Behavioral Tracking Prohibition
* **DPDP Section:** **Section 9(1)**, **Section 9(2)**, & **Section 9(3)**.
* **The Law:**
  * Section 9(1): A Data Fiduciary must obtain **verifiable parental consent** before processing any personal data of a child (defined under Section 2(f) as anyone under **18 years of age**).
  * Section 9(3): **Absolute statutory prohibition:** *A Data Fiduciary shall not undertake tracking or behavioral monitoring of children or targeted advertising directed at children.*
* **The Application Conflict:**
  * In family restaurants, cafes, ice cream parlours, and food courts, children and teenagers under 18 scan table QR codes independently.
  * They enter their names and mobile numbers.
  * The app's upselling engine (`Suggestables`, combos, dessert pairings FR-C8) and the loyalty engine in `LoyaltyView.jsx` analyze order history, frequency, and recommend targeted items.
  * If a minor's phone number is saved, tracked, or profiled, the restaurant and platform are in direct breach of Section 9(3).
* **The Legal Exposure:**
  * Processing children's data without parental consent or engaging in behavioral tracking/targeting carries a statutory fine under Schedule item 3 of **Up to ₹200 Crores**.
* **Mandatory Technical Rule:**
  1. The QR customer landing page must display a clear micro-notice: *"Intended for diners aged 18 and above. Diners under 18 must order under parental / guardian supervision."*
  2. No automated profiling, loyalty tier assignment, or personalized upselling push notifications may be directed toward phone numbers tagged as or belonging to minors.
  3. If age is unknown, the application must treat all guest data with data-minimisation safeguards, avoiding deep behavioral tracking on pure QR web clients.

---

### Anomaly 4: Erasure Right vs. Statutory Tax & Food Safety Record-Keeping
* **DPDP Section:** **Section 12(3)** & **Section 8(8)** vs. **GST Act Section 36** / **Income Tax Act** / **FSSAI Regulations**.
* **The Law:**
  * Section 12(3) grants Data Principals the right to demand erasure of their personal data.
  * Section 8(7) mandates that the Data Fiduciary must erase personal data as soon as the purpose is served or consent is withdrawn.
  * *HOWEVER*, Section 8(8) states data may be retained if retention is **necessary for compliance with any law for the time being in force**.
  * Under Section 36 of the Central Goods and Services Tax (CGST) Act, 2017, every registered business must maintain accounts and records (sales registers, invoices, tax summaries) for **72 months (6 years)** from the due date of filing of annual returns.
* **The Application Conflict:**
  * If a customer visits the restaurant, spends ₹4,500, pays via UPI, and then exercises their DPDP Right to Erasure demanding total deletion of their records.
  * If the restaurant deletes the entire order record from the database, they breach GST laws and risk tax prosecution.
  * If the restaurant refuses to delete the record, the customer files a grievance before the DPBI alleging non-compliance with Section 12(3).
* **The Legal Exposure:**
  * Conflicting statutory penalties (tax penalties vs. DPDP non-compliance penalty up to **₹50 Crores**).
* **Mandatory Technical Rule (PII Decoupling & Anonymization):**
  1. **Never delete the financial ledger.** The financial audit trail (Order ID, Timestamp, Item SKUs, Total Amount, CGST, SGST, Payment Mode) must be retained for 6-8 years.
  2. **Cryptographically Purge the Personal Data Identifiers:**
     ```javascript
     // Compliant Erasure Execution
     order.customerName = "[ERASED_PER_DPDP_SEC_12]";
     order.phone = "[PURGED]";
     order.notes = "[PURGED]";
     order.dinerSessionId = null;
     order.isAnonymized = true;
     ```
  3. Once anonymized, the remaining data is no longer "Personal Data" under Section 2(t), fully satisfying both the DPDP Act and the GST Act.

---

### Anomaly 5: Unencrypted Plaintext CSV Exports & POS Data Dumping
* **DPDP Section:** **Section 8(5)** — *Reasonable Security Safeguards*.
* **The Law:** The Data Fiduciary must protect personal data in its possession or under its control by taking reasonable security safeguards to prevent personal data breach.
* **The Application Conflict:**
  * In `AdminView.jsx` and `src/utils/accountingExport.js`, the platform provides features to export sales histories, orders, and payroll lists to unencrypted `.csv` files:
    * `exportOrdersToCSV`: Exports diner names, mobile numbers, order items, and payment timestamps directly to the local desktop downloads folder.
    * `exportPayrollToCSV`: Exports employee names, phone numbers, attendance logs, daily wages, and statutory deduction figures (PF, ESI, TDS).
  * In a restaurant setting, the counter PC or billing tablet is often shared among rotating staff, cashiers, and part-time workers. Any staff member can click "Export CSV", copy the file to a USB flash drive or email it to themselves, leaking thousands of customer and staff records.
* **The Legal Exposure:**
  * Failure to implement access controls and safeguards against unauthorized data extraction violates Section 8(5).
  * Statutory Penalty: **Up to ₹250 Crores**.
* **Mandatory Technical Rule:**
  1. CSV exports containing phone numbers or customer names must require **Owner/Master Password re-authentication**.
  2. Public/staff exports must default to **masked PII**:
     * Customer Phone: `+91 98765*****`
     * Staff Phone: `+91 91234*****`
  3. Download actions must be logged in an audit trail with timestamp, user ID, and IP/terminal signature.

---

### Anomaly 6: Multi-Tenant Data Leakage in Cloud Sync & Firebase
* **DPDP Section:** **Section 8(5)**, **Section 8(2)**, & **Section 2(u)**.
* **The Law:** Platforms must guarantee strict data isolation. A leak of personal data between two business tenants constitutes an actionable **Personal Data Breach**.
* **The Application Conflict:**
  * In `firebaseSync.js`, `CloudSyncModal.jsx`, and `systematicDatabase.js`, the app synchronizes menu items, orders, staff records, and theme settings.
  * If Firestore rules are set to `allow read, write: if true;` or if query parameters rely solely on client-supplied `businessId` without server-side cryptographic authentication:
    * A rogue restaurant owner or malicious actor can modify their local client state, listen to Firestore root collections, and dump all orders and customer phone numbers belonging to rival restaurants.
* **The Legal Exposure:**
  * Personal data breach due to gross architectural negligence under Section 8(5).
  * Penalty: **Up to ₹250 Crores**.
* **Mandatory Technical Rule:**
  1. Cloud Firestore / Backend rules MUST enforce server-enforced multi-tenant isolation:
     ```javascript
     // Rule pattern:
     match /businesses/{bizId}/orders/{orderId} {
       allow read, write: if request.auth != null && request.auth.token.bizId == bizId;
     }
     ```
  2. Customer ordering sessions must be cryptographically sandboxed so that customer clients can only read the specific order matching their active token/session signature.

---

### Anomaly 7: Statutory Breach Notification Trap (No Small-Business Exemption)
* **DPDP Section:** **Section 8(6)**.
* **The Law:** In the event of a personal data breach, the Data Fiduciary **MUST** intimate the Data Protection Board of India (DPBI) and **each affected Data Principal** in such form and manner as may be prescribed.
* **The Application Conflict:**
  * Unlike international regulations that provide safe harbours or risk-based thresholds for minor incidents, the DPDP Act 2023 contains **no de minimis exception** for small businesses.
  * If a restaurant's counter tablet is stolen, or a cashier's account credentials are compromised, or a developer leaves an open Firebase database endpoint that gets scraped:
    * The small cafe owner is legally mandated to report the incident to the central DPBI and individually message every affected customer.
    * Neither the cafe owner nor the developer typically has an Incident Response Plan or automated breach notification channel.
* **The Legal Exposure:**
  * Failure to notify the Board and affected Data Principals under Section 8(6) attracts an independent penalty under Schedule item 2 of **Up to ₹200 Crores**.
* **Mandatory Technical Rule:**
  1. The platform must maintain a tamper-evident administrative log of all authentication attempts, role switches, and bulk exports.
  2. The developer must provide an automated emergency lock & wipe command in `DeveloperAdminView` to instantly invalidate compromised tenant tokens.
  3. An Incident Response procedure and DPBI breach notification template must be maintained in the operational documentation.

---

### Anomaly 8: Employee Personal Data & Payroll Surveillance
* **DPDP Section:** **Section 7(i)** & **Section 8(3)**.
* **The Law:** Section 7(i) allows processing of personal data without explicit consent for the purposes of employment, or to safeguard the employer from loss or liability. However, this is strictly limited to necessary employment functions and does not grant carte blanche to expose or misuse employee data.
* **The Application Conflict:**
  * In `AdminView.jsx`, the Staff and Payroll module stores:
    * Employee full names, phone numbers, operational roles.
    * Daily clock-in and clock-out attendance timestamps.
    * Monthly base wages, bonus records, cash advances.
    * Statutory deductions: Provident Fund (PF), Employee State Insurance (ESI), Tax Deducted at Source (TDS).
  * If staff permissions in `CounterView.jsx` or shared terminals are improperly gated, a cashier or waiter could access fellow employees' wage rates, phone numbers, or attendance histories.
  * Furthermore, if attendance or deduction calculations are erroneous, it violates Section 8(3) (duty to ensure accuracy and completeness when personal data is used to make decisions affecting the individual).
* **The Legal Exposure:**
  * Unauthorized internal disclosure of employee PII; violation of Section 8(5) and Section 8(3).
  * Penalty: **Up to ₹50 Crores**.
* **Mandatory Technical Rule:**
  1. The Payroll & Attendance view must be accessible **EXCLUSIVELY** under authenticated Owner/Admin role with explicit PIN/password verification.
  2. Counterpersons, cashiers, and kitchen displays must have zero visibility into employee payroll, bank details, or statutory deduction fields.
  3. Employees have the right under Section 12 to inspect their attendance and wage records for correction.

---

### Anomaly 9: Dietary & Health Inferences from Order Notes
* **DPDP Section:** **Section 2(t)** & **Section 6(1)**.
* **The Law:** Personal data includes any data about an individual who is identifiable by or in relation to such data. Special instructions revealing dietary, health, or religious attributes (e.g., "Customer has acute peanut allergy", "Diabetic patient - zero sugar", "Strictly Halal / Jain preparation") are linked directly to customer names and phone numbers.
* **The Application Conflict:**
  * In `CustomerView.jsx` (FR-C4: Per-item and overall order notes) and `PrinterModal.jsx`:
    * Notes are captured, displayed on kitchen display tickets (KDS), printed on receipts, and stored permanently in database order logs.
    * When stored alongside diner names and mobile numbers, this builds a historical dossier of medical, physical, or religious dietary restrictions.
* **The Legal Exposure:**
  * Storing sensitive health and dietary preferences indefinitely without explicit consent for health profiling violates Section 6(1) and Section 8(7).
* **Mandatory Technical Rule:**
  1. Order notes must be treated as **ephemeral operational instructions**.
  2. Once an order is transitioned to `done` or `settled`, kitchen preparation notes must be automatically scrubbed from persistent customer profiles.
  3. Receipts printed or stored must not attach medical/health profiling tags to customer loyalty records.

---

### Anomaly 10: Cross-Border Hosting & Sub-Processor Contracting
* **DPDP Section:** **Section 8(2)** & **Section 16**.
* **The Law:**
  * Section 8(2): A Data Fiduciary may engage a Data Processor to process personal data on its behalf only under a **valid contract**.
  * Section 16: The Central Government may restrict the transfer of personal data outside India to notified countries/territories.
* **The Application Conflict:**
  * Many cloud services (Firebase, Vercel, Google Cloud, Supabase) default to multi-region or US-based servers (e.g., `us-central1`, `us-east1`) unless explicitly configured to Indian regions (e.g., `asia-south1` Mumbai / Delhi).
  * Small restaurant owners deploy the web application without any written contract or Data Processing Agreement (DPA) between the restaurant and the software developer/creator.
* **The Legal Exposure:**
  * Operating without a formal DPA leaves both the creator and the restaurant owner mutually liable for statutory defaults.
* **Mandatory Technical Rule:**
  1. Firebase and cloud database instances must be explicitly provisioned in India data centers (`asia-south1` or `asia-south2`).
  2. The software must include a standard Click-Through Data Processing Agreement (DPA) between the platform provider and the restaurant entity upon business registration.

---

### Anomaly 11: Multilingual Notice & Eighth Schedule Compliance
* **DPDP Section:** **Section 5(3)** & **Section 6(5)**.
* **The Law:** The notice and request for consent must be presented to the Data Principal in **English or any language specified in the Eighth Schedule to the Constitution of India** (22 official languages including Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, etc.).
* **The Application Conflict:**
  * Most digital POS systems present legal terms, privacy notices, and consent checkouts solely in English.
  * In a local Indian restaurant, customers and counter staff speak regional languages. A consent banner rendered purely in English fails the legal test of being "informed and unambiguous" for non-English speaking citizens.
* **The Legal Exposure:**
  * Invalidation of consent under Section 6(1) and Section 5(3).
  * Penalty: **Up to ₹50 Crores**.
* **Mandatory Technical Rule:**
  1. The DPDP Privacy Notice on the QR interface must dynamically reflect the user's selected language in `i18n.js` (currently English and Hindi, with scalable translation keys for other Eighth Schedule languages).
  2. Clear, simple language must be used—free of legalese—explaining exactly why the phone number is requested and how to opt out.

---

### Anomaly 12: Shared Terminal Leaks & Client Storage Persistence
* **DPDP Section:** **Section 8(5)**.
* **The Law:** Prevent accidental disclosure, unauthorized access, or lingering leakage of personal data.
* **The Application Conflict:**
  * In `customerSessionManager.js`, customer phone numbers and names are written to browser `sessionStorage` and `localStorage` (`ontap_diner_phone`, `flowscape_diner_name`).
  * If a diner uses a shared restaurant tablet, a counter kiosk, or borrows a friend's phone:
    * The next customer who picks up the device or opens the page sees the previous customer's active order, phone number, and order history.
* **The Legal Exposure:**
  * Direct leak of customer identity to a third party.
* **Mandatory Technical Rule:**
  1. Customer session manager must automatically terminate and scrub storage upon:
     * Table QR re-scan (`wipeAllCustomerData`).
     * Order settlement and receipt dismissal.
     * 30 minutes of tab inactivity.
  2. Kiosk/Counter punch screens must auto-reset customer input fields immediately upon order ticket generation.

---

## 3. Statutory Penalty Matrix (DPDP Act, 2023 — The Schedule)

The following penalties are legally enforceable by the Data Protection Board of India (DPBI) against non-compliant Data Fiduciaries and Processors:

| Section & Violation Description | Liable Party | Maximum Statutory Penalty |
| :--- | :--- | :--- |
| **Section 8(5):** Failure to take reasonable security safeguards to prevent personal data breach (e.g. unencrypted exports, open Firestore rules, leaked database). | Data Fiduciary / Processor | **₹250 Crores** (~$30M USD) |
| **Section 8(6):** Failure to notify the Board and affected Data Principals in the event of a personal data breach. | Data Fiduciary / Processor | **₹200 Crores** |
| **Section 9:** Non-observance of obligations regarding children (behavioral tracking, targeted ads, profiling minors without parental consent). | Data Fiduciary / Platform | **₹200 Crores** |
| **Section 10:** Non-compliance with additional obligations of Significant Data Fiduciaries (if platform reaches notified threshold). | Platform Entity / SDF | **₹150 Crores** |
| **Section 5 & 6:** Failure to provide valid multilingual notice; obtaining invalid/coercive consent; conditionality violations. | Data Fiduciary / Restaurant | **₹50 Crores** |
| **Section 11, 12, 13:** Refusal to fulfill Data Principal rights (access, correction, erasure, grievance redressal). | Data Fiduciary | **₹50 Crores** |
| **Section 15:** Breach of duties by a Data Principal (e.g., impersonation, filing frivolous or false complaints). | Data Principal (Diner/Staff) | **₹10,000** |

---

## 4. Architectural Rules for Creators & Developers

To insulate the web application codebase, creators, and client businesses from DPDP liabilities, every developer contributing to this codebase must adhere to the following rules:

### Rule 1: The Zero-PII Dine-In Rule
* Never require a diner's name or phone number to browse a menu, customize items, or submit a kitchen order ticket.
* The customer order schema must support empty PII:
  ```javascript
  {
    table: "Table 04",
    items: [...],
    total: 350,
    customerName: (inputName || "").trim() || "Guest Diner",
    phone: (inputPhone || "").trim() || null, // Never default to fake mock numbers
    notes: (inputNotes || "").trim() || "",
    dpdpConsentGiven: boolean
  }
  ```

### Rule 2: Explicit DPDP Notice & Consent Banner
* Before capturing a customer's phone number on the checkout sheet or loyalty modal, render a concise DPDP Notice:
  * *"We collect your mobile number solely to send order updates and digital receipts. Your data is never shared. You may withdraw consent or request deletion at any time."*
* Offer a clear checkbox for marketing/loyalty opt-in. Never pre-tick this box.

### Rule 3: Decoupled Erasure Engine
* Implement an administrative action in `AdminView.jsx` labeled **"Process Customer Data Erasure Request"**:
  * Input: Customer phone number.
  * Action: Finds all historical orders containing that phone number and replaces `customerName`, `phone`, and `notes` with `[REDACTED_DPDP]`.
  * Deletes any linked loyalty profile in `LoyaltyView`.
  * Preserves financial ledger entries (items, total, tax, time) for tax compliance.

### Rule 4: Field-Level Masking on Non-Owner Views
* On Counter POS (`CounterView.jsx`), kitchen displays, and shared order queues:
  * Mask customer phone numbers: Display only the last 4 digits (e.g., `•••• 4821`).
  * Only an authenticated Owner/Admin entering their master credentials may view unmasked customer contact information.

### Rule 5: Storage Limitation & Automated Inactivity Wipe
* Enforce `customerSessionManager.js` across all entrypoints:
  * Session storage must be cleared when the diner tab is closed or after 30 minutes of inactivity.
  * Local storage keys must never store unencrypted PII across multi-day lifecycles.

### Rule 6: Secure Multi-Tenant Cloud Architecture
* Never use a single flat Firestore collection for all orders across all restaurants without security rules.
* All data must be scoped under `/businesses/{bizId}/...`.
* Ensure cloud database servers are hosted within Indian territory (`asia-south1`).

### Rule 7: Grievance Redressal Endpoint
* The app must display a **Privacy & Grievance Contact** in the Admin Settings and Customer footer:
  * Name of Grievance Officer.
  * Official email / phone for data redressal.
  * Link to complain to the Data Protection Board of India if unresolved.

---

## 5. Summary Compliance Checklist for Restaurant Operators

- [ ] **Optional Contact Policy:** Are counter staff instructed to never force customers to provide their phone number?
- [ ] **Loyalty Separation:** Are customers enrolled into loyalty rewards only after giving clear affirmative consent?
- [ ] **Minors Protection:** Is the QR interface free of behavioral tracking directed at children?
- [ ] **Staff Privacy:** Is the staff attendance and payroll view locked behind an owner-only master PIN?
- [ ] **Secure Terminals:** Is the counter billing screen locked when unattended so unauthorized persons cannot copy customer phone numbers?
- [ ] **Sanitized CSV Exports:** Are exported sales and payroll CSV files stored securely on encrypted drives and deleted when no longer needed?
- [ ] **Grievance Redressal:** Is there a designated staff member or manager responsible for responding to customer deletion/correction requests within 72 hours?

---

## 6. Functional Integrity Guarantee (Zero Functional Impact Rule)

> **MANDATORY STATUTORY & ENGINEERING DIRECTIVE:**  
> All architectural, field masking, consent notice, and privacy modifications implemented to comply with the DPDP Act, 2023 MUST NEVER affect, degrade, disrupt, or break the application's functioning in any way.

### Preserved Operational Pillars:
1. **Dine-In QR Ordering Flow:**
   - Browsing menus, selecting variants, adding dish notes, and submitting kitchen tickets execute seamlessly.
   - If a customer declines or skips entering personal contact details, the system seamlessly assigns an operational guest alias (e.g. `Table 04 Guest`) and dispatches the kitchen ticket without blocking.
2. **Real-Time Financial Precision:**
   - Staff-submitted closing totals, Top 3 KPI cards, Cash/Card/UPI drawer reconciliation, and Daily P&L calculations function with 100% numerical accuracy.
3. **Decoupled Privacy vs. Tax Reconciliation:**
   - Under Section 12(3) Right to Erasure, redacting customer identity (`[REDACTED_DPDP]`) wipes PII while preserving the financial ledger (items, total amount, taxes, timestamp, bill number) to ensure continuous compliance with Section 36 of the Central GST Act and Income Tax Act.
4. **Database & Sync Engine:**
   - Compound indexing in `IndexedDB`, background Cloud Firestore synchronization, and tenant isolation operate with sub-millisecond query performance.
5. **Terminal Permissions & Roles:**
   - Counter POS staff access, PIN verification, item restocking, and owner master authorization operate with zero degradation.

---

## 7. Global Legal Exposure Audit & Statutory Mitigations

### 1. COPPA (Children's Online Privacy Protection Act — 15 U.S.C. § 6501 et seq.)
* **The Law:** Online operators may not collect personal information from children under 13 without verified parental consent. Commercial account signups require contractual capacity (18+).
* **Mitigation:**
  - Mandatory statutory age gate added to account signup in `DeveloperAdminView.jsx`.
  - Birth year input calculates age dynamically and strictly prohibits registration for anyone under 13 with statutory notice.
  - Certifying checkbox requires confirming user is of legal capacity (18+).

### 2. EU GDPR Font Privacy (Munich Regional Court Case 3 O 17493/20)
* **The Law:** Dynamically requesting web fonts from Google CDNs (`fonts.googleapis.com` / `fonts.gstatic.com`) transmits user IP addresses without prior consent, violating GDPR Article 6(1)(f).
* **Mitigation:**
  - Removed all remote font links from `index.html`.
  - Created zero-third-party self-hosted font architecture in `src/assets/fonts.css` using local system font fallbacks and local font-face definitions.

### 3. CIPA & Wiretap Session Replay / Keystroke Telemetry (California Penal Code § 631)
* **The Law:** Real-time interception or recording of user input or screen sessions without express two-party consent constitutes unlawful wiretapping.
* **Mitigation:**
  - In `src/utils/privacyCompliance.js`, session replay is strictly `disabled` (`false`) by default.
  - Added global input masking via `data-mask="true"`, `data-private="true"`, and `data-sl="mask"` in `src/index.css` and applied across password, PIN, phone, and payment inputs in `DeveloperAdminView.jsx`, `AdminView.jsx`, and `CustomerView.jsx`.

### 4. CAN-SPAM Act (15 U.S.C. § 7704) & Marketing Email Compliance
* **The Law:** Every commercial email must include a clear and conspicuous notice of the opportunity to opt out (working 1-click unsubscribe link) and a valid physical postal address of the sender.
* **Mitigation:**
  - Implemented `src/utils/emailMarketing.js` providing `COMPANY_LEGAL_ADDRESS` and `formatMarketingEmail()`.
  - Every outgoing marketing email template automatically appends a registered postal address and a cryptographic 1-click opt-out unsubscribe link.

### 5. FTC Negative Option Rule & California Automatic Renewal Law (Cal. Bus. & Prof. Code § 17600 et seq.)
* **The Law:** Subscription services with recurring billing must disclose renewal terms clearly and conspicuously immediately adjacent to the consent/subscribe action, and provide simple 1-click online cancellation.
* **Mitigation:**
  - Prominently placed recurring renewal terms and 1-click cancellation instructions directly next to the subscription selector and submit buttons in `DeveloperAdminView.jsx` and `AdminView.jsx`.

### 6. DMCA Designated Agent Registration (17 U.S.C. § 512(c)(2))
* **The Law:** Service providers seeking Section 512 safe harbor from copyright infringement must register a designated agent with the U.S. Copyright Office and display their agent's contact info publicly.
* **Mitigation:**
  - Created statutory `DMCA.md` detailing Designated Agent registration ID (`DMCA-1049281`), registered physical address, phone, email, and notice/takedown/counter-notice rules.
  - Built `src/components/DmcaModal.jsx` and linked it directly in the footers of `CustomerView.jsx` and `AdminView.jsx`.


