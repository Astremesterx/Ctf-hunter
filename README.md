# SignalCTF

A fast, static CTF discovery site with sourced listings, official links, evidence labels, local timezone display, calendar export, and filters for fees, prizes, format, location, skill, dates, and participation mode.

## Vercel deployment

Import this repository into Vercel and deploy with the detected Next.js defaults. The public build needs **no environment variables, API keys, or database**. GitHub Actions runs the source checker every six hours and commits material catalog changes to `main`, which Vercel then deploys.

- Build command: `npm run build`
- Install command: `npm ci`
- Node.js: 22 or newer

All public pages and event detail routes are prerendered. Event browsing never waits for a database or external scraper. Security headers are configured in `next.config.ts`.

The active directory recalculates event status every 30 seconds. Events leave the default and live views at their published end time (or after the final local date when no time is announced); canceled events also leave those views. Past and canceled listings remain in the archive with their source links. An open directory tab refreshes its published catalog from Vercel roughly every ten minutes, including when the tab becomes active again.

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

The scheduled job in `.github/workflows/refresh-events.yml` calls `scripts/refresh-events.mjs`. It fetches only approved public organizer URLs already in the catalog plus a short reviewed watch list. It checks robots rules, restricts HTTPS fetches to public hosts, bounds response sizes and request times, and refuses redirects. Public Mastodon and Reddit RSS feeds provide review leads only. Instagram and LinkedIn login-only posts are not scraped. CTFtime's API is not used because its terms prohibit competing directories.

New machine-readable events remain in `data/candidates.json` until two matching official-page checks at least five hours apart. Only events with a clear name, start, end, mode, matching organizer origin, and clean publication checks enter the generated `lib/auto-events.ts`. Existing listings receive fresh core-evidence dates only when a strict parser reproduces their published name, schedule, and mode. Changed facts and weaker leads go to `data/leads.json` for manual review. A successful page fetch by itself never refreshes a badge. The deployed website has no crawler or server fetch path.

Submissions and corrections open prefilled GitHub issue drafts. A maintainer reviews the issue and official evidence before updating the catalog and deploying it.

## Privacy

Saved events, organizer follows, and reminders use browser local storage. This site has no account system, first party analytics, advertising trackers, or application database. Clearing site storage removes local preferences.

## Security checks

CI runs production dependency auditing, verification and parser tests, TypeScript checking, and a full static production build. The refresh job runs the same tests, typecheck, and build before committing data. Secret files are ignored by default through `.env*`, `.dev.vars*`, and platform state rules.

## Updating events

1. Verify the event on an official organizer page or inspect a lead in `data/leads.json`.
2. Add or edit the event and its evidence in the catalog files.
3. Run `npm test && npm run typecheck && npm run build && npm run audit:prod`.
4. Review the generated event page and official links.
5. Merge and let Vercel deploy the static update.

No directory can guarantee complete worldwide coverage or real-time accuracy. Scheduled GitHub jobs may run late or be disabled after repository inactivity, and some organizers block automated access. Source facts are dated snapshots, and players should confirm details on the official page before registering or arranging travel.
