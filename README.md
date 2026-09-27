# SignalCTF

Built with React, Vinext, Cloudflare Workers, and D1: server rendering, typed components, and durable SQL storage in one deployable app. A CTF discovery site with 28 sourced listings, official links, transparent evidence, and a reviewable ingestion pipeline. Charcoal surfaces, lime/cyan accents, self-hosted Space Grotesk and JetBrains Mono, keyboard navigation, and reduced-motion support.

## Features

- Search and filters for participation, format, skill, location, dates, team size, evidence-backed free/paid entry, cash/non-cash/no-prize categories, challenge categories, registration, and verification.
- Calendar and agenda, local timezones, source evidence, official links, and archives.
- Signed-in bookmarks, organizer follows, in-app updates, and calendar downloads with optional alarms.
- Event submissions, issue reports, public social announcements, and an authenticated review desk.
- Source registry, approval notes, check history, and conflict review.
- Durable Cloudflare D1 storage; account-owned records are not held in browser storage.

## Local development

Use Node.js 24 (minimum 22.13), npm, and Git. Windows ARM64 may need x64 Node for the Worker runtime.

```sh
npm ci --include=dev --include=optional
npm run dev -- --port 5174
npm test
npm run typecheck
npm run build
```

Before starting, copy `.env.example` to `.dev.vars` and set local values. Set `SITE_ORIGIN` to the selected localhost URL. `ADMIN_EMAILS=seedy@sites.test` enables the local fixture reviewer; never use this fixture in production. Do not commit `.dev.vars`.

If `.sites-runtime/execution-profile.json` is absent, use the installed Sites plugin's `scripts/configure-execution-profile.mjs`. After the first build, initialize a fresh local database once with `npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lovely_dazzler.sql` before using the preview. Hosted Sites applies packaged migrations on deployment. Do not replay an applied migration.

Portable preview provides a loopback-only ChatGPT sign-in fixture. Hosted authentication uses the Sites gateway; local fixture auth is excluded from production builds. Never expose a standalone Worker that trusts client-supplied identity headers without the authenticated gateway.

## Data and verification

Twenty-one additional listings extend the original seven. The initial records were researched from public sources; unknown fields remain unannounced. Six records have incomplete or conflicting details and are labeled Needs review. Counts and freshness labels change over time.

Evidence holds each field, value, source URL, source type, and check timestamp. Verified publishing requires matching official evidence for title, start, attendance mode, and end if known. Corroboration also requires evidence from an independent domain. Fetch success alone does not renew verification; matching parsed core facts do. Checks older than seven days show Recheck due. Publication rejects future check timestamps, stale core evidence, conflicting normalized facts, and unsupported fee/prize classifications. Detail pages show a per-field checklist. Monetary valuations of passes or vouchers are not classified as cash.

Six schedule adapters cover SunshineCTF, FAUST, hack.lu, The Catch, PatriotCTF, and Deccan CTF. Generic JSON-LD Event/SportsEvent extraction and RSS/Atom/public-page discovery generate review candidates. This is bounded discovery from approved sources, not unrestricted web crawling.

The importer checks robots rules, accepts public HTTPS, rejects private/numeric hosts and embedded credentials, refuses automatic redirects, and limits time and response size. A terms/permission review is required before enabling a source. It deduplicates events and preserves identity for rescheduled editions. New or changed event facts require review before publication. CTFtime's API is excluded because its reuse terms restrict competing directories.

### Social coverage

The registry includes organizer-linked Instagram and community accounts. Instagram checks are paused because the relevant pages were not retrievable. Users can submit public post URLs as leads; these are not automatically verified. No login bypass, Instagram credential, or claim of exhaustive social coverage is included.

### Scheduling and reminders

Visits trigger one bounded due-source check after the response. Sources become due after six hours. Manual checks have a five-minute lock. This is visit-triggered maintenance, not a guarantee of checks every six hours.

For unattended operation, `POST /api/jobs` accepts `Authorization: Bearer <JOB_TOKEN>`. It checks up to three due sources and generates due in-app reminders. `scripts/run-ingestion.mjs` and `.github/workflows/source-checks.yml` support an external scheduler. The workflow is disabled until repository variable `INGESTION_ENABLED=true`; configure `SITE_ORIGIN` and secret `JOB_TOKEN`. A private Site also requires access through its gateway. The job token alone does not cross that gateway. No independent scheduler has been activated.

Reminders appear in the app on visits/checks. Downloaded calendar alarms run in the user's calendar app. No email, SMS, or web push service is configured. Calendar files are snapshots and must be re-exported after changes. Tentative schedules are excluded from exports.

## Owner and review desk

Sign in, open `/admin`, and enter the private one-time owner setup code. `ADMIN_SETUP_TOKEN` is a hosted secret; the first claim is stored atomically and later claims rejected. `ADMIN_EMAILS` can alternatively contain an explicit allowlist. The private owner guide contains the real setup code and job token; neither is in the repository or source ZIP.

Reviewers inspect/edit event evidence, publish changes, resolve reports/leads, enable approved sources, and inspect logs. Publication and resolution require an audit note. User submissions are limited atomically to five per user per day.

## Structure

- `app/`: pages, metadata, and API routes.
- `components/`: directory, detail, account, forms, and review interfaces.
- `lib/catalog-data.ts`, `lib/catalog-expanded.ts`, `lib/catalog-worldwide.ts`: initial real events and provenance.
- `lib/ingestion-core.ts`: parsers, robots rules, announcement discovery.
- `lib/ingestion.ts`: bounded fetches, comparisons, and review queue.
- `lib/store.ts`: D1, idempotent seeding, and notifications.
- `lib/events.ts`: time handling, identity, verification, and calendar export.
- `db/schema.ts`, `drizzle/`: schema and migrations.
- `tests/core.test.ts`: dates, deduplication, parsers, evidence, and URL checks.
- `public/fonts/`: self-hosted fonts and license files.

## Hosting and scope

Reuse the Site identity in `.openai/hosting.json`. The Sites workflow builds Worker output, packages migrations, pushes the matching source, and deploys. Secrets are configured separately. Event browsing is public. Account data, submissions and the review desk still require authentication.

This is a growing directory, not a complete worldwide inventory. Some sources need custom adapters or human review; social platforms may need authorized API access. Source facts are snapshots with visible check dates.

### GitHub / Vercel handoff

This version targets Cloudflare Workers/D1 and Sites gateway authentication. It is not deployable unchanged on Vercel. Once a destination repository is provided, the migration must replace the Cloudflare database binding with a Vercel-accessible database, replace Sites identity headers with supported server-side authentication, adapt the server build, move secrets, migrate stored records, and re-test access controls and jobs. Do not copy local mock authentication into production.

Internal navigation uses standard anchors because the current Vinext beta's production Link transition failed. This preserves server-rendered, keyboard-accessible navigation.

A clearly marked fictional demo fixture is included at `examples/demo-event.json`. It is not imported into the live directory and the publish API rejects demo records.
