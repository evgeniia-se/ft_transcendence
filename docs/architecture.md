<!-- Owner: Shared, coordinated by the Tech Lead -->
<!-- Responsible for: describing the overall system architecture (frontend/backend/Socket.IO hub/DB/reverse proxy), the backend's module boundaries, and the main request/data flows (REST, invite join, authorization, WebSocket, Git webhook, rate limiting, data ownership), referenced in docs/ft_transcendence_plan.md sections 3-4. -->

# Architecture

**Stack pivot note (2026-08-26):** the backend moved from Go to **Node.js + TypeScript**
(Fastify, Prisma, Socket.IO). Product scope, module mapping, and track ownership are
unchanged — only the backend implementation technology and its internal file paths
changed. See `docs/ft_transcendence_plan.md` section 4 for the full stack rationale.

**API path note:** every backend REST route is mounted under the canonical **`/api`**
base path (not `/api/v1`) — e.g. `/api/auth/login`, `/api/projects/{id}/invites`. This
doc uses `/api/...` throughout to match `docs/api-spec.md` and the frontend's actual
calls in `frontend/src/api/` and `frontend/src/auth/`.

## 1. High-level system diagram

```
                                   HTTPS (browser-facing)
        ┌──────────┐     ┌──────────────────┐     ┌───────────────────────────┐
        │ Browser  │ ──▶ │  Nginx (reverse  │ ──▶ │        Backend            │
        │(Frontend │ ◀── │  proxy, TLS      │ ◀── │  Node.js + TypeScript     │
        │ TS/Svelte│     │  termination)    │     │  Fastify (HTTP) +         │
        │  client) │     │ infra/nginx/     │     │  Socket.IO (WebSocket),   │
        └──────────┘     │ default.conf.tmpl│     │  same http.Server         │
                          └──────────────────┘     │  (backend/src/server.ts) │
                                   ▲                └─────────────┬─────────────┘
                                   │ HTTP webhook                 │ Prisma (SQL)
                                   │ (push/PR/merge events)       ▼
                          ┌──────────────────┐          ┌──────────────────┐
                          │  GitHub          │          │    PostgreSQL     │
                          │ (external, OAuth  │          │  (docker-compose  │
                          │  + webhooks)      │          │   `db` service)   │
                          └──────────────────┘          └──────────────────┘
```

- **Frontend** — Svelte as main framework. Talks to the backend over HTTPS through Nginx: plain
  REST calls via `frontend/src/api/apiClient.ts`, and the Kanban real-time layer via
  `socket.io-client` (`frontend/src/api/wsClientWrapper.ts`, `frontend/src/kanban/wsClient.ts`).
- **Backend** — Node.js + TypeScript, one process, hosting two protocols on the same
  underlying Node `http.Server` (`backend/src/server.ts`): **Fastify** for HTTP/REST
  routing and plugins, and **Socket.IO** for the WebSocket layer. Business logic lives
  in `backend/src/modules/<domain>/`, one folder per domain (see §2 below and
  `docs/github-workflow.md` for the track ownership map).
- **Database** — PostgreSQL, accessed exclusively through **Prisma**
  (`backend/prisma/schema.prisma` is the schema source of truth; `backend/src/db/prisma/client.ts`
  exports the shared client). No module talks to Postgres with raw SQL — covers the
  ORM minor module.
- **Reverse proxy** — Nginx (`infra/nginx/default.conf.template`, rendered at container
  startup with `${HTTP_PORT}`/`${HTTPS_PORT}` from `.env`). Terminates TLS for all
  browser-facing traffic (general requirement: anything touching a browser must be
  HTTPS) and proxies both plain HTTP routes and the `/socket.io/` WebSocket-upgrade
  path to the backend container. Container-to-container traffic (backend ↔ Postgres)
  does not need TLS.
- **External Git providers** — GitHub is the only systems outside the
  Docker Compose network. The backend talks *out* to them (Octokit / `@gitbeaker/rest`,
  using OAuth tokens from `modules/auth/oauth.service.ts`) to link branches, and they
  talk *in* to the backend's webhook receiver (`modules/git/webhook.routes.ts`) to push
  push/PR/merge events. See §7.
- **Containerization** — Docker Compose (`docker-compose.yml`), services for frontend,
  backend, Postgres, and Nginx, runnable with a single `docker compose up`.

## 2. Backend module boundaries

Each folder under `backend/src/modules/` owns one domain end-to-end (service functions
+, where it registers its own routes, the Fastify handlers). Modules call into each
other's exported functions directly (in-process function calls, not HTTP) — there is no
internal service mesh, this is a single deployable.

| Module | Owns | Depended on by |
|---|---|---|
| `auth/` | Signup/login/logout, password hashing, JWT issuance/validation, OAuth2 (GitHub) | Every protected route, via `permissions/` |
| `permissions/` | `requireAuth`/`requireRole` preHandlers, role definitions, `project_members` reads | Every protected route across every module |
| `projects/` | Projects (organizations) CRUD, `project_members` add/remove/list, **invite-link joins** (`invites.ts`) | `kanban/`, `notes/`, `attachments/`, `search/`, `publicapi/` (all scope data by project) |
| `kanban/` | Boards/lists/cards CRUD, the Socket.IO hub, broadcast, presence | `git/` (drives card status), `publicapi/` (wraps card CRUD) |
| `git/` | Branch linking, webhook receipt/verification, event→card-status processing, webhook audit log | Calls back into `kanban/` to move cards |
| `notes/` | Notes CRUD, autosave | `search/` (indexes note content) |
| `whiteboard/` | One Excalidraw scene per project, stored as JSON; load + autosave | — |
| `attachments/` | File uploads (whiteboard image export is a client-side download in Excalidraw, not an upload) | `search/`, `notifications/` |
| `search/` | Cross-entity search over cards/notes/attachments | — |
| `notifications/` | Notification creation/delivery on create/update/delete actions | Triggered by `kanban/`, `notes/`, `attachments/`, `git/` |
| `publicapi/` | API-key auth, per-key rate limiting, the 5 documented external REST endpoints | Wraps `projects/` and `kanban/` service functions |

`db/prisma/` (shared Prisma client) and `config/` (env loading) are cross-cutting, used
by every module above rather than owned by one domain.

## 3. Request lifecycle — a normal REST call

Example: a logged-in user fetches their projects (`GET /api/projects`, frontend-facing
JWT route, not the API-key `publicapi/` one).

1. Browser sends `GET /api/projects` with `Authorization: Bearer <jwt>` over HTTPS.
2. Nginx terminates TLS and proxies the plain HTTP request to the backend container.
3. Fastify's global plugins run first (CORS, helmet, and the global `@fastify/rate-limit`
   check — see §8; a request over the global limit gets a `429` here and never reaches
   routing).
4. The route's `preHandler` chain runs: `requireAuth` (validates the JWT via
   `auth/jwt.service.ts`'s `validateJwt`, attaches `request.userId`; `401` if
   missing/invalid) then, for project-scoped routes, `requireRole` (reads the caller's
   role from `project_members` via `permissions/roles.service.ts`'s `getUserRole`;
   `403` if insufficient — see §5).
5. The route handler runs, delegating to the owning module's service function (here,
   `projects/projects.service.ts`'s `listProjectsForUser`).
6. The service function calls Prisma, which issues SQL to Postgres and returns typed
   rows.
7. The handler serializes the result as JSON and returns it; Fastify sends the
   response back through Nginx to the browser.

No step here touches Socket.IO — that's a separate flow (§6), only entered for Kanban
mutations that need to fan out to other connected clients.

## 4. Invite flow lifecycle

Implemented in `backend/src/modules/projects/invites.ts`. Full endpoint/security
details in `docs/api-spec.md`; schema in `docs/db-schema.md`.

**Create** — `POST /api/projects/{project_id}/invites`, admin-only:
1. `requireAuth` + `requireRole("admin")` gate the route — only an existing admin
   (per `project_members`) can mint an invite.
2. `createInvite` generates a random token, hashes it, and stores a `project_invites`
   row (`token_hash`, `role` to grant, optional `expires_at`/`max_uses`, `created_by`).
3. The **plaintext** token is returned in this one response only — it is never stored
   and never retrievable again after this call.
4. The admin shares the token (as a link, e.g. `https://.../join?token=...`) out of
   band — email, Slack, whatever the frontend wraps around it.

**Join** — `POST /api/projects/invites/{token}/join`, any logged-in user:
1. `requireAuth` gates the route (caller must be logged in — deliberately *not*
   `requireRole`, since the caller is not a project member yet; that's the point).
2. This route also carries the dedicated `INVITE_JOIN_RATE_LIMIT` override (§8) instead
   of the global default, since it's the most brute-forceable/enumerable endpoint in
   the app.
3. `joinInvite` hashes the presented token and looks up `project_invites` by
   `token_hash`. It rejects if: no match, `revoked_at` is set, `expires_at` has passed,
   or `use_count >= max_uses`.
4. If valid, in one transaction: insert a `project_members` row
   (`projectId`, the joining `userId`, `role` from the invite) via
   `members.service.ts`'s `addMember`, then increment `project_invites.use_count`.
5. **This insert is the membership grant.** From this point on the invite is spent and
   is never consulted again — see §5.

**Revoke** — `DELETE /api/projects/{project_id}/invites/{invite_id}`, admin-only:
1. `requireAuth` + `requireRole("admin")`.
2. `revokeInvite` sets `revoked_by` (the admin's user id) and `revoked_at` on the
   `project_invites` row. This only stops *future* joins through that link — it does
   not touch `project_members`, so people who already joined stay members.

## 5. Authorization flow (`project_members` role checks)

This is the one rule the whole permissions model rests on:

> **`project_members` is the only table ever consulted to decide "can this user do
> this on this project."** Nothing else — not a JWT claim, not an invite token, not a
> URL parameter, not "this request came from someone who once had a valid link" — ever
> grants access on its own.

Concretely:

1. `requireAuth` (JWT) only proves *who the caller is* (`request.userId`). It proves
   identity, not permission.
2. `requireRole(minRole)` (`permissions/permissions.middleware.ts`) is what proves
   *permission*. It reads `project_id` from the route params, calls
   `roles.service.ts`'s `getUserRole(projectId, userId)` — a direct `project_members`
   lookup — and compares the stored role's privilege level against `minRole`.
   `null` (no row = not a member) always fails.
3. Every project-scoped route (Kanban, notes, attachments, search, invite
   create/revoke, member management) goes through `requireAuth` then `requireRole` in
   that order. The only intentional exception is the invite **join** route (§4), whose
   entire purpose is to grant a `project_members` row to someone who fails
   `requireRole` today.
4. Roles (`admin` / `member` / `viewer`, `roles.service.ts`) are project-scoped, not
   global — the same user can be `admin` on one project and have no row at all on
   another.

This is why invites don't shortcut anything: an invite link can only ever cause a
`project_members` insert (via §4 step 4). It cannot be presented later as a
substitute for a role check, because nothing downstream of the join checks invites at
all.

## 6. WebSocket real-time Kanban flow

1. A client calls a Fastify route in `backend/src/modules/kanban/` (e.g. `POST /api/cards`
   via `card.service.ts`'s `createCard`), going through the same `requireAuth` +
   `requireRole` chain as any other project-scoped route (§3, §5).
2. The mutation is written to Postgres via Prisma.
3. The kanban service that made the mutation (`board.service.ts`, `list.service.ts`,
   `card.service.ts`) calls `broadcast.ts`, which emits the resulting event to every client
   in the project's Socket.IO room (`io.to(projectId).emit(...)`), replacing the former Go
   skeleton's hand-rolled `map[project_id]map[*Client]bool` hub with Socket.IO's built-in
   room support (`backend/src/modules/kanban/hub.ts`). Broadcasting from the services, not
   the route handlers, means a card created through the public API or moved by a Git
   webhook reaches the room exactly like one created in the UI. Events: `board_created`,
   `board_deleted`, `list_created`, `list_updated`, `list_deleted`, `lists_reordered`,
   `card_created`, `card_updated`, `card_deleted` and `card_moved` (carries the new card
   order of both lists, sent by `PUT /api/cards/:id/move`, a serializable transaction).
4. Presence ("joined"/"left") is broadcast the same way on Socket.IO `connection`/
   `disconnect` events (`presence.ts`), and a client that joins first gets a
   `presence_snapshot` of who is already there. The socket handshake is authenticated with
   the same JWT as HTTP (`validateJwt` in `hub.ts`), and `join_project` is only accepted
   for members of the project (`join_denied` otherwise) — room membership on the socket
   side mirrors `project_members`, it isn't a separate permission system. The kanban HTTP
   routes enforce the same rule with `requireProjectRole` (`kanban.permissions.ts`):
   viewer to read, member to edit, admin to delete a board.
   Presence is per person, not per connection: closing one of two tabs does not announce
   `left`, only the person's last connection does (`broadcastLeftIfGone`).
5. Rooms (`kanban/rooms.ts`): the project room (kanban events), `whiteboard:<project>` and
   `note:<note>` (separate because their traffic is chatty) and `user:<id>` (personal: every
   tab of one user, used for notifications and for being told one was removed).
6. Who may be in a project is live too (`kanban/membership.events.ts`). `members_changed`
   (a member added, a role changed, one removed or leaving) makes open boards reload the
   member list, which is what decides who may edit; `project_updated` carries a new name.
   A removed member is **evicted** from every room of the project on all their tabs and
   gets `removed_from_project`, so they stop receiving events at once; `project_deleted`
   goes to everybody connected before the rows are deleted, then the rooms are closed.
   Whiteboard and note sockets also re-read the role every 30 s (`SOCKET_ROLE_TTL_MS`).
7. Dropped connections: Socket.IO reconnects by itself, and a room lives on the server
   side socket, so the client (`kanban/wsClient.ts`) joins again on **every** `connect`.
   Events sent while it was away are not replayed: after a reconnect the board store
   refetches the project, board, members and tags, and the fresh `presence_snapshot`
   replaces the list of who is online. While offline the board shows a "Connexion perdue"
   banner. An expired or invalid token is refused at the handshake (`unauthorized`,
   `token_expired`) and sends the user back to the login page.
8. This is silent state sync — not a user-facing notification (see `notifications/`
   for that, triggered separately by the mutation itself, not by the broadcast).

## 7. Git webhook-to-card-status automation flow

1. A user links a card to a branch (`backend/src/modules/git/branchLink.service.ts`),
   using the OAuth token captured by `backend/src/modules/auth/oauth.service.ts`.
   GitHub calls go through **Octokit**
2. A webhook is registered on the linked repository for push/pull_request events
   (`ensureRepoWebhook` in `branchLink.service.ts`, best effort, needs `WEBHOOK_PUBLIC_URL`).
3. On webhook receipt (`webhookReceiverHandler`): this route is **not** JWT-authenticated
   (GitHub isn't logged-in users) — instead its signature is verified via an
   HMAC check against `GIT_WEBHOOK_SECRET`, rejecting anything that doesn't match
   before the payload is trusted.
4. The event is logged to `webhook_events` (`webhookLog.service.ts`) for audit/replay,
   then `eventProcessor.service.ts` matches the payload to a card via `git_links` and
   drives the status transition (first push → "In progress", PR opened → "PR pending",
   merged into the default branch → "Done", closed without merge → back to "In progress"),
   calling back into `kanban/card.service.ts` so the move also broadcasts over
   Socket.IO exactly like a user-driven move would (§6) — clients don't need to know
   the difference.
5. A notification fires via `notifications.service.ts` (`notifyProject`) once the card moves; the same dispatcher serves every other action, see the notifications section of `docs/api-spec.md`.

## 8. Rate limiting strategy

**Chosen strategy: `@fastify/rate-limit`**, registered once in `backend/src/app.ts`,
standardized across the whole backend rather than a hand-rolled per-module counter
(the earlier sketch in `publicapi/ratelimit.middleware.ts` is superseded by this — see
that file's own TODO acknowledging the plugin as the preferred path).

- **Global default** — registered as a plugin before routes, configured from
  `config/env.ts`'s `rateLimit.globalMax` / `rateLimit.globalWindowMs`
  (`RATE_LIMIT_GLOBAL_MAX` / `RATE_LIMIT_GLOBAL_WINDOW_MS` in `.env`). Applies to every
  route that doesn't declare its own override. Keyed by IP by default.
- **Per-route override — invite join.** `POST /api/projects/invites/{token}/join`
  declares its own stricter policy, `INVITE_JOIN_RATE_LIMIT` in
  `modules/projects/invites.ts` (5 requests/minute, keyed by IP), passed as that
  route's `config: { rateLimit: {...} }` — `@fastify/rate-limit`'s supported way to
  override the global default per-route. This route gets its own budget because a
  successful guess has a real side effect (project membership), making it the
  highest-value target for brute-forcing/enumerating tokens in the whole app; see
  `docs/api-spec.md`'s invite security notes.
- **Public API keys** — `publicapi/`'s per-API-key limits (`api_keys.rate_limit`
  column) are a separate, coarser concept: a *quota per issued key* for external
  integrators, not a per-route abuse guard. They can be layered on top of the same
  `@fastify/rate-limit` plugin (custom `keyGenerator` returning the API key ID) or kept
  as their own counter — either is fine, but they answer a different question
  ("how much has this integration used this month") than the global/invite-join limits
  above ("is this IP hammering us right now").
- **Multi-instance note.** `@fastify/rate-limit`'s default store is in-memory per
  process. Running more than one backend instance behind Nginx gives each instance its
  own independent counter, effectively multiplying every configured limit by instance
  count. This is fine for this project's single-instance `docker-compose` deployment.
  If the team ever scales to multiple backend instances, switch to the plugin's shared
  `redis` store (e.g. via `ioredis`) so all instances enforce one shared counter — not
  needed now, called out here so it isn't a surprise later.

## 9. Data ownership / source of truth

What table is authoritative for what, so no module reaches for a shortcut that
duplicates or bypasses another table's job:

| Question | Authoritative table | Notes |
|---|---|---|
| "Is this user allowed to do X on this project?" | `project_members` | The *only* table ever read for authorization (§5). Role is project-scoped. |
| "Who owns this project?" | `projects.owner_id` | Distinct from admin `project_members` rows — ownership is a single pointer, admin membership can be shared |
| "Was this invite link ever valid, and is it still?" | `project_invites` | Join-time validity only (expiry/revocation/max-use). Never read for post-join authorization — see §5 |
| "What actually happened as a result of an invite?" | `project_members` | The row inserted by `joinInvite` — the invite itself is not a membership record |
| "What's the current state of a board/list/card?" | `boards` / `lists` / `cards` | Socket.IO broadcasts are a *notification* of a change, never the source of the change itself — always DB-write-then-broadcast, never the reverse |
| "Is a card linked to a branch, and what's its PR state?" | `git_links` | Drives, but does not itself perform, the `cards.status` transition |
| "Did we receive and process this webhook event?" | `webhook_events` | Audit/replay log; `git_links`/`cards.status` are the derived effect, not this table |
| "Is this API key valid, and what's its quota?" | `api_keys` | `key_hash` only, like `project_invites.token_hash` — never plaintext at rest |
| "Has this user seen this notification?" | `notifications.read_at` | Notifications are informational records, not an authorization or state-sync mechanism (that's Socket.IO, §6) |
| "What GitHub token does the backend use to call GitHub on this user's behalf?" | `oauth_accounts.access_token` | Per-user OAuth token (not a GitHub App installation token), encrypted at rest via `modules/auth/tokenCrypto.ts`; read it through `getDecryptedAccessToken(userId)` in `oauth.service.ts`, never directly |

<!-- TODO: expand §7 with a sequence diagram once webhook signature verification and OAuth token storage details are finalized -->

## 10. Concurrency: several people acting at once

The subject requires that simultaneous actions neither corrupt data nor race. The rules the code follows
(`backend/src/db/concurrency.ts`):

1. **Read, decide, write is one transaction.** Anything that reads something and then writes depending on it runs in a
   `Serializable` Prisma transaction (`SERIALIZABLE`). Postgres aborts the one that lost the race (`P2034`, or `P2002` for a
   unique insert) and `retryOnConflict` runs it again on the new state, after a short random wait.
2. **One at a time per key, in the process.** `inSequence(key, task)` queues the tasks of one key. It removes the
   contention of one backend against itself (a board's moves all arrive in the same second), so retries stay rare;
   rule 1 keeps a second backend instance correct.
3. **Positions are an order, asked for as an index.** A card or a list is added "at index i" (the end when omitted) and
   the sequence is renumbered 0..n-1 around it (`kanban/positions.ts`); deleting renumbers too, and a move renumbers both
   lists. So two cards added at the same moment can no longer share a position. Everything that changes the order in a
   project is queued under the key `kanban:<project>`.
4. **Database errors that come from losing a race are client errors.** `app.ts` maps `P2025` and `P2003` (what the request
   targeted was deleted a moment ago) to `404`, `P2002` to `409`, and an aborted transaction or deadlock to `503` with
   `Retry-After`, never to an opaque `500`. Fastify's own errors (validation, 4xx) are unchanged.

Where it applies, and what was wrong before (found by hammering the API with simultaneous requests):

| Operation | Key | Before |
|---|---|---|
| First visit of a project's board | `board:<project>` | 10 members opening a new project at once created 10 boards, each seeing their own |
| Add a card / a list | `kanban:<project>` | Same position for all (20 cards at 0) |
| Move a card, delete a card or a list, reorder lists | `kanban:<project>` | 30 simultaneous moves all answered 500 (deadlock); a reorder could leave duplicates next to a newly created list |
| Replace the tags of a card | `cardtags:<card>` | Two requests left the union of both sets |
| Join with an invite link | `invite:<hash>` | Limits could be exceeded, one person could burn several uses |
| Save the whiteboard | `whiteboard:<project>` | First saves overwrote each other |
| Notification of a repeated update | `<type>:<entity>:<actor>` | Two quick edits each created one |
| Delete a project / an account | | A deadlock with a concurrent insert gave a 500 |

Already correct and covered by the same tests: edits of different fields of one card (both kept), creating the same tag or
signing up with the same e-mail at once (one wins, the others get 409), admins demoting each other (the owner is always an
admin, so a project never has none), the project deleted while others add content (no 500), and several people typing in the
same note (Yjs merges them; every client and the saved note end identical, a late joiner catches up, a viewer's edit is dropped).

