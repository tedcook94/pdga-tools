# Rating Projector for PDGA

`extension/` is Rating Projector for PDGA, a Chrome and Firefox extension
(Manifest V3, WXT, Svelte 5). It adds a panel above the table on
`pdga.com/player/<number>/details` where players add tournaments and leagues
they've played since the last update, and shows the projected rating for each
upcoming update with the rounds added, dropped, counted twice and aged out.

It reads the page that's open, plus one event page each time the player
imports or refreshes an event: PDGA's terms ban scrapers, so nothing is
fetched in the background, and the API has no round history. An import takes
an event ID, event page link or PDGA Live link, always requests
`www.pdga.com/tour/event/<id>` and reads only that player's results row.
Event pages also get an import icon in a column after PDGA# on each player's
results row. It reads the open page itself, so it fetches nothing.
Importing an event again replaces the earlier import.

Added events are saved in `storage.sync`, one item per event, falling back to
`storage.local` when sync fails. Open ratings pages reload when another tab
or device changes them. The only permission is `storage`.

## Rating rules

`extension/src/lib/rating.ts` recreates PDGA's method from the ratings guide
plus posts by the PDGA ratings team on the archived forum
([t-22332](https://www.pdga.com/files/discussion/archive/t-22332.html),
[t-24143](https://www.pdga.com/files/discussion/archive/t-24143.html),
[t-26808](https://www.pdga.com/files/discussion/archive/t-26808.html),
[t-28825](https://www.pdga.com/files/discussion/archive/t-28825.html)):

1. **Window:** rounds within 12 months of the latest round, or 24 months
   with fewer than 8.
2. **Outliers:** with 7 or more rounds, one pass drops rounds below the
   higher of average − 100 and average − 2.5 standard deviations (population,
   leaving out the lowest round).
3. **Doubling:** with 9 or more rounds, the newest quarter (rounded down) of
   used rounds count twice. If that splits an event, its best rounds count.
4. **Average:** rounds weigh holes ÷ 18, and each rating gets +0.5 because
   published round ratings are truncated.

League rounds on the page show only the league's dates, so round N is placed
N − 1 weeks after the start. Projections move PDGA's published rating by the
change in our calculation, which cancels most of the remaining error. Checked
against 34 saved pages: 30 exact, the rest within 1.

Ratings updates are calculated, not hard-coded: the second Tuesday of each
month, including rounds through the Sunday before.

## Commands

    pnpm -C extension dev          # Firefox with the extension loaded
    pnpm -C extension dev:chrome   # same in Chrome
    pnpm -C extension test         # Vitest
    pnpm -C extension check        # svelte-check
    pnpm -C extension build        # .output/chrome-mv3 and firefox-mv3
    pnpm -C extension zip          # store zips, plus the Firefox source zip
    pnpm -C extension icons        # regenerate icons and the promo tile from assets/*.svg (needs rsvg-convert)
    pnpm -C extension screenshots ~/shots   # store screenshots and the /rating image from raw 1.png … 5.png (needs magick)

In Firefox, the extension may need "Always allow on www.pdga.com" under its
site permissions before the panel appears.

## Releasing

1. If the listing text or screenshots changed, update them by hand in both
   store dashboards first; the upload APIs can't change listings. The text to
   paste is in `extension/store/listing.md`, next to the images (1280×800
   screenshots, 440×280 promo tile).
2. Bump `version` in `extension/package.json`. Both stores reject a version
   they've already seen.
3. Commit, then tag and push: `git tag extension-v<version> && git push origin extension-v<version>`.
4. `.github/workflows/extension.yml` runs three jobs:
   - `test` tests and zips the extension. It fails if the tag and version
     differ.
   - `release` attaches the Chrome, Firefox and source zips to a GitHub
     release.
   - `submit` waits for approval in the `stores` environment, then uploads
     those zips and submits them for review. Each store publishes once its
     review passes.

Each job runs only if the one before it passed. To submit a release again, or
to check credentials, run the workflow by hand with the release's tag; it
skips `test` and `release`, and **Only check store credentials** is on by
default.

Firefox reviewers rebuild from the source zip: Node 24 and pnpm, then
`pnpm install --frozen-lockfile && pnpm zip` in `extension/`.

### Store credentials

The `stores` environment (Settings → Environments) holds these secrets. Add
yourself as a required reviewer so each submission waits for approval.

| Secret | From |
|--------|------|
| `CHROME_PUBLISHER_ID` | Chrome Web Store developer dashboard → Account |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | A Google Cloud service account with the Chrome Web Store API enabled, added in the dashboard under Account → Service accounts |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | That service account's JSON key, the `private_key` field |
| `FIREFOX_JWT_ISSUER` | addons.mozilla.org → Developer Hub → Manage API Keys |
| `FIREFOX_JWT_SECRET` | Same page |

The extension IDs are in the workflow. To try credentials locally, put the
same names in `extension/.env.submit` (ignored by git) and run
`pnpm exec wxt submit --dry-run` with the zip flags.

## Fixtures

Tests run against saved ratings detail pages in `extension/fixtures/`,
anonymized by `scripts/trim-fixture.ts`: names and PDGA numbers are removed,
events are renamed "Event N", and layout tooltips keep only the hole count.
Never commit an untrimmed page.

    node extension/scripts/trim-fixture.ts <saved page.html> extension/fixtures/rating-<rating>.html

Event page fixtures come from `scripts/trim-event-fixture.ts`, which also keeps
only one player's results row.

    node extension/scripts/trim-event-fixture.ts <saved page.html> <PDGA number> extension/fixtures/event-<name>.html
