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

The scheduled job in `.github/workflows/refresh-events.yml` calls `npm run refresh:events`. It fetches approved public organizer URLs already in the catalog plus the reviewed registry in `data/scraping-sources.json`. It checks robots rules, restricts HTTPS fetches to public hosts, bounds response sizes and request times, and refuses redirects. Scrapling parses these bounded documents, extracts nested event links, and renders explicitly approved JavaScript pages when the static document contains no parsable event. Public Mastodon and Reddit RSS feeds provide review leads only. Instagram and LinkedIn login-only posts are not scraped. CTFtime's API is not used because its terms prohibit competing directories.

Scrapling's adaptive main-content selectors are saved in an Actions cache. Adaptive matches can discover leads; core facts are always parsed from the complete official document and pass the existing verification checks. At most three announcement links per organizer and eight total per run can be followed, to one level, only under explicitly approved same-origin path prefixes. Every child page gets its own robots and host checks. Browser subrequests are restricted to GET requests for scripts/data on the same origin, with public DNS addresses pinned for the browser. Redirects, popups, service workers, WebSockets, downloads, and other resource types are blocked. Rendering failures retain the original HTML and are recorded without refreshing evidence from a failed load.

The discovery job has read-only repository permissions and no saved Git credentials. A separate publishing job receives only validated catalog files and source-status metadata, checks that `main` has not changed during discovery, and commits those files. Raw pages and the adaptive database are never committed or bundled into Vercel. A small source-check report is available in each Actions run for seven days. Python dependencies are pinned in `requirements-scraping.txt` and audited in CI and scheduled runs.

New machine-readable events remain in `data/candidates.json` until two matching official-page checks at least five hours apart. Only events with a clear name, start, end, mode, matching organizer origin, and clean publication checks enter the generated `lib/auto-events.ts`. Existing listings receive fresh core-evidence dates only when a strict parser reproduces their published name, schedule, and mode. Changed facts and weaker leads go to `data/leads.json` for manual review. A successful page fetch by itself never refreshes a badge. The deployed website has no crawler or server fetch path.

Submissions and corrections open prefilled GitHub issue drafts. A maintainer reviews the issue and official evidence before updating the catalog and deploying it.

## Privacy

Saved events, organizer follows, and reminders use browser local storage. This site has no account system, first party analytics, advertising trackers, or application database. Clearing site storage removes local preferences.

## Security checks

CI runs production dependency auditing, verification and parser tests, TypeScript checking, and a full static production build. The refresh job runs the same tests, typecheck, and build before committing data. Secret files are ignored by default through `.env*`, `.dev.vars*`, and platform state rules.

## Running the Scrapling worker locally

Use Python 3.12 and install the scraper packages separately from the website:

```sh
python -m venv .scrapling-venv
# Activate .scrapling-venv, or set SCRAPLING_PYTHON to its Python executable.
python -m pip install -r requirements-scraping.txt
python -m playwright install chromium
python -m unittest discover -s tests -p 'scrapling*_test.py' -v
npm run refresh:events -- --dry-run
npm run refresh:events -- --daily --dry-run
```

To inspect one approved source, add `--source=https://csaw.io/`. The source report is written to `.scan-runtime/scraping-report.json`. The native importer remains available with `node scripts/refresh-events.mjs --dry-run`. Adding a source requires a reviewed registry entry; adding browser rendering or followable paths requires an explicit policy on that entry. Scrapling is BSD-3-Clause licensed; its bundled package retains the upstream notice. No paid proxy, CAPTCHA service, API key, or Vercel environment variable is required.

## Updating events

1. Verify the event on an official organizer page or inspect a lead in `data/leads.json`.
2. Add or edit the event and its evidence in the catalog files.
3. Run `npm test && npm run typecheck && npm run build && npm run audit:prod`.
4. Review the generated event page and official links.
5. Merge and let Vercel deploy the static update.

No directory can guarantee complete worldwide coverage or real-time accuracy. Scheduled GitHub jobs may run late or be disabled after repository inactivity, and some organizers block automated access. Source facts are dated snapshots, and players should confirm details on the official page before registering or arranging travel.

## Daily and public social discovery

The full sweep is scheduled at **00:47 UTC / 06:17 IST every day**, in addition to the six-hour official-detail checks. Manual workflow runs perform a full sweep. The reviewed registry contains organizer pages, community announcement pages, RSS/Atom feeds, and organizer-linked Instagram, X, and Facebook profiles. Published catalog sources are also checked. Public social post links found on approved organizer pages can be queued for the same daily sweep, with a maximum of 12 extra permalinks per run.

Scrapling reads public article/post markup and individual-post metadata. Social announcements go only to `data/leads.json`, with the post permalink, channel, and optional publication timestamp retained. A post timestamp is never a CTF date; social sources cannot auto-publish or refresh official evidence. Unrecognized external event links stay in review and are not automatically fetched. Old or future-dated posts are excluded when their publication timestamp is available. No API access, login cookies, paid search, proxy service, or social credentials are configured or needed for these public-page checks.

Many mainstream social feeds are not readable without login or approved API access. The importer records robots blocks, access restrictions, redirects, login walls, and missing public posts instead of claiming those feeds were scraped. Source status and the last successful daily sweep are published in `lib/source-health.ts` and displayed on `/sources`. Source-report artifacts retain more detailed diagnostics for seven days. The publishing job receives the four validated catalog files plus this status file; raw page bodies and browser state stay outside the repository and public build.
