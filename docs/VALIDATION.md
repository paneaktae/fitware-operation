# Validation record

Local validation completed on 5 October 2026 (Asia/Bangkok).

## Automated checks

| Check                         | Result                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| PostgreSQL initial migration  | Applied successfully                                                                              |
| Demo seed                     | Successful; idempotent on subsequent seed                                                         |
| ESLint                        | Passed, no warnings in final application check                                                    |
| TypeScript strict check       | Passed                                                                                            |
| Unit/database/Meta mock tests | 21 passed across 3 files                                                                          |
| Production build              | Passed with Next.js 16.3.8 and Prisma 7.10.0                                                      |
| Production dependency audit   | 0 vulnerabilities with `npm audit --omit=dev`                                                     |
| Full tooling audit            | 5 high dependency entries from one unresolved `braces` advisory in ESLint's glob dependency chain |

## Browser workflow

Playwright Chromium verified:

- Local demo login and dashboard.
- Dashboard at 375, 390, 430 and 1440 CSS pixels, without horizontal overflow.
- Inventory creation and detail navigation.
- Real PNG upload, server-side image transformation and persisted media render.
- Campaign generation, editing, review and creation in PAUSED state.
- Activation button disabled until explicit checkbox confirmation.
- Lead creation, qualification, Won sale and actual revenue attribution.
- Thai advisor answer from stored data, using the requested current-month period.
- Inventory, campaigns, leads, advisor, analytics and settings at 390 px.
- Audit history retrieval.
- Unauthenticated report API returns 401.
- Cross-origin mutation returns 403.
- Zero browser errors in the completed workflow.

The verification records were removed by a script restricted to the test-only brand/model naming convention. Original demo records were preserved.

## Production runtime

The optimized build was also started locally on port 3100:

- Administrator email/password login passed.
- Development-only demo entry returned 403 and was absent from the login screen.
- Dashboard, inventory, campaigns, leads, advisor, analytics and settings rendered at 390 and 1440 px.
- No browser errors were reported.

## Test coverage details

Pure rules test CPL/ROAS/qualified rate/CTR/CPC/CPM, zero denominators, insufficient sample size, quality-based classification, stock reservations, unready inventory, explicit activation approval, stale revision and budget checks, budget bounds, Bangkok date boundaries, custom ranges, and malformed AI output.

Real PostgreSQL integration tests exercise repeated concurrent Won submissions, two buyers competing for one unit, revenue corrections without another stock deduction, sales attribution, and confirmed activation audit records.

Mocked Meta tests verify PAUSED campaign/ad-set/ad payloads, integer satang budgets, parent-last activation, stopping before parent activation on child failure, zero Meta calls for demo objects, and rejection of non-THB accounts.

## Limits of verification

No live OpenAI calls, Meta advertising changes, Meta acceptance/permissions validation, hosted Vercel Blob operations, remote PostgreSQL connections, GitHub workflow runs, or Vercel deployments were executed. Those require the owner's credentials and connected repository/database permissions.

Direct Meta developer pages could not be fetched by the research tool. Meta's official Postman collection was checked; the API version remains an explicit required configuration rather than an unverified hardcoded guess.

Full screenshots and machine-readable browser results are in the ignored local `test-results/` directory. The development app remains available at http://127.0.0.1:3000 while its server and local PostgreSQL process are running.
