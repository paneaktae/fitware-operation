# Fitware · Sales & Ads

An inventory-first operating workspace for a single used commercial gym equipment business. This is a working full-stack V1, with a verified local demo. It is not a multi-tenant SaaS.

**Delivery status:** local PostgreSQL migration, demo seed, application, automated tests, browser workflow and production build are available. Source is published at [paneaktae/fitware-operation](https://github.com/paneaktae/fitware-operation), and GitHub Actions validation passed. A Vercel deployment has **not** been created. Live OpenAI and Meta requests have **not** been tested with business credentials. Review the limitations below before using real ad spend.

## What is implemented

- Administrator login through Better Auth. Public registration is disabled.
- Responsive dashboard, inventory, campaigns, leads, advisor, analytics, and settings.
- Mobile bottom navigation; desktop sidebar; light/dark appearance.
- Inventory creation, editing with stale-form protection, archive, quantity/reservations, condition, costs/prices, notes and related campaign performance.
- Image uploads (JPEG/PNG/WebP) with actual image decoding, metadata removal, rotation, resizing and WebP conversion; MP4 uploads; multiple assets, alt text, ordering and primary media. Keyboard/touch reorder buttons complement drag ordering.
- Campaign brief → strategy/copy variations → editable review → paused creation → separate activation confirmation. At least three angles, five primary texts, five headlines and three descriptions. Thai, English and bilingual templates; OpenAI structured generation when configured.
- Campaign metrics, health classification, pause and budget confirmation, 20% maximum budget increases, stale revision rejection, stock checks and audit history.
- CRM stages, contact links, timeline notes, qualification, lost reasons, won sale capture and revenue corrections.
- Sales attribution to inventory, campaign, ad (when supplied) and lead. Row locking prevents duplicate sales and overselling under concurrent requests.
- Date ranges and comparison periods in Asia/Bangkok. Spend, leads, qualified leads, revenue, CPL and ROAS charts. Campaign, machine and brand comparisons; CSV export.
- Advisor using a read-only business-data tool with the OpenAI Responses API; clear deterministic demo summaries without a key.
- Persisted, refreshable rule-based recommendations. Their reasoning includes actual inventory, lead quality and sales data. Approval is required for execution.
- Server-only Meta adapter with account/currency/timezone checks, paused object creation, manual/hourly insights sync, daily snapshot upserts, status/budget changes and uncertain-operation reconciliation.
- PWA manifest, app icon and safe-area navigation. No offline business-data caching.

## Architecture

One Next.js App Router application, React, strict TypeScript, Tailwind CSS, Radix/shadcn-style button/dialog primitives, PostgreSQL, Prisma, Zod, Better Auth, the official OpenAI SDK, and a server-side Meta Graph API adapter. Charts are lazy-loaded. There are no microservices, organizations, subscriptions or billing features.

Financial amounts are stored as integer **satang** (THB × 100). Display helpers format baht. UTC instants are used for events and sales; Meta daily snapshots use a calendar `DATE` aligned to Asia/Bangkok. Live ad accounts must use THB and Asia/Bangkok.

```text
src/
  app/
    (workspace)/[section]/page.tsx   Protected server-rendered workspace
    api/[...path]/route.ts          Authenticated application APIs
    api/auth/[...all]/route.ts      Better Auth handlers
    api/demo-login/route.ts         Development-only demo convenience
    login/                         Administrator login
    globals.css                    Responsive design system
  components/
    workspace.tsx                  Shared desktop/mobile shell
    dashboard.tsx                  Business brief + recommendations
    inventory.tsx                  Equipment, media and editing
    campaigns.tsx                  Builder, review and spend confirmation
    leads.tsx                      CRM, timeline and sale capture
    advisor.tsx                    Read-only analyst interface
    analytics.tsx                  Outcome comparison + CSV
    settings.tsx                   Business defaults, sync, audit log
    ui/                            Accessible shared primitives
  lib/
    auth.ts, db.ts                 Authentication and PostgreSQL access
    schemas.ts, business.ts        Validation and pure business rules
    data.ts                        Reporting and period aggregation
    operations.ts                  Transactional lead/sale/stock logic
    campaign-operations.ts         Confirmed spending changes
    storage.ts                     Local / Vercel Blob storage adapter
    ai/                            Structured generation, tools, recommendations
    meta/                          Account, transport, campaigns, insights, reconciliation
prisma/
  schema.prisma                    Relational models and indexes
  migrations/                      Checked-in initial SQL migration
  seed.ts                          Administrator + optional demo records
scripts/
  setup-env.mjs                    Generates local-only secrets
  local-db.ts                      Embedded PostgreSQL development server
  verify-browser.mjs               Complete browser workflow
  cleanup-verification.ts          Removes only named verification fixtures
  check-production.mjs             Production password-login and responsive checks
  reset-admin-password.ts          Explicit environment-driven password reset
tests/                             Business, Meta mock and database tests
.github/workflows/ci.yml            PostgreSQL-backed validation pipeline
vercel.json                        Next.js deployment and hourly sync schedule
```

## Database models

| Area                | Models                                              |
| ------------------- | --------------------------------------------------- |
| Authentication      | User, Session, Account, Verification, RateLimit     |
| Inventory           | InventoryItem, InventoryMedia                       |
| Advertising         | Campaign, AdSet, Ad, Creative, CampaignMetric       |
| CRM and attribution | Lead, LeadEvent, Sale                               |
| Operations          | AIRecommendation, AuditLog, Integration, AppSetting |

Core business fields are normalized. JSON is limited to campaign strategy, audience snapshots and audit before/after data. A sale has a unique lead ID. Daily metrics have a unique campaign/date pair. Inventory is archived rather than deleted so attribution is preserved.

## Requirements

- Node.js 24 LTS recommended; the local delivery was exercised on Node.js 26.
- npm and PostgreSQL 17+ (the bundled development helper currently runs PostgreSQL 18).
- Production PostgreSQL accessible from your deployment, with TLS configured by the provider.
- For live AI: an OpenAI project API key.
- For live advertising: a Meta business app, system-user or appropriate long-lived token, ad account and Page access, and an approved image hash.

## Local setup

Run inside this `fitware` directory:

```sh
npm ci
node scripts/setup-env.mjs
npm run db:generate
npm run db:local
```

Keep the database terminal running. In another terminal:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:3000**. Click **Explore local demo**. This convenience endpoint is disabled in a production build. The administrator email and randomly generated password are stored only in the ignored `.env` file. The setup script does not overwrite an existing environment.

If another application is using `localhost:3000`, use the explicit `127.0.0.1` address. `APP_URL` and `BETTER_AUTH_URL` must match the exact browser origin. To use another port, change both URLs and start Next with that port.

For an existing PostgreSQL server, skip `db:local` and configure its `DATABASE_URL`. The embedded database is development tooling, not a hosted database strategy. It stores data in `.data/postgres` and listens on loopback port 55432. Its fixed local development database credentials must never be used for a production service.

### Administrator setup

`db:seed` creates one email/password administrator using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. It hashes the password through Better Auth. The password must be at least 12 characters; use a unique randomly generated production password. Re-running seed does not reset the password. To reset the administrator password, set the new value securely in the ignored environment file and run `npm run admin:reset-password`; this also revokes existing sessions. Public registration is disabled, and there is no self-service password reset email flow.

### Demo mode

`DEMO_MODE=true` seeds six machines (including the five requested examples and a Life Fitness treadmill), six campaigns, 60 days of daily metrics, 72 leads, four sales and sample recommendations. Values are coherent sample records rather than fixed dashboard labels; date ranges and mutations change the results.

- Every demo campaign is tagged `isDemo=true` in the database.
- Demo creation, activation, pausing and budget changes never call Meta—even if credentials are present.
- With no OpenAI key, copy comes from explicit templates; the advisor summarizes saved records. Both are labeled as demo behavior.
- If an OpenAI key is configured, generation uses the live OpenAI API and may incur OpenAI charges, while advertising still remains simulated.
- Images initially use clearly labeled equipment illustrations. These are not manufacturer/product photographs. Upload your own machine images.
- Demo data persists in PostgreSQL across refreshes and restarts. Browser storage is not the business database.
- Use a **separate empty production database** before setting `DEMO_MODE=false`. Reports deliberately reject a mixed live/demo database.

## Environment reference

Copy `.env.example` and use secure server-side deployment variables. Never prefix credentials with `NEXT_PUBLIC_`, commit `.env`, or paste keys into source files.

| Variable                         | Purpose                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | PostgreSQL connection string; use the provider's pooled connection for serverless     |
| `APP_URL`, `BETTER_AUTH_URL`     | Exact application origin, HTTPS in production                                         |
| `BETTER_AUTH_SECRET`             | At least 32 random characters, distinct per environment                               |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`  | Initial administrator provisioning; remove password from hosted runtime after seeding |
| `DEMO_MODE`                      | Explicit `true` for simulation; `false` for an unseeded live database                 |
| `OPENAI_API_KEY`                 | OpenAI project key; server-only                                                       |
| `OPENAI_MODEL`                   | A model supporting Responses and structured outputs, configurable                     |
| `META_APP_ID`, `META_APP_SECRET` | Meta app identity and app-secret proof                                                |
| `META_ACCESS_TOKEN`              | Server-held token with required asset access and permissions                          |
| `META_AD_ACCOUNT_ID`             | Numeric account ID, with or without `act_` prefix                                     |
| `META_PAGE_ID`                   | Facebook Page used for Messenger ads                                                  |
| `META_INSTAGRAM_ACCOUNT_ID`      | Reserved configuration; Instagram delivery is not implemented in this V1              |
| `META_API_VERSION`               | Explicit supported Graph API version; no assumed fallback version                     |
| `META_IMAGE_HASH`                | Approved image already uploaded to the ad account                                     |
| `MAX_DAILY_BUDGET_THB`           | Maximum daily budget; defaults to 10,000 THB                                          |
| `STORAGE_PROVIDER`               | `local` for development or `vercel-blob` for hosted uploads                           |
| `BLOB_READ_WRITE_TOKEN`          | Vercel Blob server token                                                              |
| `CRON_SECRET`                    | At least 32 random characters for scheduled sync authorization                        |

## OpenAI configuration

Set `OPENAI_API_KEY` securely on the server and choose `OPENAI_MODEL` supported by your account. The default is configurable rather than inferred from ChatGPT availability. API billing is separate from the ChatGPT plan.

The implementation uses the official SDK's **Responses API**, `responses.parse`, and `zodTextFormat` for validated campaign strategies. The advisor is supplied only read-only function definitions. Its compact context excludes buyer contact details and internal notes. Responses are not stored by this app with the provider (`store:false`). Product facts and instructions are dynamically scoped to the requested machine.

Model responses still need human review: schema validation enforces output structure, not the factual truth of every sentence. No generated copy is automatically published. Failure is shown with a retry path; live mode never silently falls back to invented results.

Official references consulted:

- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)

## Meta setup and permissions

1. Create or use the business's Meta developer app with Marketing API access.
2. Assign the ad account and Facebook Page to the intended system user. Use a token appropriate for your business ownership and permissions; keep it server-side and rotate/revoke it through Meta.
3. For managing **your own ad account**, Meta's official collection lists Standard Access with `ads_read` and `ads_management`. Reading Insights uses ad read access; creating/updating advertising needs ad management access. Asset assignment is required in addition to scopes.
4. Page discovery, Messenger functions, lead forms and third-party account management can require additional Page/product permissions and review. This version does not implement an OAuth Page picker, Messenger ingestion or lead-form ingestion, so it does not request speculative extra scopes. Confirm the exact Page/creative permissions required for your account in Meta before enabling delivery.
5. Set a currently supported `META_API_VERSION` from your Meta app dashboard and the current changelog. A latest version was **not independently verified**: the direct developer documentation returned fetch/rate-limit errors in this environment. The app intentionally requires you to set the version instead of hardcoding an unverified one.
6. Upload and approve a suitable product image in Meta and set `META_IMAGE_HASH`. This V1 uses the configured image for live creation; local inventory media is not automatically uploaded to Meta.
7. Set the environment variables and use a THB / Asia/Bangkok ad account.
8. Create a small campaign. Inspect the paused campaign, ad set, creative and ad in Meta. Only then use the separate final activation confirmation.

Official sources checked:

- [Meta's official Marketing API collection: requirements, tokens and permissions](https://www.postman.com/meta/facebook-marketing-api/collection/0zr4mes/facebook-marketing-api-mapi)
- [Meta's official create/update ad examples with PAUSED status](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi?entity=request-31691153-75199fc3-314d-40ef-895b-3edbcf37ef06)
- [Authorization documentation](https://developers.facebook.com/docs/marketing-api/overview/authorization/)
- [Insights documentation](https://developers.facebook.com/docs/marketing-api/insights/)
- [Campaign reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/)

The last three direct pages were unavailable to the research tool; consult them in your authenticated Meta developer environment for final production validation. No live compatibility, account approval, or campaign acceptance is claimed.

### Spending safety and failure recovery

- Creation hardcodes `PAUSED` at campaign, ad-set and ad levels.
- Activation checks available stock, exact reviewed budget, current revision and completed state.
- Child ads/ad sets activate while their parent is paused; the parent activates last.
- Spending changes require an explicit confirmation and an audit entry. The AI tool set has no mutation functions.
- Budget changes enforce minimum/maximum limits and a maximum 20% increase per approval.
- When a live mutation fails after an external attempt, local status becomes `ERROR`; the audit says reconciliation is required. A timeout can mean the remote action succeeded.
- **Read Meta status** fetches remote status and budget without changing Meta spending. Inspect the result before retrying.
- Incomplete creation retains local/remote IDs already obtained and leaves all created delivery objects paused. Inspect those objects in Ads Manager before starting another creation operation.
- Meta's daily budget is a platform budget, not an absolute guaranteed daily spend cap. Set account spending controls in Meta as appropriate.

### Metric sync

Settings offers manual sync. `vercel.json` calls `/api/cron/sync` daily at 00:15 UTC (07:15 Bangkok) and the endpoint requires `Authorization: Bearer <CRON_SECRET>`. Set the same variable in Vercel so its cron service supplies the header. The daily schedule supports the connected Hobby plan. For more frequent sync, use manual sync or configure a scheduler/plan that supports the desired interval. Scheduled execution time is approximate.

The sync fetches a rolling 30-day attribution window, paginates through cursors, and upserts historical campaign/date snapshots. A database lease prevents concurrent sync runs. Failures retain the last successful data and show a retryable integration error.

CRM leads and actual sales are authoritative business metrics. Meta-reported leads/messages are stored separately to avoid double counting. Daily reach is stored but **not summed and called unique monthly reach**. Period reach/frequency and ad-level creative attribution are not available yet.

## Media storage

Local mode writes sanitized assets under `.data/uploads` and serves them through an authenticated route. Do not use this filesystem mode on Vercel; it is deliberately rejected there.

Hosted mode uses Vercel Blob through the storage adapter. These are **public product-media URLs**; do not upload customer records or confidential documents. Image alt text and ordering remain in PostgreSQL.

The application validates a 20 MB local limit; Vercel request-body limits can be lower (typically around 4.5 MB). Keep hosted server-proxied uploads below the platform request limit. Direct signed browser-to-Blob uploads and large video handling are V2 work. Removing media removes its database reference; orphan object cleanup is not automated.

## Validation

See [the validation record](docs/VALIDATION.md) for observed results and test scope.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Database integration tests require `DATABASE_URL` and applied migrations. They create isolated, named fixtures and remove them after completion.

For the full browser workflow, run the development app first:

```sh
npx playwright install chromium
npm run test:browser
```

The browser test creates clearly named verification records. Run `npm run test:cleanup` after it to remove only those fixtures. Screenshots and the report are written to ignored `test-results/`. `BROWSER_EXECUTABLE` optionally selects another installed browser. Do not run demo browser tests against a live business deployment.

The GitHub Actions workflow provisions a PostgreSQL service, runs migrations and seed, then lint, typecheck, tests and production build. It passed on GitHub for commit `74f470e`: [validation run](https://github.com/paneaktae/fitware-operation/actions/runs/37226173344).

## GitHub and Vercel deployment

The app is published on branch `main` in the user-provided [GitHub repository](https://github.com/paneaktae/fitware-operation). The repository contains this application at its root, including the lockfile, CI and migrations. Secrets, local data and the surrounding synced ChatGPT project are excluded.

1. Provision a dedicated managed PostgreSQL database (for example, a Vercel Marketplace provider) and Vercel Blob storage.
2. Import the repository as a Next.js project. For the published repository, use the repository root (leave Root Directory unset).
3. Use Node 24 and `npm ci`; the build is `npm run build`.
4. Set the required environment variables separately for preview and production. Keep their databases and secrets separate.
5. Apply `npm run db:migrate` against the target database as a release step. Then run `npm run db:seed` with `DEMO_MODE=false` and your administrator credentials to provision the administrator only.
6. Set HTTPS `APP_URL` and `BETTER_AUTH_URL` to the final deployment origin. Use a strong `BETTER_AUTH_SECRET` and `CRON_SECRET`.
7. Set `STORAGE_PROVIDER=vercel-blob`; configure the storage token. Remove `ADMIN_PASSWORD` from hosted runtime after one-time seeding.
8. Deploy, sign in with the administrator account, verify stock/CRM/media with test records, and test an explicitly paused Meta campaign before enabling any real delivery.
9. Configure database backups, access controls and operational monitoring with your hosting providers.

For another host, the included Dockerfile builds the same Next.js app. It needs external PostgreSQL and durable media storage. It never embeds the local `.env`.

**Current external blockers:** Git push succeeded using the authenticated local Git client. Vercel project creation returns `repo_not_found` for this repository, although the connected Vercel team has other repositories under the same GitHub owner. Check the Vercel GitHub App repository access at [GitHub installations](https://github.com/settings/installations) and include `fitware-operation`. Vercel integration configuration access also returns 403, and no hosted database connection is configured. No hosted deployment has been created.

## Security and known limitations

This is a verified local V1, not a claim of independently certified production readiness.

- Real OpenAI, Meta acceptance, token scopes, image eligibility, remote sync and hosted storage remain unverified without credentials.
- Live creation supports Facebook feed click-to-Messenger campaigns only. The demo supports the broader goal selection; live lead-form creation is explicitly blocked. Instagram placement and Messenger/Lead Ads webhook ingestion are not implemented.
- Existing campaigns are not imported automatically from Meta; Insights sync covers linked campaigns created by this application.
- Campaign creatives currently use a configured Meta image hash rather than automatic per-inventory image upload. The exact country/age/placement targeting is shown; the AI audience narrative is guidance and is not silently converted into targeting IDs.
- Recommendations are transparent rules with persisted decisions, not a trained forecasting model. Refresh them from the dashboard. Daily briefing is a calculated summary. The demo advisor has limited intent handling; use OpenAI for open-ended questions.
- CRM detail browsing initially loads the latest 1,000 leads, with client-side pagination and 30 timeline events per lead. Financial/reporting totals use a separate date-scoped query, so they are not truncated by that display limit. Inventory and campaigns are intended for a small single-business catalog. Move browsing and grouping to server pagination/aggregation before large-scale use.
- Creative comparison and deduplicated period reach/frequency are intentionally not fabricated. Day-based historical totals are persisted; ad-level reporting is V2.
- Reserved quantity is excluded from available sale stock. Release a reservation in inventory before completing its sale; reservations are not yet assigned to a particular lead.
- A won sale can have its revenue corrected but cannot be moved back to another stage. Returns, cancellations, split payments, multi-item quotations and accounting ledger entries need a dedicated workflow.
- Archive preserves history. Media deletion does not garbage-collect stored objects. Hosted uploads need direct signed upload support for large videos.
- Business currency and timezone are THB / Asia/Bangkok in V1. Country selection affects targeting, not reporting currency.
- Theme selection is per open workspace session. The manifest does not implement offline writes or guaranteed installability on every mobile browser.
- Password recovery, MFA, staff roles, alerting, and backup restore exercises are deployment hardening work.
- Database and Meta cannot share a distributed transaction. The application records ambiguous remote outcomes and requires reconciliation; it does not claim exactly-once delivery across arbitrary network failure.
- `npm audit --omit=dev` passed with zero findings after patched transitive overrides. The full development audit retains a `braces` stack-exhaustion advisory through the Next ESLint glob tooling (five dependency entries, one underlying advisory). No patched `braces` release was available during implementation; lint runs on trusted project paths. Recheck the lockfile as upstream releases change.

## Troubleshooting

- **Database unavailable:** keep `npm run db:local` running, check port 55432 and `DATABASE_URL`, and apply migrations.
- **Sign-in fails:** confirm the exact application origin and administrator account seeded in the same database. Production never exposes the local demo button.
- **403 on mutation:** the browser origin must match `APP_URL`. Reload after changing the hostname or port.
- **Stale inventory/campaign:** close and reopen the form/review. This prevents overwriting a completed sale or approving an old budget.
- **Meta token expired:** update the server token and retry manual sync. Never place it in the browser.
- **Meta mutation timed out:** inspect Meta and use Read Meta status before retrying.
- **Image rejected:** supply a valid JPEG/PNG/WebP; renamed or malformed images are rejected by actual decoding.
- **Blank analytics:** check the selected date range and CRM attribution; no leads/spend yields unavailable ratios rather than misleading zeroes.
- **API version rejected:** set a currently supported Meta API version from your app dashboard and revalidate the payload against its official documentation.

## Suggested V2

1. Meta OAuth asset picker, account permission diagnostics, per-machine creative uploads, Instagram delivery and lead webhooks.
2. Server pagination, ad-level historical metrics, deduplicated reach/frequency, cohort revenue analysis and creative experiments.
3. Lead-linked reservations, quotations, multiple line items, refunds, delivery tracking and margin reporting.
4. Staff roles, MFA/recovery, stronger action idempotency/reconciliation jobs and operational alerting.
5. Private signed media access, direct large uploads, media garbage collection and native mobile/PWA refinements.
