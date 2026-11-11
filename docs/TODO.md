# ! Remnant of the task assignment document

# TODO — where to start, by track

Scaffolding only: every file below has an `Owner:` comment and a responsibility line at
the top, and every function is a signature-only stub with `TODO` comments describing
intended behavior. No logic has been implemented. Cross-check against
`docs/ft_transcendence_plan.md` (sections 8 and 10) and `docs/github-workflow.md` for
the reasoning behind each assignment.

**Stack pivot (2026-08-26):** the backend is now Node.js + TypeScript (Fastify, Prisma,
Socket.IO), not Go. Every path below reflects the new `backend/src/...` layout — the
former `backend/internal/*.go` skeleton has been removed.

**Invite-link membership + rate limiting (2026-08-27):** added the invite-link join flow
(`backend/src/modules/projects/invites.ts` — create/join/revoke, inserting into
`project_members` on join, never authorizing off the invite/token itself) and standardized on
**`@fastify/rate-limit`** as the one rate-limiting strategy for the whole app: a global default
registered in `app.ts`, plus a dedicated, stricter per-route policy for the invite join endpoint
(`INVITE_JOIN_RATE_LIMIT` in `invites.ts`). The `project_invites` table (Prisma schema +
`docs/db-schema.md`) now includes `revoked_by`/`revoked_at`. All backend routes, including the
new invite endpoints and `auth.routes.ts` (previously bare `/auth/*`, now `/api/auth/*`), are
normalized under the canonical `/api` base path. See `docs/architecture.md` for the full
request/invite/auth-flow writeup.

**Route-file gap fix (2026-08-30):** `app.ts` was already written assuming a `*.routes.ts` file
exists per module (it imports `registerProjectsRoutes`, `registerKanbanRoutes`,
`registerNotesRoutes`, `registerAttachmentsRoutes`, `registerSearchRoutes`,
`registerNotificationsRoutes`), matching the pattern already used by `auth.routes.ts`,
`webhook.routes.ts`, and `publicapi.routes.ts`. Those six route files were missing from this
document's per-track lists — this was a documentation gap, not an intentional omission. Each is
now added below, owned by whichever track already owns the underlying `*.service.ts` file it
wraps (route handlers stay thin: decode request → call the service → apply `requireAuth`/
`requireRole` as `preHandler`). `kanban.routes.ts` also calls into Track 2 Person B's
`broadcast.ts` after mutations, so it's a light coordination point between the two Track 2
people. Invite-link routes are unaffected — `invites.ts` stays as the one file that combines
service logic and route registration, as already established; it is not being split or moved.

**Card tags + stack upgrade (2026-10-08):** cards can carry project-scoped tags (`tags` /
`card_tags` tables, `backend/src/modules/kanban/tag.service.ts`, `TagsModal.svelte` on the
frontend; routes in `docs/api-spec.md` "Internal endpoints — kanban tags"). Each project gets 5
default tags on creation, and the migration adds them to existing projects. The stack moved to
Node 22 (images, `engines`), Fastify 5 (with the matching `@fastify/*` plugins), Octokit 5 and
ESLint 10 (flat config in `backend/eslint.config.js`, replacing `.eslintrc.json`).

Two paths aren't explicitly assigned in the plan's GitHub management table
(`backend/src/modules/projects/` and `frontend/src/api/`) — they're grouped under
Track 1 here since they're foundational/unclaimed elsewhere; confirm this with the team.

## Track 1 — Foundation, Auth, and API infrastructure (1 person)

- `backend/src/server.ts`, `backend/src/app.ts`
- `backend/src/config/env.ts`
- `backend/src/modules/auth/password.service.ts`, `jwt.service.ts`, `oauth.service.ts`, `auth.routes.ts`, `auth.validation.ts`
- `backend/src/modules/permissions/roles.service.ts`, `permissions.middleware.ts`, `users.service.ts`
- `backend/src/modules/projects/projects.service.ts`, `members.service.ts`, `invites.ts`, `projects.routes.ts` *(organization system — unclaimed in the GH table, grouped here; `invites.ts` is the invite-link membership flow: create/join/revoke a `project_invites` row, inserting into `project_members` on join, plus its dedicated `@fastify/rate-limit` policy for the join route; `projects.routes.ts` is the thin Fastify wrapper around `projects.service.ts`/`members.service.ts` that `app.ts` already imports as `registerProjectsRoutes` — added 2026-08-30, was missing from this list)*
- `backend/src/modules/publicapi/apikeys.service.ts`, `ratelimit.middleware.ts`, `publicapi.routes.ts`
- `backend/src/db/prisma/client.ts`
- `backend/prisma/schema.prisma` *(now includes `ProjectInvite`/`project_invites`, with `revokedBy`/`revokedAt` FK'd to `users.id`)*
- `backend/package.json`, `backend/tsconfig.json`, `backend/eslint.config.js`, `backend/.prettierrc.json`
- `frontend/src/auth/loginForm.ts`, `signupForm.ts`, `oauthFlow.ts`
- `frontend/src/api/apiClient.ts`, `wsClientWrapper.ts` *(low-level Socket.IO client wrapper — unclaimed in the GH table, grouped here)*
- `frontend/package.json`
- `infra/nginx/default.conf.template` *(nginx image template; ${HTTP_PORT}/${HTTPS_PORT} from .env)*
- `backend/prisma/migrations/` *(generated by `prisma migrate dev`; applied on container start via `prisma migrate deploy`)*
- `docker-compose.yml`, `.env.example`

## Track 2 — Kanban core & real-time sync (2 people)

**Person A — Kanban CRUD and UI:**
- `backend/src/modules/kanban/boards.service.ts`, `lists.service.ts`, `cards.service.ts`, `tag.service.ts`, `validation.ts`, `kanban.routes.ts` *(`kanban.routes.ts` is the thin Fastify wrapper around boards/lists/cards services that `app.ts` already imports as `registerKanbanRoutes` — added 2026-08-30, was missing from this list; after each mutation it calls Person B's `broadcast.ts`, so coordinate event names/payloads with Person B)*
- `frontend/src/kanban/boardApi.ts`, `listApi.ts`, `cardApi.ts`, `dragAndDrop.ts`, `cardDetail.ts`, `TagChip.svelte`, `TagsModal.svelte`

**Person B — WebSocket layer (Socket.IO):**
- `backend/src/modules/kanban/hub.ts`, `broadcast.ts`, `presence.ts`
- `frontend/src/kanban/wsClient.ts`, `presence.ts` *(now built on `socket.io-client`, not a raw WebSocket)*

## Track 3 — Git integration (1 person)

- `backend/src/modules/git/branchLink.service.ts`, `webhook.routes.ts`, `eventProcessor.service.ts`, `webhookLog.service.ts` *(GitHub via Octokit)*
- Remember: the README justification for claiming this as a custom Major "Modules of choice" module (see `docs/ft_transcendence_plan.md` section 10, Track 3) still needs to be written in `README.md`.

## Track 4 — Whiteboard, notes, and supporting modules (1 person)

- `backend/src/modules/notes/notes.service.ts`, `notes.routes.ts` *(`notes.routes.ts` added 2026-08-30, was missing from this list — thin wrapper `app.ts` already imports as `registerNotesRoutes`)*
- `backend/src/modules/attachments/attachments.service.ts`, `attachments.routes.ts` *(implemented 2026-10-07 — upload/list/download/delete behind requireRole, files on the `uploads_data` volume)*
- `backend/src/modules/search/search.service.ts`, `search.routes.ts` *(added 2026-08-30 — `registerSearchRoutes`)*
- `backend/src/modules/notifications/notifications.service.ts`, `notifications.routes.ts` *(added 2026-08-30 — `registerNotificationsRoutes`; note `createNotification` itself has no public endpoint, it's called internally by kanban/notes/attachments/git handlers)*
- `frontend/src/whiteboard/index.html`, `main.tsx` *(React + Excalidraw; `whiteboardMount.tsx` and `exportToImage.ts` were planned but never needed — the scene is stored in the DB and Excalidraw's own menu handles image export)*
- `backend/src/modules/whiteboard/whiteboard.service.ts`, `whiteboard.routes.ts` *(added 2026-10-05 — `registerWhiteboardRoutes`)*
- `frontend/src/notes/notesEditor.ts`, `notesApi.ts`
- `frontend/src/shared/designTokens.ts`, `components.ts`, `cssSetup.ts`
- `frontend/src/legal/privacyPolicy.ts`, `termsOfService.ts`

## Shared (coordinated by the Tech Lead)

- `README.md`
- `docs/ft_transcendence_plan.md`, `docs/architecture.md`, `docs/db-schema.md`, `docs/api-spec.md`, `docs/github-workflow.md`
