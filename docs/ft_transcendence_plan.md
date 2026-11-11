# ft_transcendence – Project Plan

<!-- Owner: Shared, coordinated by whoever holds the Tech Lead role -->
<!-- Responsible for: the team's full project plan (modules, architecture, tech stack, DB schema, track assignments, file structure). -->

> **Stack pivot note (2026-08-26):** the backend moved from **Go** to **Node.js +
> TypeScript** (Fastify, Prisma, Socket.IO). This is a tech-stack pivot only — product
> scope, module selection/scoring, database semantics, timeline, and track ownership
> intent are unchanged. Sections 4, 7, 8, and 10 below were updated for the new stack;
> everything else is preserved as originally planned.

## 0. Project summary

An all-in-one developer collaboration workspace that merges a Kanban board (Trello-style), an infinite whiteboard (Excalidraw-style), a shared notes space (Notion-style page), and deep Git integration. Each project is a shared workspace for a team: a Kanban board for tasks, a whiteboard for sketching/diagramming, a notes page for written documentation, and cards that can be linked to a real Git branch so their status updates automatically as that branch moves through its PR lifecycle (PR opened → "PR pending", merged to main → "Done").

Team: 5 people. Deadline: end of September (project start Aug 24).

## 1. General requirements (mandatory, not module points)

These are pass/fail requirements. Missing or badly implementing any of them can cause outright project rejection regardless of how many module points are earned.

- The project must be a web application with a frontend, a backend, and a database.
- Git must be used with clear, meaningful commit messages. The repository must show commits from all team members, clear descriptions of changes, and proper work distribution across the team — this is checked directly, not assumed from the README.
- Deployment must use a containerization solution (Docker) and run with a single command.
- The site must work on the latest stable Google Chrome, with no errors or warnings in the browser console.
- The project must include accessible, non-placeholder Privacy Policy and Terms of Service pages, reachable from the application (e.g. footer links).
- **Multi-user support is mandatory, not optional or module-gated**: multiple users logged in and active simultaneously, concurrent actions handled correctly, real-time updates reflected across connected users where applicable, and no data corruption or race conditions from simultaneous actions.
- **Basic user management with secure sign-up and login is mandatory and must exist regardless of which modules are chosen.** At minimum: email and password authentication, with passwords properly hashed and salted before storage. This is separate from and required in addition to any authentication modules (OAuth, 2FA) chosen for extra points — those are additive, not substitutes for this baseline.
- A frontend that is clear, responsive, and accessible across devices, using a CSS framework or styling solution of the team's choice.
- Credentials (API keys, environment variables) must live in a local `.env` file that is git-ignored, with a committed `.env.example` template.
- The database must have a clear, well-defined schema with explicit relations.
- All forms and user inputs must be validated on both the frontend and the backend.
- Any connection touching a browser, a script, or an external API must use HTTPS. Internal container-to-container connections (e.g. backend to database) do not require encryption.

## 2. Point target: 14 minimum, 17 planned

**Major modules (2 points each) — 6 modules, 12 points**

| Module | What it means for this project |
|---|---|
| Use a framework for both frontend and backend | Node.js/TypeScript backend framework (Fastify) + a frontend framework/library (TypeScript-based, e.g. Svelte) |
| Real-time features (WebSockets) | Kanban card create/edit/move/delete broadcasts live to every connected client in a project |
| Organization system | Create/edit/delete projects (workspaces), add/remove members, view and act within a project |
| Advanced permissions | Role-based access (e.g. admin/member/viewer), user CRUD, different views/actions per role |
| Public API | Our REST endpoints exposed with a secured API key, rate limiting, documentation, and at least 5 endpoints (GET/POST/PUT/DELETE) |
| Modules of choice (custom, Major): Git/webhook integration | Branch linking, webhook receiver, automated card status sync driven by PR lifecycle events — requires a written README justification for why this merits Major status |

**Minor modules (1 point each) — 5 modules, 5 points**

| Module | What it means for this project |
|---|---|
| File upload | Attachments on cards and notes, including exported whiteboard images |
| Notification system | Fires on creation, update, and deletion actions across cards, notes, and files |
| Advanced search | Search across cards, notes, and attachments within a project |
| ORM | Backend data access goes through an ORM (Prisma, in the Node.js/TypeScript backend) rather than raw SQL |
| OAuth 2.0 | GitHub login, layered on top of the mandatory email/password baseline, and also needed as the credential source for the Git integration module |

**Total: 17 points**, 3 points above the 14 minimum — a real margin if any single module doesn't fully pass evaluation.

### Stretch goal, not part of the 17-point core

If time remains after the core plan above is fully working, the team may attempt real-time collaborative editing on the whiteboard using Excalidraw's own official real-time collaboration binding (built on Yjs), rather than writing CRDT logic from scratch. If achieved and demonstrable, this would additionally satisfy the Minor "Real-time collaborative features" module (+1 point, 18 total), since it would be a genuinely distinct live-editing feature separate from Kanban's real-time sync. This is optional upside only — the 17-point plan does not depend on it, and it should only be attempted once everything else below is done.

## 3. Core architecture

### 3.1 Kanban (real-time)

Boards, lists, and cards. Every mutation (create, edit, move, delete) is written to the database and then broadcast over WebSocket (Socket.IO) to everyone currently viewing that project, so their screen updates without a page refresh. This broadcast is silent state sync, not a user-facing notification. Presence (who's currently online) is tracked the same way: broadcast a "joined"/"left" event on connect/disconnect.

### 3.2 Whiteboard (save-and-share in the core plan; live collaboration was added later)

> **Status:** the live editing described as a stretch goal was built: strokes are relayed over Socket.IO and merged on the server (`whiteboard.realtime.ts`, `whiteboard.elements.ts`). The text below is the original plan.

Built on the open-source Excalidraw component. One user draws at a time; there is no live syncing of strokes as they're drawn in the core plan. The scene is stored as Excalidraw's own JSON in the database (one `whiteboards` row per project) and autosaved on a debounce timer once the user stops drawing, so the board stays re-editable for whoever opens it next — the same load-latest / autosave / last-save-wins shape as the notes page below. No WebSocket involvement and no conflict handling. Exporting the board to an image is available through Excalidraw's own menu, as a client-side download; it does not go through the File upload module.

### 3.3 Shared notes (save-and-share, not live in the core plan)

> **Status:** notes are edited live with Yjs and Tiptap (`notes.collab.ts`), which this plan had put out of scope. The text below is the original plan.

A Notion-style rich text page per project, built with a rich text editor library. Content is stored as structured data (JSON) in the database. Whoever opens a note loads the latest saved version; edits autosave periodically (e.g. on a debounce timer after typing stops), which is a normal HTTP request, not a live socket connection. If two people edit the same note around the same time, the most recent save wins. True simultaneous co-editing (multiple cursors typing in the same paragraph at once) is intentionally out of scope for the same reason as the whiteboard's core scope — it needs the same class of conflict-resolution machinery (CRDT/OT) applied to a harder problem.

### 3.4 Git integration

Links Kanban cards to Git branches; listens to GitHub webhooks and automatically moves a card's status based on PR lifecycle events. This is the project's signature, differentiating feature, claimed as a custom Major "Modules of choice" module.

## 4. Tech stack

- **Backend: Node.js + TypeScript**, built on **Fastify**. Key libraries: **Socket.IO** for the Kanban WebSocket hub, **jsonwebtoken** (or `jose`) for auth tokens, **Octokit** for GitHub API calls, **Prisma** for database access (covers the ORM module), and **`@fastify/rate-limit`** as the standardized rate-limiting strategy for all routes (global default plus per-route overrides, e.g. the invite join endpoint — see `docs/architecture.md` "Rate limiting strategy"). This replaces the project's original Go-based plan (`gorilla/websocket`, `golang-jwt`, `go-github`, `chi`, GORM) — chosen instead for a TypeScript-first stack shared end-to-end with the frontend, and for Prisma's typed schema/migration workflow. All backend REST routes are mounted under the canonical `/api` base path (not `/api/v1`) — see `docs/api-spec.md`.
- **Frontend: Svelte 5 with TypeScript, built by Vite as a multi-page app** (decided: the kanban's drag-and-drop, live updates and per-role read-only mode are not manageable in plain DOM code). No React as the app's primary framework. See `docs/tech-stack.md`.
- **Whiteboard: the `@excalidraw/excalidraw` package**, mounted as a small isolated React tree just on the whiteboard page/route, since Excalidraw ships as a React component.
- **Notes: Tiptap** (framework-agnostic, integrates with Svelte without a React mount point), edited live with Yjs (see section 3.3: the live editing that was first out of scope was built).
- **Real-time sync: Socket.IO, no CRDT or operational transform, used by Kanban.** Every card mutation is broadcast immediately after being saved to the database.
- **Database: PostgreSQL**, accessed through **Prisma**.
- **Auth: email/password with hashed and salted passwords as the mandatory baseline, plus JWT for session tokens, plus OAuth2 (GitHub) as an additional login method** — OAuth doubles as the credential source for Git integration.
- **CSS: a custom design system** (CSS variables, light and dark themes, shared Svelte components in `frontend/src/shared/ui/`), applied consistently across Kanban, whiteboard, and notes pages.
- **Infra: Docker Compose**, with containers for the frontend build, the Node.js backend (which also hosts the Socket.IO WebSocket hub on the same HTTP server), PostgreSQL, and a reverse proxy (e.g. Nginx) handling HTTPS termination for all browser-facing traffic.

## 5. Database schema outline

Column-level semantics are technology-agnostic and unchanged by the backend pivot; the
schema's implementation source of truth is now `backend/prisma/schema.prisma` (Prisma
models), described in full in `docs/db-schema.md`.

- `users` (id, email, password_hash, password_salt, name, avatar, oauth_provider, oauth_id)
- `organizations` / `projects` (id, name, owner_id)
- `project_members` (project_id, user_id, role) — backbone of the permissions module; sole source of truth for authorization, regardless of whether a member was added directly or via an invite link
- `project_invites` (id, project_id, token_hash, role, max_uses, use_count, expires_at, created_by, created_at, revoked_by, revoked_at) — invite-link join flow feeding `project_members`; see `docs/db-schema.md`
- `boards`, `lists`, `cards` (id, title, list_id, linked_branch, linked_pr_url, status)
- `notes` (id, project_id, content_json, updated_by, updated_at) — autosaved on edit
- `attachments` (id, project_id, card_id, file_url, file_type, uploaded_by, uploaded_at) — covers regular file uploads and exported whiteboard images alike
- `git_links` (card_id, repo_url, branch_name, pr_status)
- `notifications` (user_id, type, payload, read_at) — fires on creation/update/deletion actions
- `webhook_events` (provider, repo, event_type, payload, processed_at) — audit log of every Git webhook received
- `api_keys` (id, project_id or user_id, key_hash, rate_limit, created_at) — supports the Public API module

## 6. Git integration design

1. A user links a card to a branch. The backend either creates a new branch via the GitHub API or lets the user pick an existing one.
2. A webhook is registered on the linked repository for push, pull_request, and merge events.
3. On webhook receipt: opening a PR moves the linked card to a "PR pending" column and fires a notification; merging to main moves the card to "Done" and fires a notification.
4. Every webhook event is logged to `webhook_events`, so the automation chain is auditable if something doesn't trigger correctly.

## 7. File structure

```
ft_transcendence/
├── docker-compose.yml
├── .env.example
├── README.md
├── TODO.md
├── docs/
│   ├── ft_transcendence_plan.md
│   ├── architecture.md
│   ├── db-schema.md
│   ├── api-spec.md
│   └── github-workflow.md
├── frontend/
│   ├── src/
│   │   ├── kanban/            # boards, lists, cards, drag-and-drop, Socket.IO client
│   │   ├── whiteboard/        # isolated React mount for Excalidraw
│   │   ├── notes/             # Tiptap editor integration
│   │   ├── auth/              # login, signup, OAuth flow UI
│   │   ├── shared/             # design tokens, shared components, CSS setup
│   │   ├── legal/               # Privacy Policy, Terms of Service pages
│   │   └── api/                  # frontend API client, Socket.IO client wrapper
│   ├── public/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── server.ts               # process entrypoint (listen, Socket.IO attach)
│   │   ├── app.ts                  # Fastify app + route registration
│   │   ├── config/                  # env loading/validation
│   │   ├── db/prisma/               # Prisma client singleton
│   │   ├── modules/
│   │   │   ├── auth/                  # email/password, JWT, OAuth2 handlers
│   │   │   ├── permissions/           # roles, middleware, user CRUD
│   │   │   ├── projects/              # organization system, incl. invite-link joins (invites.ts)
│   │   │   ├── kanban/                # boards/lists/cards CRUD + Socket.IO hub
│   │   │   ├── notes/                 # notes CRUD, autosave endpoint
│   │   │   ├── whiteboard/            # one Excalidraw scene per project, load + autosave
│   │   │   ├── attachments/           # file upload handling
│   │   │   ├── search/                # advanced search
│   │   │   ├── notifications/         # notification triggers and delivery
│   │   │   ├── git/                    # GitHub (Octokit) API calls, webhook receiver
│   │   │   └── publicapi/              # API key auth, rate limiting, documented endpoints
│   │   └── (no separate db/models — Prisma schema is the model source of truth)
│   ├── prisma/
│   │   └── schema.prisma            # Prisma schema (models, source of truth for DB)
│   ├── package.json
│   └── tsconfig.json
└── infra/
    ├── nginx/                     # reverse proxy + HTTPS config
    └── migrations/                # hand-maintained SQL baseline scaffold, superseded by Prisma-generated migrations once `prisma migrate dev` has run
```

## 8. GitHub management plan

See `docs/github-workflow.md` for the full path-ownership table and working
conventions (branch naming, PR review rules, commit message expectations). In brief:
each top-level backend module folder (`backend/src/modules/<domain>/`) has a primary
track owner matching the track split in section 10 below, so pull requests route to
the right reviewer and merge conflicts stay rare. Paths shared across everyone
(`backend/src/modules/auth/`, `permissions/`, `db/`, `prisma/`, `infra/`,
`docker-compose.yml`, `.env.example`) need a second reviewer before merge.

## 9. Team roles (process, separate from build tracks)

The subject requires these roles to be assigned and documented in the README, distinct from which product area each person builds:

- **Product Owner (PO):** defines product vision, prioritizes features, maintains the backlog, validates completed work
- **Project Manager (PM) / Scrum Master:** organizes meetings and planning, tracks progress and deadlines, manages risks and blockers
- **Technical Lead / Architect:** owns technical architecture and stack decisions, ensures code quality, reviews critical changes, merges shared docs
- **Developers (all 5 members):** implement their track's features, participate in code review, test their own work, document what they build

With 5 people, these can be specialized as dedicated PO, PM, Tech Lead, and 2 Developers, rather than combined as they would need to be with a 4-person team. One person can still hold a role alongside being a track owner — role and track ownership are two different axes, not competing assignments.

## 10. Suggested 5-person track split

### Track 1 — Foundation, Auth, and API infrastructure (1 person)

- Docker Compose setup, DB schema/migrations (Prisma), hot-reload dev setup (`tsx watch`)
- Mandatory baseline auth: email/password sign-up and login, with hashed and salted password storage
- JWT-based session handling (`jsonwebtoken`/`jose`)
- OAuth2 login flow (GitHub), layered on top of the email/password baseline — covers the OAuth minor module and later feeds Track 3's Octokit API calls
- Advanced permissions: role definitions, user CRUD, Fastify preHandler hooks enforcing role-based access
- ORM setup (Prisma) used consistently across the backend — covers the ORM minor module
- Public API hardening: API key issuance, rate limiting, documentation for the 5+ required endpoints — covers the Public API major module, in coordination with whichever track owns the underlying endpoints
- HTTPS/TLS termination via a reverse proxy in the Docker Compose setup
- `.env` / `.env.example` setup
- Delivers a minimal but real API early so other tracks aren't blocked

This track should be front-loaded hard in week 1, since every other track depends on working auth and a permissions model.

### Track 2 — Kanban core & real-time sync (2 people)

**Person A — Kanban CRUD and UI:**
- Data model and CRUD for boards, lists, and cards
- Drag-and-drop UI for moving and reordering cards
- Card detail view: title, description, assignee, linked branch field (populated by Track 3), attachments and notes references
- Frontend and backend input validation on all card/board forms
- Coordinates with Track 1 on permission checks

**Person B — WebSocket layer:**
- Socket.IO server on the backend: per-project rooms (`socket.join(projectId)`) replace a hand-rolled connection map
- Broadcast a message to every other client in a project's room on any card mutation, after it's saved to Postgres — covers the Major "real-time features" module
- Frontend message handler (using `socket.io-client`) updating the DOM to match incoming broadcasts
- Presence: broadcast join/leave events, render presence indicators
- Reconnection handling: re-fetch current state on reconnect rather than assuming the socket resumed cleanly
- Responsible, together with Person A, for correct behavior under concurrent multi-user actions — no race conditions or data corruption when multiple users act on the same board at once, per the general multi-user requirement

### Track 3 — Git integration (1 person)

- GitHub API calls via **Octokit** to create or link a branch to a card, using the OAuth token from Track 1
- Webhook receiver endpoint (Fastify route) for push, pull_request, and merge events
- Event processing: match incoming payloads to the correct card via `git_links`, drive status transitions (PR pending → Done)
- Triggers the actual card move (via Track 2's service functions) and a notification once an event is processed
- `webhook_events` audit logging for every event received
- Writes the README justification required for claiming this as a custom Major "Modules of choice" module: why it was chosen, what technical challenges it addresses, how it adds value, and why it merits Major status

### Track 4 — Whiteboard, notes, and supporting modules (1 person)

- Whiteboard: mount `@excalidraw/excalidraw` on its own page, store the scene as JSON with load-latest and autosave-on-change (last-save-wins); image export is Excalidraw's own client-side download
- Notes: integrate Tiptap, store content as JSON, implement load-latest and autosave-on-edit with last-save-wins as the resolution behavior
- File upload system (covers the File upload minor module)
- Advanced search across cards, notes, and attachments (covers the Advanced search minor module)
- Notification system, scoped to fire on creation, update, and deletion of cards, notes, and files (covers the Notification minor module)
- CSS framework selection and shared component library used consistently across Kanban, whiteboard, and notes pages *(implemented by Jax in the October frontend redesign: `frontend/src/shared/theme.css`, `theme.svelte.ts` and `shared/ui/`; listed here because the module was planned under Track 4)*
- Privacy Policy and Terms of Service pages, with real content and footer links
- Verifies Chrome compatibility and a clean browser console across the app

## 11. Timeline (Aug 24 – Sep 30)

**Week 1 (Aug 24–30) — Foundation**
Track 1 delivers DB schema (Prisma), mandatory email/password auth, and a minimal working API. Tracks 2–4 scaffold their own pieces against mocked data in parallel.

**Week 2 (Aug 31–Sep 6) — Core build-out**
Track 2 (Person A): Kanban CRUD and drag-and-drop working. Track 2 (Person B): Socket.IO hub scaffolded and tested before wiring to real card events. Track 3: GitHub OAuth working end-to-end, first webhook endpoint receiving real events. Track 4: whiteboard embed and notes editor working as independent pieces, plus the shared component library and CSS framework decision made early so Track 2's UI doesn't diverge visually.

**Week 3 (Sep 7–13) — Real-time layer and integration**
Track 2 finishes wiring the Socket.IO broadcast to real card mutations, plus presence and reconnection handling. Track 3 finishes the webhook → card status automation end-to-end, including the notification trigger. Track 1 finishes Public API hardening (keys, rate limiting, docs). Track 4 finishes file upload and starts advanced search.

**Week 4 (Sep 14–20) — Supporting modules and full integration**
Track 4 finishes search and the notification layer, plus Privacy Policy/Terms of Service pages. The whole team does an integration pass: does dragging a card sync live to another browser window, does merging a PR move the card and notify the right person, does the whiteboard export attach correctly, do notes autosave reliably, does the app run clean-console on Chrome. This week should end with an honest checkpoint — are all 11 mandatory-plus-planned modules genuinely working end-to-end.

**Week 5 (Sep 21–27) — Buffer, hardening, and optional CRDT stretch**
With 17 points already planned into the core (3 points above the 14 minimum), this week is for hardening rather than chasing additional bonus modules. If the 17-point core is fully solid with time to spare, the team may attempt the CRDT-based live whiteboard stretch goal using Excalidraw's official Yjs binding. If the core isn't fully solid, the whole team stays on core work instead.

**Sep 28–30 — Final buffer and README**
No new features. Full run-through from a clean `docker compose up`, HTTPS check, console-error check, bug fixes, and README writing: team roles, project management approach, technical stack with justification, database schema, full feature list mapped to owners, module list with point totals and implementation notes, and individual contribution breakdowns. Leaving these final days genuinely free for cleanup is worth more than squeezing in one more feature.
