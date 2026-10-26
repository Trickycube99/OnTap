# OnTap

OnTap provides QR table ordering, a live counter station, and restaurant administration. The frontend uses React and Vite. Netlify hosts the site and API Functions; the existing Firebase Authentication and Firestore integration provides accounts and shared operational data.

## Local development

Use Node.js 22.14 or newer and install dependencies with `npm ci`. Start the complete local environment with `netlify dev --port 8889`. The Netlify configuration defines the publish directory, SPA routes, API routing, security headers, and asset caching. The hosting platform runs the production build during deployment.

## Production configuration

Configure Firebase settings in Netlify for both build and Functions scopes. The application accepts the existing settings named `apiKey`, `projectId`, `authDomain`, `appId`, `storageBucket`, and `messagingSenderId`, as well as the corresponding `VITE_FIREBASE_*` names used by Vite. Use the same Firebase project for the frontend and Functions. Never place a Firebase service account or administrative secret in a frontend setting.

In Firebase Authentication, enable email/password login and anonymous authentication. Add the production domain and any preview domain used for account testing to the authorized domains. Set email action links to the deployed site and test verification and password recovery.

Owners use verified Firebase email/password accounts. Counter and developer access also requires verified accounts. Assign custom claims through trusted Firebase administrative tooling: `role: "developer"` for platform administrators, or `role: "counter"` and `businessId` for a restaurant's counter operator. Owner access is checked against the private business record's owner email. Browser PINs and locally initialized developer passwords do not grant production access.

## Required Firebase rollout

Deploy the supplied rules and indexes to the existing Firebase project with `firebase deploy --only firestore:rules,firestore:indexes`. Netlify deploys do not deploy Firebase rules. Confirm the intended project before running this command.

Before giving staff access, remove legacy stored passwords from private business records and staff configuration, delete the old `system_config/developer_credentials` document using Firebase administrative tooling, and rotate any passwords previously stored by the older application. Re-save existing business profiles through a verified developer account to create sanitized `public_businesses` directory records and remove legacy owner/counter PIN fields. Existing menu and offer records remain under `restaurant_config`.

Keep private business records out of public collections. Diners receive public restaurant information and menu data, while anonymous Firebase identities scope order tracking to the diner who placed the order. Legacy diner orders without `dinerUid` remain available to authorized restaurant staff; do not make them publicly readable to restore old tracking links.

## Ordering and payments

Diner and walk-in orders wait for Firestore confirmation before displaying success. Counter status changes also wait for confirmation. A failed write preserves the tray. While an order is sending, keep the page open; do not assume that a disconnected device delivered the order.

Diner orders support up to eight distinct tray lines per submission, with additional orders available for the same table. Firestore rules validate dishes against the published menu, verify totals and configured coupons, and reject guest changes to order status or payment settlement. UPI acknowledgments remain pending staff verification; a customer clicking a payment button is not payment-provider verification.

Menu image extraction runs in a verified Netlify Function through Netlify AI Gateway. Restaurant operators review extracted dishes and prices before publishing them. Text parsing and manual dish entry remain available if image scanning is unavailable.

## Privacy and deletion

Account deletion requires a recently authenticated owner. It removes dependent cloud records before removing the business profile and Firebase login, and reports failures rather than claiming successful erasure. Remote account deletion by a platform administrator requires Firebase administrative tooling. The privacy API does not report a request receipt as completed deletion.

Some existing back-office modules use device-local browser storage or IndexedDB. Validate their retention and export behavior before using them as the restaurant's sole accounting or inventory system. This release does not migrate those modules into a central financial ledger.

## Validation and launch checks

Run `npm run lint` and `npm run test:session`. With the local Netlify server running, `node scripts/testPublishReadiness.mjs` checks mobile routes, modal lifecycles, and API routing (install Chromium with `npx playwright install chromium` first). For Firestore isolation and pricing checks, run `npm run test:rules` with Java 21 or newer installed. The rule tests use a disposable demo project and do not touch production data.

The `/api/health` endpoint confirms configuration presence only. It does not certify Firebase rules, provider availability, or restaurant readiness. Before accepting customers, test an actual verified owner and assigned counter account on separate devices: publish the real menu, scan the restaurant QR code, place an order, accept and serve it, verify payment at the counter, and test failed connectivity. Also verify email recovery and account deletion with a disposable account. Production account and cross-device acceptance testing require access to the configured Firebase project.
