# SignalCTF

A fast, static CTF discovery site with 28 sourced listings, official links, evidence labels, local timezone display, calendar export, and filters for fees, prizes, format, location, skill, dates, and participation mode.

## Vercel deployment

Import this repository into Vercel and deploy with the detected Next.js defaults. The public build needs **no environment variables, API keys, database, or scheduled jobs**.

- Build command: `npm run build`
- Install command: `npm ci`
- Node.js: 22 or newer

All public pages and event detail routes are prerendered. Event browsing never waits for a database or external scraper. Security headers are configured in `next.config.ts`.

## Local development

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run audit:prod
```

## Data and verification

Catalog data lives in `lib/catalog-data.ts`, `lib/catalog-expanded.ts`, and `lib/catalog-worldwide.ts`.

Each published event links to its organizer’s page and records field level evidence with a source URL and check timestamp. Unknown fees and prizes remain unknown. Conflicting or incomplete listings display a review warning.

The parsers and safety rules in `lib/ingestion-core.ts` support an offline, review first discovery workflow. They validate public HTTPS URLs, reject private or numeric hosts and embedded credentials, respect robots rules, bound discovery output, and avoid treating social announcements as verified facts. The deployed website contains no crawler or server fetch path.

Submissions and corrections open prefilled GitHub issue drafts. A maintainer reviews the issue and official evidence before updating the catalog and deploying it.

## Privacy

Saved events, organizer follows, and reminders use browser local storage. This site has no account system, first party analytics, advertising trackers, or application database. Clearing site storage removes local preferences.

## Security checks

CI runs production dependency auditing, the 22 verification and parser tests, TypeScript checking, and a full static production build. Secret files are ignored by default through `.env*`, `.dev.vars*`, and platform state rules.

## Updating events

1. Verify the event on an official organizer page.
2. Add or edit the event and its evidence in the catalog files.
3. Run `npm test && npm run typecheck && npm run build && npm run audit:prod`.
4. Review the generated event page and official links.
5. Merge and let Vercel deploy the static update.

No directory can guarantee complete worldwide coverage. Source facts are dated snapshots, and players should confirm details on the official page before registering or arranging travel.
