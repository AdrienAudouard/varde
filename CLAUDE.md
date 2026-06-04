@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js version

This project uses **Next.js 16.2.7** with **React 19.2.4**. APIs, conventions, and file structure may differ from training data. Before writing any Next.js / React code, consult the bundled docs in `node_modules/next/dist/docs/` (notably `01-app/` for App Router) and heed deprecation notices. Do not rely on patterns memorized from older Next.js versions.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint (`eslint-config-next` core-web-vitals + typescript)

There is no test runner configured.

## Architecture

- **App Router only** — all routes live under `app/`. `app/layout.tsx` is the root layout (sets up Geist fonts via `next/font/google` and the html/body shell); `app/page.tsx` is the home route.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` (configured in `postcss.config.mjs`). Global styles in `app/globals.css`. No `tailwind.config.*` — v4 uses CSS-based configuration.
- **TypeScript**: strict mode on. Path alias `@/*` maps to the project root (configured in `tsconfig.json`).
- **ESLint**: flat config in `eslint.config.mjs` extending `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
