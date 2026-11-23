# Web

SvelteKit site deployed to GitHub Pages at
<https://tedcook94.github.io/pdga-tools/>. It hosts the rating percentile tool
and the [Rating Projector](../extension/README.md) page, and reads the
[fetcher's](../fetcher/README.md) output in `data/` at build time.

## Routes

| Route | Page |
|-------|------|
| `/` | Home: list of tools |
| `/percentile` | Rating percentile |
| `/rating` | Rating Projector extension: features and store links |

Every page has a sticky header bar with a "PDGA Tools" wordmark that links
home (in `+layout.svelte`). Links use
`resolve()` from `$app/paths` so they work under the `/pdga-tools` base path.

## Percentile page

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

## Running locally

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
