# PDGA Tools

Small tools built on PDGA player data, deployed to GitHub Pages at
<https://tedcook94.github.io/pdga-tools/>. The first tool finds what percentile
your PDGA player rating falls in compared to active rated players.

> Player, event, and course data provided by [PDGA](https://www.pdga.com).

## Status

V1 is live at <https://tedcook94.github.io/pdga-tools/>. Data updates
monthly through the GitHub Action.

The PDGA approved bulk data use under the API License Agreement.

## How it works

1. A GitHub Action runs the Go fetcher after the monthly ratings update
   (see [Schedule](#schedule)).
2. The fetcher logs in to the PDGA API and pages through `/players` with
   `limit=200` at about 1 request per second.
3. It builds an in-memory map of `pdga_number` to player and keeps only
   active players (see below).
4. A second pass pages through `/player-statistics` for the current and
   previous calendar year at the same pace, recording which divisions each
   active player played (see [Divisions](#divisions)). Then it logs out.
5. It outputs **aggregate counts only**: the number of players at each rating,
   overall and per division. No names or PDGA numbers are written to disk or
   published.
6. The aggregates replace `data/current.json` and `data/current/`. The same
   `/player-statistics` rows also rewrite the current and previous year's
   files in `data/history/` (see [Rating history](#rating-history)). Past
   months live on in git history.
7. `data/` is copied into the static SvelteKit build on GitHub Pages. The
   site loads the JSON, and the user's browser computes their percentile
   from the rating they enter.

### Active players

A player is active if:

- `rating` is not null, and
- `rating_effective_date` is after the cutoff: the ratings update 12 months
  before the latest one. This covers exactly the last 12 updates.

Ratings only update for members who had rated rounds submitted between the
last two rating updates, and the API hides ratings for expired members.
Together, this means "a current member whose rating changed from rated play
in the last year."

### Divisions

An active player counts in every division they played in the current or
previous calendar year, so a player in both MA1 and MPO is in both buckets.
`/player-statistics` has no event dates, so whole years stand in for the
12-month window; the previous year keeps divisions populated early in the
year. Every division with at least one active player gets a bucket.

### Locations

Each active player counts in their `country`, and US and Canadian players
also count in their state or province (keys like `US-AL`, `CA-ON`). Other
countries' `state_prov` values are inconsistent (numeric in some), so they
aren't broken out. Location and division combine: each location also holds
per-division counts for the players in it.

- Players with no `country` count only in the world totals.
- Military mail codes (`AA`, `AE`, `AP`) count in the US total only.
- The API files Puerto Rico both as country `PR` and as US state `PR`; both
  count as the country `PR`.

### Rating history

`data/history/YYYY.json` holds one calendar year from 2000 on. A player
counts in a year if they have a `/player-statistics` row for it with a
nonzero rating, once per year (they have a row per division, all with the
same rating). That rating is their last rating update of the year, or their
current rating for the current year; spot checks against pdga.com rating
histories matched.

- Years before 2025 were written once with `-backfill`. The monthly run
  rewrites the current and previous year, so the previous year becomes final
  after January's update.
- This rule differs slightly from [active players](#active-players), so the
  current year can be a few tenths of a point off the main curve (82,131 vs.
  84,683 players in October 2026).
- A fixed rating can rank lower in every early year at once, because the
  whole field was rated higher: the median was about 910 through 2010 and
  about 880 from 2020. 900 was the 42nd percentile in 2010 and the 63rd in
  2026.

## Schedule

PDGA publishes ratings on the second Tuesday of each month
([schedule](https://www.pdga.com/faq/ratings/when-updated)).

- **Cron:** `0 17 * * *` runs every day at 17:00 UTC (noon EST, 1 PM EDT).
  The fetcher decides whether to pull, so skipped days make no API calls.
  Running daily also gives Healthchecks.io a steady signal.
- **Each run, the fetcher:**
  1. Skips if today is before this month's second Tuesday.
  2. Skips if `current.json` already has this month's `ratings_update`.
  3. Pulls `/players`.
  4. Skips without writing if no player has a `rating_effective_date` on or
     after this month's second Tuesday. Ratings aren't out yet, so the next
     day's run retries. This check comes before the second pass, so retry
     days make no `/player-statistics` calls.
  5. Pulls `/player-statistics` for both years.
  6. Fails without writing if it fetched more than 500 fewer `/players`
     records than last month. That count includes expired members, so it
     should only grow; a drop means paging stopped early.
  7. Writes the current and previous year's history, then `current.json`
     last, so a failed write is retried the next day.

### Exit codes

| Code | Meaning |
|------|---------|
| `0`  | New month written |
| `3`  | Skipped (not time yet, already written, ratings not out, or nothing new to backfill) |
| other | Failure |

`go run` reports any non-zero exit as `1`, so the workflow builds the fetcher
and runs the binary to see the real code.

### Monitoring

Two [Healthchecks.io](https://healthchecks.io) checks, pinged from the
workflow with `curl` (the Go code doesn't know about them):

| Check | Pinged when | Period / grace | Catches |
|-------|-------------|----------------|---------|
| `pdga-daily` | `/start` at start; success on exit `0` or `3`; `/fail` otherwise | 1 day / 2 hours | Crashes, or GitHub not running the schedule |
| `pdga-monthly` | Success on exit `0` only | 31 days / 10 days | Ratings update never picked up |

Ping URLs are stored in the secrets `HC_DAILY_URL` and `HC_MONTHLY_URL`.

In public repos, GitHub disables scheduled workflows after 60 days without
repository activity. The monthly data commit should prevent that, and
`pdga-daily` alerts if it happens anyway.

## Stack

| Part       | Choice                                          |
|------------|-------------------------------------------------|
| Fetcher    | Go (standard library)                           |
| Schedule   | GitHub Actions (daily cron + manual dispatch)   |
| Monitoring | Healthchecks.io                                 |
| Frontend   | SvelteKit + `adapter-static`, TypeScript        |
| Styling    | Component-scoped CSS + Open Props               |
| Tests      | Go `testing` (fetcher), Vitest (frontend)       |
| Packages   | pnpm                                            |
| Hosting    | GitHub Pages                                    |

## Frontend

### Routes

| Route | Page |
|-------|------|
| `/` | Home: list of tools |
| `/percentile` | Rating percentile |

Every page has a sticky header bar with a "PDGA Tools" wordmark that links
home (in `+layout.svelte`). Links use
`resolve()` from `$app/paths` so they work under the `/pdga-tools` base path.

### Percentile page

- A rating input (whole number, 0–1100) and the percentile, which
  updates as you type. Empty or out-of-range input shows a hint instead.
- Once a rating is entered, the result reads "percentile of all ⌄ players
  in the world ⌄", with two inline pickers (`InlinePicker.svelte`) that
  combine:
  - **Division:** grouped Pro, Amateur, Junior, then Other (nonstandard
    codes). Only divisions with players in the chosen location are listed;
    one with none resets to "all".
  - **Location:** "the world", then United States (All, then states),
    Canada (All, then provinces), then other countries, alphabetical by
    name. Names come from `Intl.DisplayNames` plus tables for states and
    provinces.
  - A location's file loads only when picked; the previous numbers stay on
    screen until it arrives.
  - The percentile, curve, and counts follow the selection. Month files
    without `divisions` or `locations` show plain text instead of a picker.
- On narrow screens the sentence and hint wrap only between phrases (before
  "in", after the comma), and the card's padding shrinks to fit more text.
- A distribution curve of active ratings (plain SVG, smoothed), with
  the area left of your rating shaded and a draggable marker. Dragging,
  tapping, or arrow keys set the rating and update the input. The curve
  shows before any rating is entered. Smaller divisions get wider smoothing
  (about ±10 ratings for all players, up to ±50 for a handful), and the
  axis spans at least 200 ratings.
- Once a rating is entered, a second card shows "900 over the years · all
  players worldwide": a line chart of that rating's percentile in each year
  from `data/history/` (`HistoryTrend.svelte`). Hovering, tapping, or arrow
  keys pick a year, which stays picked until another is chosen (Home/End
  jump to the ends); a new rating resets it to the latest year. History is
  worldwide only; when a division or location is picked, the card says those
  filters don't apply. The history files load on the first valid rating.
- Shows which ratings update the data is from.
- Styles live in each component's `<style>` block, built on
  [Open Props](https://open-props.style) variables. Shared pieces (theme
  variables, the `.card` class) live in `web/src/app.css`. Dark mode follows the
  system setting.
- Every page shows the attribution line with a link to pdga.com.

## Layout

    fetcher/     Go module: API client, aggregation, JSON output
    web/         SvelteKit app
    data/        Current snapshot, its location files, and yearly history
    .github/     Workflow: fetch → build → deploy to Pages
    bruno/       Bruno collection for manual API exploration

## Data format

    data/
      current.json          latest monthly snapshot
      current/US-AL.json    one file per location in the snapshot
      history/2000.json     one file per calendar year

`data/current.json` holds the latest month's aggregates:

    {
      "generated_at": "2026-12-09",
      "ratings_update": "2026-12-08",
      "active_window_months": 12,
      "total_players": 84683,
      "players_fetched": 335133,
      "ratings": { "750": 312, "751": 298 },
      "divisions": {
        "MA1": { "total": 25292, "ratings": { "750": 41, "751": 38 } }
      },
      "locations": ["CA", "CA-ON", "US", "US-AL"]
    }

Each key in `locations` has a file in `data/current/`, e.g.
`data/current/US-AL.json`:

    {
      "location": "US-AL",
      "total_players": 412,
      "ratings": { "908": 3 },
      "divisions": { "MA1": { "total": 120, "ratings": { "908": 1 } } }
    }

`data/history/2026.json` holds one year:

    {
      "year": 2026,
      "generated_at": "2026-10-25",
      "total_players": 82131,
      "ratings": { "750": 290, "751": 301 }
    }

Files are compact JSON. `current.json` is about 110 KB (30 KB gzipped);
location files range from under 1 KB to about 95 KB (`US`); history files
total about 175 KB. `current.json` is written last, and each write replaces
`current/` so no stale locations remain. Years with no rated players (early
January) get no history file.

`total_players` is the active count; `players_fetched` is every `/players`
record, used only for the paging check.

Percentile = (players rated below you + half the players with your exact
rating) / total players.

## Fetcher rules

- Stop paging when the response has `status != 0` or an empty `players` array.
- Fail without publishing if `players_fetched` drops more than 500 below
  last month's. A `status: 1` partway through could be a real error, and
  because `/players` is ordered by PDGA number, a cut-off loses the newest
  members. Active totals aren't compared: memberships expiring on December 31
  make January's active count drop for real.
- Never log raw responses. They include `sessid`.
- Hold PDGA numbers in memory only, for matching. Discard them after
  aggregation.

## Data quirks

### `/players`

- One row per player, ordered by `pdga_number`.
- Default page size is 10; the maximum is 200.
- `status: 1` is returned when the offset is past the end.
- Some active players have a `rating` of exactly `"0"` (79 in October 2026;
  the next lowest was 7). These are treated as placeholders: excluded from
  the counts and logged separately.
- Expired members have `rating: null`, but their `rating_effective_date` can
  still change.
- `rating_effective_date` is when the rating last changed, not the latest
  ratings update date. Preliminary ratings for new members may carry dates
  that aren't second Tuesdays.
- `last_modified` doesn't track rating changes. PDGA bulk-updates it across
  nearly all records, and the `last_modified` filter means "on or after."
- Some rows omit `city`, `state_prov`, `country`, and `upcoming_events`
  entirely.
- `state_prov` uses numeric codes in some countries (e.g. `"22"` in Japan).

### `/player-statistics` (V2)

- Each row is one player, one year, one division. The `rating` is the same
  across all division rows in a year and reflects that year's rating.
- `last_modified` is when that row last changed. Old rows are sometimes
  updated years later.
- `class` is the player's current class, not their class that year.
- Use `division_code`, not `division_name`. Names change (e.g. "Open" became
  "Mixed Pro Open" while the code stayed `MPO`).
- Codes include non-standard ones like `RAH` ("Blue"), `FC3`, `FSV`, and
  `MSJV`.
- Rows are not ordered by `pdga_number`.
- The response key is `players`, as in `/players`.
- About 165,000 rows for 2025.

## Deployment

`.github/workflows/update.yml` has three jobs:

| Job | Runs on | Does |
|-----|---------|------|
| `fetch` | Schedule, manual dispatch | Runs the fetcher, pings Healthchecks, commits and pushes `data/` on exit `0` |
| `build` | Push to `main`, manual dispatch, schedule with new data | Tests, checks, and builds with `BASE_PATH=/pdga-tools` |
| `deploy` | After `build` | Publishes to GitHub Pages |

Build and deploy run in the same workflow as the fetch because pushes made
with the workflow's `GITHUB_TOKEN` don't trigger new workflow runs. Scheduled
runs that skip (exit `3`) don't redeploy.

Only `main` deploys. A manual run on another branch fetches, commits data to
that branch, and builds, but skips `deploy`; merging to `main` publishes it.
The fetch job's timeout is 120 minutes for a pull of about 80.

Pages must be set to deploy from GitHub Actions (Settings → Pages → Source).

## Configuration

Secrets for the Action: `PDGA_USERNAME`, `PDGA_PASSWORD`, `HC_DAILY_URL`,
`HC_MONTHLY_URL`.
Local runs read the same names from environment variables or `.env`
(ignored by git).

## Running locally

From the repo root, with `PDGA_USERNAME` and `PDGA_PASSWORD` in `.env`:

    go -C fetcher run . -data ../data -env ../.env

A full pull takes about 80 minutes and logs progress about once a minute.

| Flag | Default | Purpose |
|------|---------|---------|
| `-data` | `data` | Output directory, relative to the working directory |
| `-env` | `.env` | Credentials file; existing environment variables win |
| `-delay` | `1s` | Minimum time between API requests |
| `-progress` | `50` | Log progress every N pages (`0` = off) |
| `-dry-run` | `false` | Fetch and summarize without writing files |
| `-max-pages` | `0` | Stop after N pages per pass (`0` = all); implies `-dry-run` |
| `-backfill` | | Write history for a range like `2000-2024` instead of the monthly run; skips years already written |

Quick check that credentials and both endpoints work (about 11 requests,
writes nothing):

    go -C fetcher run . -data ../data -env ../.env -max-pages 3

Backfill history (only `/player-statistics`; leaves `current.json` alone).
2000–2026 took about 2 hours; rerunning skips years already written:

    go -C fetcher run . -data ../data -env ../.env -backfill 2000-2026

Run tests with `go -C fetcher test ./...`.

### Web

The site reads `data/` at build time (`web/src/lib/data.ts`), so rebuild
after each fetch to pick up a new month. Location and history files are
separate chunks, downloaded only when needed.

    pnpm -C web dev      # dev server
    pnpm -C web test     # Vitest
    pnpm -C web check    # svelte-check
    pnpm -C web build    # static build in web/build

Set `BASE_PATH` for a build served under a subpath, as on GitHub Pages:

    BASE_PATH=/pdga-tools pnpm -C web build

Requires Node 22+ and pnpm.

## License compliance

- Show the attribution line and a link to pdga.com on every page.
- Publish aggregate counts only. No names or PDGA numbers.
- Throttle requests. Normally one full pull a month, with at most one
  retry per day until the update is published.
- Delete the data within 24 hours if PDGA asks.

## Roadmap (V2)

- **Class percentiles:** `classification` (A or P) comes from `/players`,
  so it could be added like locations with no extra API calls.
- **History by division or location:** the trend is worldwide only. Per-year
  division and location counts would need country and division per row
  (available in `/player-statistics`) and a rerun of the backfill.
- **Profile lookup and tournament search:** these need live API calls, so
  they go through a Cloudflare Worker. The Worker is a separate on-demand
  deployment (similar to AWS Lambda) that holds the PDGA credentials as
  secrets and allows CORS only from the Pages domain. The static site
  calls the Worker, never the PDGA API directly.
- **Rating calculator:** estimate a player's rating after the next update.
  Players manually add new rounds that aren't in their rating yet, and the
  calculator applies PDGA's published method: rounds from the 12 months
  before the most recent round (looking back up to 24 months if there are
  fewer than 8), double weight on the most recent 25% once there are 9 or
  more rounds, and dropping low outliers. Supports leagues with extra rules
  for when their rounds count. Needs a source for existing round history
  (not in `/players` or `/player-statistics`), and testing against real
  updates to match PDGA's results.
- **Head-to-head comparison:** enter two PDGA numbers and see every event
  both played, with their head-to-head record. Open questions: what counts as
  "against each other" (same division, or the same layout/round regardless
  of division), and which endpoint provides per-player event results. Needs
  live API calls, so it goes through the Cloudflare Worker like profile
  lookup. Needs research.
