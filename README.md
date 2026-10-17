# PDGA Tools

Small tools built on PDGA player data, deployed to GitHub Pages at
<https://tedcook94.github.io/pdga-tools/>. The first tool finds what percentile
your PDGA player rating falls in compared to active rated players.

> Player, event, and course data provided by [PDGA](https://www.pdga.com).

## Status

V1 in development. The PDGA approved bulk data use under the API License
Agreement.

## How it works

1. A GitHub Action runs the Go fetcher after the monthly ratings update
   (see [Schedule](#schedule)).
2. The fetcher logs in to the PDGA API, pages through `/players` with
   `limit=200` at about 1 request per second, and logs out.
3. It builds an in-memory map of `pdga_number` to player and keeps only
   active players (see below).
4. It outputs **aggregate counts only**: the number of players at each rating.
   No names or PDGA numbers are written to disk or published.
5. Each month's aggregates are saved as a new file in `data/`, building a
   history for trend views.
6. `data/` is copied into the static SvelteKit build on GitHub Pages. The
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

## Schedule

PDGA publishes ratings on the second Tuesday of each month
([schedule](https://www.pdga.com/faq/ratings/when-updated)).

- **Cron:** `0 17 * * *` runs every day at 17:00 UTC (noon EST, 1 PM EDT).
  The fetcher decides whether to pull, so skipped days make no API calls.
  Running daily also gives Healthchecks.io a steady signal.
- **Each run, the fetcher:**
  1. Skips if today is before this month's second Tuesday.
  2. Skips if this month's file already exists.
  3. Runs the full pull (about 25 minutes).
  4. Skips without writing if no player has a `rating_effective_date` on or
     after this month's second Tuesday. Ratings aren't out yet, so the next
     day's run retries.
  5. Fails without writing if the active total differs from last month's by
     more than about 10%.
- Output files are named after the ratings update month (e.g. `2026-10.json`),
  not the run date.

### Exit codes

| Code | Meaning |
|------|---------|
| `0`  | New month written |
| `3`  | Skipped (not time yet, file exists, or ratings not out) |
| other | Failure |

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
- Shows which ratings update the data is from.
- Styles live in each component's `<style>` block, built on
  [Open Props](https://open-props.style) variables. Shared pieces (theme
  variables, the `.card` class) live in `web/src/app.css`. Dark mode follows the
  system setting.
- Every page shows the attribution line with a link to pdga.com.

## Layout

    fetcher/     Go module: API client, aggregation, JSON output
    web/         SvelteKit app
    data/        Monthly aggregate files and index
    .github/     Workflow: fetch → build → deploy to Pages
    bruno/       Bruno collection for manual API exploration

## Data format

`data/index.json` lists the available months:

    { "months": ["2026-11", "2026-12"], "latest": "2026-12" }

`data/2026-12.json` holds one month of aggregates:

    {
      "generated_at": "2026-12-09",
      "ratings_update": "2026-12-08",
      "active_window_months": 12,
      "total_players": 123456,
      "ratings": { "750": 312, "751": 298 }
    }

Percentile = (players rated below you + half the players with your exact
rating) / total players.

## Fetcher rules

- Stop paging when the response has `status != 0` or an empty `players` array.
- Fail without publishing if the active total differs from last month's by
  more than about 10%. A `status: 1` partway through could be a real error.
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
- Codes include non-standard ones like `RAH` ("Blue").

## Configuration

Secrets for the Action: `PDGA_USERNAME`, `PDGA_PASSWORD`, `HC_DAILY_URL`,
`HC_MONTHLY_URL`.
Local runs read the same names from environment variables or `.env`
(ignored by git).

## Running locally

From the repo root, with `PDGA_USERNAME` and `PDGA_PASSWORD` in `.env`:

    go -C fetcher run . -data ../data -env ../.env

A full pull takes about 25 minutes and logs progress about once a minute.

| Flag | Default | Purpose |
|------|---------|---------|
| `-data` | `data` | Output directory, relative to the working directory |
| `-env` | `.env` | Credentials file; existing environment variables win |
| `-delay` | `1s` | Minimum time between API requests |
| `-progress` | `50` | Log progress every N pages (`0` = off) |
| `-dry-run` | `false` | Fetch and summarize without writing files |
| `-max-pages` | `0` | Stop after N pages (`0` = all); implies `-dry-run` |

Quick check that credentials and the API work (3 requests, writes nothing):

    go -C fetcher run . -data ../data -env ../.env -max-pages 3

Run tests with `go -C fetcher test ./...`.

### Web

The site reads `data/` at build time (`web/src/lib/data.ts`), so rebuild
after each fetch to pick up a new month.

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

- **Group percentiles:** location and class come from `/players`. Gender and
  division need a second pass over `/player-statistics` for the current and
  previous year, matched by PDGA number in memory.
- **Age groups:** based on each player's highest age-protected division,
  including junior divisions (e.g. MA65 means 65+, MJ15 means 15 or under).
  Age is tied to the year of that division, so add the years since.
  Needs exploration.
- **Trends over time:** how the percentile for a given rating changes
  (e.g. 900 was the 60th percentile in 2020 and the 70th now). Past years
  can be backfilled from `/player-statistics?year=...`.
- **Distribution curve:** next after deploy. Plain SVG under the result card
  on `/percentile`: a lightly smoothed curve of the monthly rating counts, the
  area left of your rating shaded with the accent gradient, and a marker line
  at your rating. Expect a skewed shape, not a true bell curve.
- **Visualizations:** rating histogram with your position marked.
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
