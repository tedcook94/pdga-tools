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

In Firefox, the extension may need "Always allow on www.pdga.com" under its
site permissions before the panel appears.

## Releasing

1. Bump `version` in `extension/package.json`. Both stores reject a version
   they've already seen.
2. Commit, then tag and push: `git tag extension-v<version> && git push origin extension-v<version>`.
3. `.github/workflows/extension.yml` tests and zips the extension, then
   attaches the Chrome, Firefox and source zips to a GitHub release. It stops
   before releasing if a test fails or the tag and version differ.
4. Upload the zips from the release:
   - **Chrome Web Store:** the Chrome zip. Listing images are in
     `extension/store/` (1280×800 screenshots, 440×280 promo tile).
   - **Firefox Add-ons:** the Firefox zip, plus the source zip when asked
     about bundlers. Build notes for reviewers: Node 24 and pnpm, then
     `pnpm install --frozen-lockfile && pnpm zip` in `extension/`.

## Fixtures

Tests run against saved ratings detail pages in `extension/fixtures/`,
anonymized by `scripts/trim-fixture.ts`: names and PDGA numbers are removed,
events are renamed "Event N", and layout tooltips keep only the hole count.
Never commit an untrimmed page.

    node extension/scripts/trim-fixture.ts <saved page.html> extension/fixtures/rating-<rating>.html

Event page fixtures come from `scripts/trim-event-fixture.ts`, which also keeps
only one player's results row.

    node extension/scripts/trim-event-fixture.ts <saved page.html> <PDGA number> extension/fixtures/event-<name>.html
