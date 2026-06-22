# Varde

**An autonomy planner for trail running and mountain hikes.** Drop in a GPX track and Varde turns it into a self-sufficiency plan: every water point, refuel and refuge mapped between segments — with the climb, the timing and the litres to carry already worked out.

The app has two surfaces:

| Route | What it is |
| --- | --- |
| `/` | Marketing **landing page** (bilingual FR/EN). |
| `/app` | The **planning tool**. |

---

## Features

### The planner (`/app`)

- **GPX import** — drop a `.gpx` file; Varde parses the track geometry and elevation in seconds.
- **Topographic map** — MapLibre GL rendering MapTiler's *Landscape* basemap with 3D terrain relief (real elevation, so summits read true to life), styled in a calm "papier" cartographic palette.
- **Elevation profile** — synced to the map and the plan; hover to read distance and altitude, with water points sitting exactly where you'll meet them.
- **Autonomy plan** — the route is split at each water point into segments, each with its distance, elevation gain/loss (D+ / D−), an estimated arrival time (climb-adjusted pace) and the water to carry (litres). The longest dry stretch is flagged.
- **Water points from OpenStreetMap** — fountains, taps, springs and other sources near the route are fetched live via the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) and projected onto your track. Less-reliable sources (e.g. springs) are marked "to verify". Add your own POIs (water / refuel / refuge) on top.
- **Two slope overlays** —
  - *Calque pente*: colours the route line by gradient (separate ramps for climbs and descents).
  - *Pente du terrain*: shades the **ground** steepness from the elevation model across an adjustable grade-% window (grade % = rise ÷ run × 100, so 100 % = 45°).
- **Geolocation** — centre the map on your current position.

### The landing (`/`)

- Faithful marketing page (hero, features, how-it-works, use cases) with the topo map and elevation profile rendered as lightweight, deterministic SVG.
- **Bilingual (FR / EN)** with an in-nav language switcher; French is the default.
- "Launch app" calls-to-action route through to `/app`.

---

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + [React 19](https://react.dev)
- TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com) (CSS-based config) + design tokens in `app/globals.css`
- [shadcn/ui](https://ui.shadcn.com) primitives (`base-nova` style) on top of `@base-ui/react`
- [MapLibre GL](https://maplibre.org) with MapTiler tiles
- Cookie-based internationalization (no extra dependency)

---

## Getting started

### Prerequisites

- **Node 18+ — the project is built and tested on Node 22.**
  > ⚠️ If your shell defaults to an older Node (e.g. v14), `next dev` crashes with `SyntaxError: Unexpected token '??='`. Run `nvm use 22` (or your equivalent) first.

### Install & run

```bash
nvm use 22          # if needed — see the prerequisite above
npm install
npm run dev
```

Then open **[http://localhost:3001](http://localhost:3001)** — the landing page is at `/`, the planner at `/app`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) on port **3001**. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build on port 3001. |
| `npm run lint` | Run ESLint (`eslint-config-next`). |

There is no test runner configured.

---

## Configuration

The app runs **out of the box** — the planner ships with a bundled MapTiler key, and water points come from the public Overpass API (no key needed).

For your own deployment, point the map at your own MapTiler style via `.env.local`:

```bash
# .env.local
NEXT_PUBLIC_MAPTILER_STYLE_URL=https://api.maptiler.com/maps/landscape-v4/style.json?key=YOUR_KEY
```

The terrain-relief and slope overlays reuse the `?key=` from this style URL. Note the bundled key ships in the client bundle, so a real deployment should use its own MapTiler key (and ideally proxy it).

---

## Project structure

```
app/
  layout.tsx          Root layout — fonts, <html lang> (from the locale cookie)
  page.tsx            Landing page  (/)
  app/
    layout.tsx        Planner metadata
    page.tsx          The planning tool  (/app)
  globals.css         Tailwind + design tokens + all component CSS
components/
  ui/                 shadcn primitives
  varde/              Planner components (map, profile, autonomy panels, …)
  landing/            Landing-page components (nav, sections, mock visuals)
lib/
  varde/              Pure domain logic — GPX parsing, geometry, segments,
                      slope/terrain analysis, Overpass client
  i18n/               Locale config + dictionaries (fr / en)
```

## Internationalization

Locale is held in a `varde-locale` cookie (`fr` default, `en` available). The root layout reads it server-side to set `<html lang>` and load the matching dictionary from `lib/i18n/dictionaries/`; the nav switcher writes the cookie and refreshes. The planner UI itself is French.
