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
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` (configured in `postcss.config.mjs`). Global styles and theme tokens (light/dark CSS variables, `@theme inline`) live in `app/globals.css`. No `tailwind.config.*` — v4 uses CSS-based configuration.
- **UI components**: [shadcn/ui](https://ui.shadcn.com) (`base-nova` style, `neutral` base color, CSS variables, Lucide icons, RSC-enabled). Config in `components.json`. Components live in `components/ui/`; the `cn()` helper is in `lib/utils.ts`. Add new components with `npx shadcn@latest add <name>` — do not hand-roll primitives that shadcn already provides. Built on `@base-ui/react` + `class-variance-authority`; merge classes with `cn()`.
- **TypeScript**: strict mode on. Path alias `@/*` maps to the project root (configured in `tsconfig.json`). Shadcn aliases: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.
- **ESLint**: flat config in `eslint.config.mjs` extending `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

## Node version

Requires **Node 18+** (shadcn CLI and Next.js 16). If `node --version` shows v14/v16, run `nvm use 22` before `npm install`, `npm run dev`, or `npx shadcn@latest add ...`.
