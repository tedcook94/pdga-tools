# Store listing

Paste these into the Chrome Web Store and Firefox Add-ons dashboards when they
change; the upload APIs can't update listings. Text inside the code blocks is
plain text, so it pastes the same into both stores.

## Summary

Firefox "Summary" (250 characters max). Chrome uses the manifest
`description` in `wxt.config.ts` (132 characters max), which matches.

```
See your next PDGA ratings before they're published, from events you import or add, right on your ratings detail page.
```

## Description

Chrome "Description", Firefox "Description".

```
Rating Projector shows what your PDGA rating will be at each upcoming ratings update, right on your pdga.com Ratings Detail page.

IMPORT YOUR EVENTS
• Paste an event ID, event page link or PDGA Live link into the panel to import your rated rounds.
• Or click the icon next to any player on a pdga.com event results page.
• Refresh an event as more league weeks are rated. Importing it again replaces the old copy.

SEE EVERY UPCOMING UPDATE
• The projected rating and change for each update.
• Which rounds get added, dropped as outliers, counted twice or aged out.
• League rounds count in the update after the league ends, as PDGA reports them.
• Events already in your published rating are greyed out, with one click to clear them.

ADD ROUNDS BY HAND
• Add tournaments and leagues yourself, then add, renumber or delete rounds as you play.

HOW TO USE IT
1. On pdga.com, open your player page and choose Ratings Detail.
2. Import the events you've played since the last update, or add them by hand.

Projections follow PDGA's published ratings method and can be off by a point or so.

PRIVACY
Your events are saved in your browser's own storage and synced only through your browser account. Nothing is sent anywhere else. The extension reads pdga.com pages you open, and loads one event page from pdga.com when you click Import or Refresh.

Rating Projector is not affiliated with or endorsed by the PDGA.
```

## Chrome privacy practices

**Single purpose:**

```
Projects a player's upcoming PDGA rating updates on their pdga.com Ratings Detail page, from events they import or enter.
```

**`storage` justification:**

```
Saves the events and rounds the user imports or enters, so projections persist across visits and sync across the user's browsers.
```

**Host permission justification** (content scripts on `www.pdga.com`):

```
Reads the open pdga.com Ratings Detail page to show the projection panel, and the open event results page to add an import button to each player row. When the user clicks Import or Refresh, it loads that one pdga.com event page to read their rounds.
```

**Remote code:** No.

**Data usage:** no data collected. Check the three certifications (not sold,
not used for unrelated purposes, not used for creditworthiness).

## Firefox

- **Data collection:** none, declared in the manifest
  (`data_collection_permissions`).
- **Notes for reviewers:** build steps are in the source zip's `README.md`
  under Releasing.

## Screenshots

`screenshot-1-expanded.png`, `screenshot-2-collapsed.png`,
`screenshot-3-event-page.png`, in that order. Chrome also uses
`promo-tile-440x280.png`. The captions are in the images; for Firefox's
caption fields, reuse them:

1. Calculate future ratings before they're published
2. Integrated into your Ratings Detail page
3. Import or refresh rounds from any event page in one click
