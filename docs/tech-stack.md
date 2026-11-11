<!-- Owner: Shared, coordinated by the Tech Lead -->
<!-- Responsible for: the technical stack as it really is, with the justification the subject asks for in the README (Technical Stack and Modules sections). -->

# Technical stack

Versions are the ones resolved in `backend/package-lock.json` and `frontend/package-lock.json`.

## Modules covered by the stack

| Module | Points | Evidence |
|---|---|---|
| Use a framework for both frontend and backend (Web, Major) | 2 | Fastify 5 on the backend, Svelte 5 on the frontend (both listed in the subject) |
| Use an ORM for the database (Web, Minor) | 1 | Prisma 5, no raw SQL left (see `docs/db-schema.md`) |

The subject also has the Minor modules "frontend framework" and "backend framework" separately. They are **not**
claimed on top of the Major one: the Major module already covers both.

## Backend

| Choice | Version | Role |
|---|---|---|
| Node.js | 22 (`engines`, Docker image) | Runtime |
| TypeScript | 5.9, `strict` | One language end to end |
| **Fastify** | 5.12 | The backend framework |
| `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/multipart`, `fastify-raw-body` | 13 / 11 / 11 / 10 / 6 | Security headers, CORS, rate limiting, file upload, raw body for the webhook HMAC |
| **Socket.IO** | 4.8 | WebSocket hub: kanban events, presence, notifications, live whiteboard and notes |
| **Prisma** (+ Prisma Client) | 5.22 | ORM, schema and migrations |
| PostgreSQL | 16 (Docker image) | Database |
| `jsonwebtoken` | 9 | Session tokens (JWT); passwords are salted and hashed (`password.service.ts`) |
| Octokit | 5 | GitHub API (branches, repository webhook) |
| Yjs + Tiptap (`@tiptap/*`) | 13.6 / 3.x | Server side of the live notes (merge of concurrent edits) |
| ESLint 10 (flat config), Prettier | | `npm run lint` is clean |

**Why Fastify.** It is a framework in the sense of the subject, not a bare HTTP library:
- *structure and conventions*: everything is a plugin registered with a prefix (`app.register(registerXRoutes, { prefix })`
  in `app.ts`, one module per folder under `backend/src/modules/`), with an encapsulated context per plugin;
- *built-in features*: routing with parameters and custom constraints (the same `GET /api/projects` path is served by two
  handlers depending on the `X-API-Key` header), a request lifecycle with hooks and `preHandler` chains (`requireAuth`,
  `requireRole`, `requireProjectRole`, API key and rate limit), JSON-schema validation of requests (`kanban.schemas.ts`),
  decorators, structured logging (pino);
- *ecosystem*: the official `@fastify/*` plugins above instead of hand-written middleware.

We picked it over Express for the TypeScript typing of requests and replies, the schema validation built in, and
the plugin encapsulation; over NestJS because the project does not need dependency injection and decorators on
top of that. The WebSocket hub shares the same HTTP server (`server.ts`), so one container and one port serve both.

## Frontend

| Choice | Version | Role |
|---|---|---|
| **Svelte** | 5.57 (runes: `$state`, `$derived`, `$effect`) | The frontend framework |
| Vite | 8 (with `@sveltejs/vite-plugin-svelte`) | Dev server and build, multi-page mode |
| TypeScript | `strict` | |
| `socket.io-client` | 4.8 | Live connection (`api/wsClientWrapper.ts`) |
| Tiptap + Yjs (`y-protocols`) | 3.x / 13.6 | Notes editor with live collaboration |
| `@excalidraw/excalidraw` + React | 0.17 / 18.3 | Whiteboard (see below) |
| Plain CSS with design tokens | `frontend/src/shared/theme.css` | Styling: light and dark themes, shared components in `shared/ui/` |

**Why Svelte.** 59 components in `frontend/src`, 46 files using runes. State lives in reactive class stores
(`kanban/boardStore.svelte.ts` holds the board, members, tags, who is online, connection status and applies every
live event), components stay small and declarative, and the compiled output is light. A kanban board with drag and
drop, live updates from other users, optimistic actions with undo and a read-only mode per role would have been
hard to keep consistent with hand-written DOM code.

**How the app is organised.** It is a multi-page application: each screen is its own Vite entry (`index.html` +
`main.ts` mounting a Svelte root), and nginx maps the clean URLs to those pages (`docs/frontend-routing.md`).
There is no client-side router (the subject's example of a full-stack framework, SvelteKit, is not used): navigation
is a normal page load, which keeps each page small and makes deep links and the browser's back button trivial.

**React is only an island.** Excalidraw ships as a React component, so the whiteboard page mounts a small React tree
(`whiteboard/mountWhiteboard.tsx`) inside its Svelte page. React is pinned to 18 because Excalidraw 0.17 is not
compatible with React 19. No other page uses React.

**Styling.** The subject asks for a CSS framework *or a styling solution of our choice*: we wrote a small design
system instead of adding Tailwind or Bootstrap: CSS custom properties for colours, spacing and radii, automatic
dark mode, and reusable Svelte components (`shared/ui/`: header, avatar, popover, icons, dialogs, toasts...).

## Infrastructure

| Choice | Role |
|---|---|
| Docker Compose | One command (`docker compose up`) starts everything |
| nginx 1.27 | HTTPS termination, serves the built frontend, proxies `/api/` and `/socket.io/` to the backend, redirects http to https |
| PostgreSQL 16 | Data, with a volume; migrations run when the backend container starts (`prisma migrate deploy`) |
| `uploads_data` volume | Uploaded files |

Containers: `db`, `backend`, `frontend` (build step that exports the static files), `nginx`.

## Where the stack changed from the first plan

`docs/ft_transcendence_plan.md` was written before the stack was fixed. What was decided since:
- backend moved from Go to Node.js and TypeScript (2026-08-26);
- the frontend is Svelte (the plan left "vanilla TypeScript or Svelte" open);
- notes and whiteboard are edited live (Yjs for notes, a scene merge for the whiteboard), where the plan had them
  as save-and-share only;
- no CSS framework: a custom design system.
