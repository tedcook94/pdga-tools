# PDGA Tools

Small tools built on PDGA player data.

> Player, event, and course data provided by [PDGA](https://www.pdga.com).

## Tools

| Tool | What it does | Details |
|------|--------------|---------|
| [Rating percentile](https://tedcook94.github.io/pdga-tools/percentile) | Shows what percentile a rating falls in among active rated players, by division, location and year | [web](web/README.md), [fetcher](fetcher/README.md) |
| [Rating Projector](https://tedcook94.github.io/pdga-tools/rating) | Browser extension that projects your next rating updates on your pdga.com ratings page, with events imported from pdga.com | [extension](extension/README.md) |

Rating Projector is on the
[Chrome Web Store](https://chromewebstore.google.com/detail/rating-projector-for-pdga/cjciholkdnnklckjmkmkfoepeolbclnm)
and [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/rating-projector-for-pdga/).

## Layout

| Directory | Contents |
|-----------|----------|
| [`fetcher/`](fetcher/README.md) | Go module: API client, aggregation, JSON output |
| [`data/`](fetcher/README.md#data-format) | Current snapshot, its location files, and yearly history |
| [`web/`](web/README.md) | SvelteKit site |
| [`extension/`](extension/README.md) | Rating Projector browser extension |
| `.github/` | Workflows: data fetch and site deploy, extension tests and releases |
| `bruno/` | Bruno collection for manual API exploration |

## Stack

| Part       | Choice                                          |
|------------|-------------------------------------------------|
| Fetcher    | Go (standard library)                           |
| Schedule   | GitHub Actions (daily cron + manual dispatch)   |
| Monitoring | Healthchecks.io                                 |
| Frontend   | SvelteKit + `adapter-static`, TypeScript        |
| Styling    | Component-scoped CSS + Open Props               |
| Extension  | WXT, Svelte 5, Manifest V3                      |
| Tests      | Go `testing` (fetcher), Vitest (web, extension) |
| Packages   | pnpm                                            |
| Hosting    | GitHub Pages                                    |

## Deployment

`.github/workflows/update.yml` has three jobs:

| Job | Runs on | Does |
|-----|---------|------|
| `fetch` | Schedule, manual dispatch | Runs the fetcher, pings Healthchecks, commits and pushes `data/` on exit `0` |
| `build` | Push to `main` that changes `web/` (not docs) or `data/`, manual dispatch, schedule with new data | Tests, checks, and builds with `BASE_PATH=/pdga-tools` |
| `deploy` | After `build` | Publishes to GitHub Pages |

Build and deploy run in the same workflow as the fetch because pushes made
with the workflow's `GITHUB_TOKEN` don't trigger new workflow runs. Scheduled
runs that skip ([exit `3`](fetcher/README.md#exit-codes)) don't redeploy.

Only `main` deploys. A manual run on another branch fetches, commits data to
that branch, and builds, but skips `deploy`; merging to `main` publishes it.
The fetch job's timeout is 120 minutes for a pull of about 80.

Pages must be set to deploy from GitHub Actions (Settings → Pages → Source).

The extension has its own workflow, `extension.yml`: it tests and zips the
extension on changes, and on an `extension-v*` tag also attaches the zips to a
GitHub release (see [Releasing](extension/README.md#releasing)).

## License compliance

- Show the attribution line and a link to pdga.com on every page.
- Publish aggregate counts only. No names or PDGA numbers.
- Throttle requests. Normally one full pull a month, with at most one
  retry per day until the update is published.
- Delete the data within 24 hours if PDGA asks.

## Roadmap

- **Class percentiles:** `classification` (A or P) comes from `/players`,
  so it could be added like locations with no extra API calls.
- **Head-to-head comparison:** enter two PDGA numbers and see every event
  both played, with their head-to-head record. Open questions: what counts as
  "against each other" (same division, or the same layout/round regardless
  of division), and which endpoint provides per-player event results. Needs
  live API calls, so it goes through a Cloudflare Worker. Needs research.
