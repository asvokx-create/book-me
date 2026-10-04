# Remote services legal review

Status: **COUNSEL CONFIRMATION RECOMMENDED**

This engineering pass makes remote delivery a structured marketplace capability. It does not provide legal advice and does not silently rewrite the Terms, Privacy Policy, Provider Agreement, Partner Agreement, Promise, dispute policy, refund policy, safety policy, or content-removal policy.

Counsel should review those documents before launch and decide whether they must expressly cover:

- remote and digital service delivery, including what counts as completion;
- customer and provider responsibilities for video calls, digital files, third-party meeting tools, and cross-state work;
- prohibited remote-service categories, credentialed advice, regulated professional services, and age restrictions;
- refunds, cancellations, no-shows, disputes, chargebacks, evidence, and digital-delivery records;
- privacy and data handling when parties exchange files or use third-party communication tools;
- the BubsBookings Promise and any limitations specific to remote work;
- taxes, licensing, export controls, sanctions, and jurisdiction for providers serving customers outside their home state;
- clear marketplace disclosures that BubsBookings is not the service provider and does not verify every license, credential, insurance policy, or work product.

Engineering guardrails currently implemented:

- remote bookings do not require or display a physical service address;
- remote listings do not appear as local listings merely because the provider has an account address;
- the selected delivery method is snapshotted on bookings and quotes;
- Stripe payment and affiliate logic remain delivery-neutral and unchanged;
- existing listings are conservatively classified as `IN_PERSON` until their provider explicitly changes them.
