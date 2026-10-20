---
title: Commit graph
description: "How the #grafo section of /repos/:name draws the commit window as a pure-SVG lane graph: algorithm, windowing, colors, interactions and the fixed-window rule."
---
# Commit graph

`/repos/:name#grafo` renders the commit window collected into `graph-REPO.json` as a **pure-SVG lane graph** (no ECharts — the chart bundle does not grow). The lane algorithm lives in `src/graph/lanes.ts` (a pure module validated against the ground truth of `git log --all --graph --date-order`), the renderer in `src/components/CommitGraph.vue`, and the per-repo loader in `src/graphData.ts`. If docs and code disagree, the code wins.

## Fixed window — filters do not apply

The graph shows the last **N commits** of the repo (the `window` field of the JSON, labeled in the footer) in `git log --all --date-order` order, most recent first. It deliberately **ignores the period and bots filters** of the route: removing commits would break merge chains and disfigure the lanes (a third of a busy window can be merge commits). This is an *intentional fixed window* in the sense of the filter rules — every other panel on the page keeps following the filters, and the footer states the exception explicitly.

Merge commits are drawn as **hollow circles**: in the graph they are connectors of the drawing (they show how lanes join), while all metrics elsewhere keep excluding merges.

## What the section shows

- **Lanes** computed client-side (~10 ms for 1,000 commits): the first parent continues on the same lane; extra parents reuse a lane already waiting for that commit or allocate a new one on the right; lanes waiting for the same commit collapse into a junction curve (the way git draws it). A parent outside the window never keeps a "zombie" lane.
- **Vertical windowing**: the initial render covers ~40 rows (about one viewport — measured under the 100 ms budget on the production build) and **"show older"** (Mostrar mais antigos) grows the window by 300 rows per click, client-side. Lanes are computed once for the whole window, so growing does not reshuffle the drawing.
- **Clipped edges**: a commit whose parent falls outside the window ends in a **dashed edge with an arrow marker** ("continues") — the graph never draws toward a row that does not exist. The footer counts them.
- **Rows are links**: each row is wrapped in an anchor to the commit on GitHub (`repoUrls` from `stats.json` + `/commit/<full sha>`, new tab). Hovering shows a tooltip with the full subject, the canonical author, date/time (pt-BR), refs and the short hash.
- **Ref chips**: the chips above the graph list every ref (branches/tags) present in the window. Hovering a chip highlights the lane and the rows carrying that ref; clicking pins the highlight (click again to release).
- **Colors**: lane colors come from the chart palette reordered by hue distance in the dark theme (adjacent lanes ≥ 146° apart) and from 600-tone variants in the light theme (400-tones fail the WCAG 3:1 contrast floor on white; the 600-set measures ≥ 3.09:1). The same color follows a branch along its whole lane.

## Empty state

Without a `graph-REPO.json` for the repo, the section shows *"Sem grafo de commits para esse repo — rode `pnpm collect`"* and the rest of the page renders normally. The demo fixtures ship their own graphs: `pnpm demo` (`make-demo-data.ts`) emits `graph-demo-api.json`/`graph-demo-web.json` in the contract shape, with visible merge junctions, exactly one clipped edge per repo (a parent outside the window — the dashed "continua" edge) and ref chips on the tips of the demo branches and tags. The public demo renders the full section, not the empty state.

## Data contract (`graph-REPO.json`)

```jsonc
{
  "generatedAt": "…",
  "repo": "demo-api",
  "window": 1000,
  "commits": [
    {
      "hash": "<40-hex>",          // full sha — GitHub links use it
      "parents": ["<40-hex>", …],  // git order: first = first parent; [] = root
      "author": "…",               // canonical author (team mapping; fallback: raw git name)
      "date": "…",                 // author date, UTC ISO with milliseconds
      "subject": "…",              // raw %s — truncation is the UI's job
      "refs": "(HEAD -> main, tag: v1.0)" // raw %d or parsed array; empty = none
    }
  ]
}
```

Display order = the preserved output of `git log --all --date-order` (descending). Lanes are **not** stored in the JSON: the collector emits topology + metadata only, and the frontend computes the drawing — geometry/colors can iterate without recollecting.

## Related

- [Collectors](../architecture/collectors.md) — how the JSON files are produced.
- [Filter rules](./filters.md) — per-route filter scope and the intentional fixed windows.
