<!-- Owner: Shared, coordinated by the Tech Lead -->
<!-- Responsible for: documenting the Public API endpoints (Track 1's publicapi module), required by the Public API major module. -->

# API Specification

**Path note:** implementation now lives at `backend/src/modules/publicapi/` (Fastify
routes in `publicapi.routes.ts`, API key logic in `apikeys.service.ts`, rate limiting
in `ratelimit.middleware.ts`; auth middleware in `apikey.middleware.ts`; key-management routes)
`backend/internal/publicapi/`. The endpoint contract, auth model, and rate-limit
behavior described below are unchanged by the pivot.

## Endpoints (5 documented, per the Public API major module requirement)

The same contract is served by the app itself: **`/api-docs`** (a page of the site, with its header and colours, public; `GET /api/docs` redirects to it through nginx, and answers a plain page when the backend is reached directly) and
**`GET /api/openapi.json`** (OpenAPI 3.0), generated from one description in
`backend/src/modules/publicapi/publicapi.docs.ts` (the frontend page `frontend/src/api-docs/` is drawn from `/api/openapi.json`). The project settings (Clés API) link to it. Keep that file
and this document in step when an endpoint changes.

| Method | Path | Handler |
|---|---|---|
| GET | `/api/projects` | `getProjectsHandler` |
| GET | `/api/projects/{projectId}/cards` | `getCardsHandler` |
| POST | `/api/projects/{projectId}/cards` | `createCardHandler` |
| PUT | `/api/projects/{projectId}/cards/{cardId}` | `updateCardHandler` |
| DELETE | `/api/projects/{projectId}/cards/{cardId}` | `deleteCardHandler` |

All five are registered in `backend/src/modules/publicapi/publicapi.routes.ts` and
wrap the same underlying Track 2 Kanban / Track 1 Projects service functions used by
the authenticated (JWT) frontend routes — the public API is a secured, rate-limited
window onto the same data, not a separate implementation.

## Auth

Requests present an API key in the **`X-API-Key`** header. `requireApiKey`
(`apikey.middleware.ts`) hashes it (SHA-256) and looks it up in `api_keys.key_hash` via
`validateApiKey` — plaintext keys are never stored. Keys look like `tk_<43 base64url chars>`.

```
curl -H "X-API-Key: tk_..." https://host/api/projects
```

A key identifies *who* and optionally *where*; it never grants access by itself:

- `api_keys.user_id` is the issuing user. Requests act as that user, and every project-scoped
  route still runs `requireRole` against `project_members` (docs/architecture.md §5), so
  demoting or removing the user cuts the key's access immediately. Keys with a null `user_id`
  are rejected (fail closed).
- `api_keys.project_id`, when set, restricts the key to that project (`403 api_key_project_mismatch`
  elsewhere). `GET /api/projects` then returns only that project.
- Minimum roles: `GET` cards = `viewer`; `POST`/`PUT`/`DELETE` cards = `member`.

In the canonical layout `GET /api/projects` shares its path with the JWT route in
`projects.routes.ts` (interim layout: that one is `GET /my-projects`). A Fastify route
constraint (`apiKeyRouteConstraint`, registered in `app.ts`) sends requests that carry an
`X-API-Key` header to the public handler and all others to the JWT handler.

Prehandler order on every route: `requireApiKey` → `rateLimitMiddleware` →
`enforceKeyProjectScope` → `requireRole`.

### Key management (JWT, project admin)

Not part of the 5 documented endpoints; ordinary JWT routes in `apikeys.routes.ts`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/projects/{projectId}/api-keys` | Body `{ "rateLimit"?: 1..10000 }` (req/min, default `PUBLIC_API_RATE_LIMIT_DEFAULT`). `201 { apiKey, key }` — `key` is the plaintext, returned **once** |
| GET | `/api/projects/{projectId}/api-keys` | `200 { apiKeys: [...] }`, never includes key material |
| DELETE | `/api/projects/{projectId}/api-keys/{keyId}` | Revokes (deletes the row). `204`, or `404 api_key_not_found` |

## Request / response shapes

Errors are always `{ "error": "<code>", "details"?: [...] }`.

**Card**: `{ id, projectId, listId, title, description, status, position, linkedBranch, linkedPrUrl, createdAt, updatedAt }`
**Project**: `{ id, name, ownerId, createdAt, updatedAt }`

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /api/projects` | — | `200 { projects: Project[] }` | 401 |
| `GET /api/projects/{projectId}/cards` | query: `listId?`, `status?`, `limit?` (1–100, default 50), `offset?` (default 0) | `200 { cards: Card[], total, limit, offset }` | 400, 401, 403, 429 |
| `POST /api/projects/{projectId}/cards` | `{ listId, title (≤200), description? (≤10000) }` | `201 { card }` | 400, 401, 403, 404 `list_not_found`, 429 |
| `PUT /api/projects/{projectId}/cards/{cardId}` | `{ title?, description? }`, at least one (partial update) | `200 { card }` | 400, 401, 403, 404 `card_not_found`, 429 |
| `DELETE /api/projects/{projectId}/cards/{cardId}` | — | `204` | 401, 403, 404 `card_not_found`, 429 |

Lists/cards from another project are reported as `404`, never `403`, so ids can't be probed.
Create/update/delete delegate to `kanban/card.service.ts`, so validation, Socket.IO broadcast
and notifications behave as for the frontend. `assignee` is not exposed (no column in `cards`).

## Rate limiting

`rateLimitMiddleware` runs a fixed one-minute window per API key, limit = `api_keys.rate_limit`
(requests/minute), in-process (per-instance, see docs/architecture.md §8). It is separate from
the IP-keyed global limit in `app.ts`, which also still applies.

Every key-authenticated response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
`X-RateLimit-Reset` (epoch seconds). Over the limit:

```
429 Too Many Requests
Retry-After: 37
{ "error": "rate_limit_exceeded", "limit": 100, "retryAfter": 37 }
```

## Users, roles and permissions

Advanced permissions major module, in `backend/src/modules/permissions/` (`roles.service.ts`,
`permissions.middleware.ts`, `users.*`) and `projects/members.service.ts`.

**Roles are per project** and stored in `project_members.role`, the only source of truth for authorization
(never an invite, never the JWT): `viewer` < `member` < `admin`. The creator of a project is its owner and is
always an admin. Every protected route runs `requireAuth`, then `requireRole(min)` (or `requireProjectRole`, which
first finds the project of a card, list, board or tag). An unknown token gives `401`, a missing or too low role
`403 insufficient_role`.

| | viewer | member | admin | owner |
|---|---|---|---|---|
| Read the board, cards, notes, files, whiteboard, members, tags, search | yes | yes | yes | yes |
| Create / edit / move / delete cards, lists, tags, notes, folders, files; draw on the whiteboard; link a card to a branch | | yes | yes | yes |
| Rename the project, add / remove members, change roles, invite links, API keys, Git webhook log, delete the board | | | yes | yes |
| Delete the project, hand over ownership | | | | yes |

The owner cannot be demoted or removed, and the last admin of a project cannot be demoted or removed
(`409 owner_role_immutable`, `last_admin`, `cannot_remove_owner`).

**The interface follows the role** (kanban, notes, files and whiteboard are read-only for a viewer; the project
settings sections are for admins), and the server enforces it anyway.

**Open connections follow it too.** A Socket.IO connection must be a member to join a project room, a note or the
whiteboard. Viewers can watch but their edits are dropped. The role is looked up again every 30 s
(`SOCKET_ROLE_TTL_MS`), so a demoted member stops being able to edit, and a removed one stops receiving, without
reconnecting.

### Users

| Method | Path | Who | Effect |
|---|---|---|---|
| `GET` | `/api/users/me` | signed in | `200 { id, email, name, avatar }` |
| `PATCH` | `/api/users/me` | signed in | `{ "name" }` (1 to 60 characters, trimmed) -> `200 { id, email, name, avatar }`. The e-mail is the login identity and cannot be changed |
| `PUT` | `/api/users/me/avatar` | signed in | `multipart/form-data`, field `file`: PNG, JPEG, GIF or WebP, 2 MiB at most (the type is read from the content, not from the name or the declared type; SVG is refused) -> `200 { avatar }` (`/api/avatars/<uuid>.<ext>`). `400 invalid_avatar`, `413 avatar_too_large`. The previous upload is deleted |
| `DELETE` | `/api/users/me/avatar` | signed in | `204`. Back to the default avatar (the initials on a coloured disc, drawn by the frontend) |
| `PUT` | `/api/users/me/password` | signed in | `{ "currentPassword", "newPassword" }` (same rules as signup) -> `204`. `403 wrong_password` (403, not 401, so the session is kept), `400 invalid_input`. Limited to 10 tries per 15 minutes. Accounts made through GitHub only have no known password and cannot use it |
| `GET` | `/api/avatars/:file` | public | The picture. Public on purpose (an `<img>` cannot send the token); the name is an unguessable uuid. `Cache-Control: immutable`, `nosniff` |
| `GET` | `/api/users/:userId` | self, or somebody who shares a project | `200 { user: { id, name, avatar, createdAt, projects: [ { id, name, role } ], email? } }`. `email` only for the person themself and the admins of a shared project. Anybody else gets `404` (ids cannot be probed) |
| `DELETE` | `/api/users/:userId` | self only (`403` otherwise) | `204`. Owning a shared project needs `{ "transferTo": <member id> }` (`400 transfer_target_required`); being the last admin of one needs a handover too (`409 last_admin_of_membership`). Projects with nobody else are deleted with the account |

### Members and roles (project admin)

| Method | Path | Body | Effect |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/members` | | any member: the members with their role and profile |
| `POST` | `/api/projects/:projectId/members` | `{ userId, role }` | adds the user, or changes the role if already a member |
| `PUT` | `/api/projects/:projectId/members/:userId` | `{ role }` | changes the role of a member (`404 not_a_project_member` for somebody else: it never adds) |
| `DELETE` | `/api/projects/:projectId/members/:userId` | | removes the member |

The person concerned and the rest of the project are notified of each change.

## Internal endpoints — notifications

Minor module "Notification system", in `backend/src/modules/notifications/`. JWT routes, called by the bell in
the app header (`frontend/src/shared/ui/NotificationsBell.svelte`).

| Method | Path | Success |
|---|---|---|
| `GET` | `/api/notifications?limit=` (1 to 100, default 50) | `200 { "notifications": [ Notification ], "unreadCount" }`, newest first |
| `PUT` | `/api/notifications/:id/read` | `204`, `404 notification_not_found` for an id that is not the caller's |
| `PUT` | `/api/notifications/read-all` | `200 { "updated" }` |

A `Notification` is `{ id, userId, type, payload, readAt, createdAt }`, with
`payload = { message, projectId, projectName, actorId, actorName, entityId, url }`. `url` is an in-app path
(`/app/<project>/notes/<note>`), an absolute https address (a GitHub pull request) or `null` (nothing to open,
e.g. a deleted project).

**Who is told.** Every member of the project except the person who did the action. A change made by GitHub
has no actor, so everybody is told. Changes of membership tell the person concerned in their own words
("vous a ajouté au projet", "vous a retiré du projet") and the rest of the project separately.

**What is told** (`type`): card, list, board and tag creation / update / deletion (`card_created`,
`card_updated`, `card_moved` when the list changes, `card_deleted`, `card_tags_updated`, `list_*`,
`board_deleted`, `tag_*`), notes (`note_created`, `note_renamed`, `note_updated`, `note_deleted`), files and
folders (`file_uploaded`, `file_moved`, `file_deleted`, `folder_*`), the whiteboard (`whiteboard_updated`),
the project (`project_updated`, `project_deleted`), members (`member_added`, `member_role`,
`member_removed`, `member_joined`), the same card changes made through the Public API (worded "via l'API"),
and the GitHub automation (`git_pr_opened`, `git_pr_merged`, `git_pr_closed`). Reordering cards or lists is
not told.

**Coalescing.** Updates that are repeated (a note autosaving while someone types, a card description, the
whiteboard) do not pile up: if the same person already has an unread notification of the same type on the same
thing from the last 10 minutes, it is refreshed (new wording, back on top) instead of adding another.

**Real time.** Each Socket.IO connection joins the room `user:<id>` (`hub.ts`). Every notification created or
refreshed is emitted there as the event `notification` (payload: the stored row), so every open tab of the
user receives it. Sending never fails the action that caused it.

**Retention.** Read notifications older than 30 days are deleted the next time their owner opens the list.

## Authentication — GitHub OAuth 2.0

Minor module "OAuth 2.0", in `backend/src/modules/auth/oauth.service.ts` and `auth.routes.ts`. It sits on top of
the email/password login, which stays the baseline.

| Method | Path | Auth | Effect |
|---|---|---|---|
| `GET` | `/api/auth/oauth/github/redirect` | none | `302` to GitHub's consent screen, sets the state cookie |
| `GET` | `/api/auth/oauth/github/callback` | state cookie | Called by GitHub. `302` to `/auth/callback#token=<jwt>` (login), `#linked=1` (link) or `#error=<name>` |
| `POST` | `/api/auth/oauth/github/link` | JWT | `200 { "url" }`: consent-screen url that attaches GitHub to the signed-in user, sets the state cookie |

- **Scope** `read:user user:email repo`: the profile and verified emails for the login, `repo` for the Git
  integration (branches, repository webhook). The GitHub token is stored encrypted (`tokenCrypto.ts`).
- **Email**: read from GitHub's `/user/emails` (the public profile email is often hidden): the verified primary
  address, lowercased. An unverified address is never used. A new user is created with it, or the GitHub identity
  is attached to the existing account that has the same email.
- **CSRF / login CSRF**: `state` is a signed JWT (10 min) holding a nonce, and the same nonce is set in an
  `HttpOnly; SameSite=Lax` cookie scoped to `/api/auth/oauth` (`Secure` when the app runs over https). The
  callback refuses a state whose nonce does not match the cookie of the browser, so a victim cannot be logged in
  with an attacker's `code`.
- **Link flow**: the state also carries the signed-in user's id. One GitHub identity belongs to one user:
  linking an identity owned by someone else fails with `OAuthAccountConflictError`.
- **Error names** sent in `#error=`: `OAuthNotConfiguredError`, `OAuthStateError`, `OAuthExchangeError`,
  `OAuthAccessDeniedError` (consent refused), `OAuthAccountConflictError`. The frontend maps them to messages
  (`frontend/src/auth/oauthFlow.ts`).
- Setup: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT_URI` (must equal the callback URL
  registered in the GitHub OAuth app), `OAUTH_TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`).

## Invite-link membership endpoints

Implemented in `backend/src/modules/projects/invites.ts` (both the service functions and
the Fastify route handlers live in that one file, same pattern as `auth.routes.ts` and
`webhook.routes.ts`). These are ordinary JWT-authenticated routes (same auth as the
frontend's other `/api/*` calls), not part of the API-key-based Public API section above.

| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | `/api/projects/{project_id}/invites` | `createInviteHandler` | JWT + project admin (`requireRole("admin")`) |
| POST | `/api/projects/invites/{token}/join` | `joinInviteHandler` | JWT only — caller need **not** be a project member yet |
| DELETE | `/api/projects/{project_id}/invites/{invite_id}` | `revokeInviteHandler` | JWT + project admin (`requireRole("admin")`) |

### Security notes

- **Token stored hashed.** `createInvite` returns the plaintext token to the caller exactly
  once, in the create response body; only its hash (`project_invites.token_hash`) is ever
  persisted. The join endpoint hashes the presented `{token}` path param and looks up that
  hash — a leaked database dump never yields a usable invite token.
- **Expiry / revocation / max-use checks happen only at join time.** `joinInvite` rejects if
  `revoked_at` is set, if `expires_at` is in the past, or if `use_count >= max_uses` (when
  `max_uses` is set). These are the only validity checks an invite ever gets — see
  `db-schema.md` for the `revoked_by`/`revoked_at` columns.
- **Dedicated join rate limit.** `POST /api/projects/invites/{token}/join` carries its own
  `@fastify/rate-limit` policy (`INVITE_JOIN_RATE_LIMIT` in `invites.ts`: 5 requests/minute,
  keyed by IP), stricter than and independent of the global default described in
  `docs/architecture.md` "Rate limiting strategy". This endpoint is the most attractive target
  for brute-forcing/enumerating invite tokens, since a valid guess has a real side effect
  (project membership), so it gets its own tighter budget rather than sharing the global one.
- **Post-join authorization always goes through `project_members`, never the invite.** Once
  `joinInvite` inserts the `project_members` row (via `members.service.ts`'s `addMember`), the
  invite is spent and irrelevant. Every subsequent request to this project's resources is
  authorized by `permissions.middleware.ts` reading `project_members` (role-based), not by
  presenting the invite token again or by any other form of "possessing the link." An invite
  link is a one-time credential for *joining*, never a standing credential for *access*.

## Internal endpoints — attachments

Not part of the Public API module: the app's own file upload routes, called with the user's JWT.

| Method | Path | Min role | Body | Success |
|---|---|---|---|---|
| `POST` | `/api/attachments/:projectId` | member | `multipart/form-data`, one file field; optional `?cardId=` | `201 { "attachment": … }` |
| `GET` | `/api/attachments/:projectId` | viewer | — | `200 { "attachments": [ … ] }` |
| `GET` | `/api/attachments/:projectId/:id` | viewer | — | `200`, the file itself |
| `DELETE` | `/api/attachments/:projectId/:id` | member | — | `204` |

- 10 MiB per file, one file per request. nginx already allows 20 MiB on `/api/`.
- Accepted types: PNG, JPEG, GIF, WebP, PDF, plain text, Markdown, JSON, ZIP. SVG is deliberately
  excluded — it can carry scripts and would be served from our own origin.
- Files live under `/app/uploads` (the `uploads_data` volume) under a generated uuid name. The
  user's file name is stored as data in `file_name` and never used as a path.
- Downloads carry `Content-Disposition: attachment`, so the browser saves the file rather than
  rendering it.
- Errors: `400 invalid_upload` (type or size), `401 unauthenticated`, `403 insufficient_role`,
  `404 attachment_not_found`, `413 file_too_large`.

## Internal endpoints — whiteboard

Not part of the Public API module (no API key, no rate-limit tier): these are the app's own routes,
called by `frontend/src/whiteboard/` with the user's JWT.

| Method | Path | Min role | Body | Success |
|---|---|---|---|---|
| `GET` | `/api/whiteboards/:projectId` | viewer | — | `200 { "whiteboard": … \| null }` |
| `PUT` | `/api/whiteboards/:projectId` | member | `{ "sceneJson": { … } }` | `200 { "whiteboard": … }` |

- The whiteboard object is `{ id, projectId, sceneJson, updatedBy, updatedAt }`. `GET` returns
  `{ "whiteboard": null }` when nothing has been saved for the project yet — that is not an error.
- `PUT` replaces the whole scene (last save wins) and accepts a body up to **5 MiB**, since an
  Excalidraw scene with many shapes passes Fastify's 1 MiB default. nginx's `client_max_body_size`
  has to allow the same.
- Errors: `400 invalid_input` (`sceneJson` is not a JSON object), `401 unauthenticated`,
  and whatever `requireRole` answers when the caller's role is too low.

## Internal endpoints — kanban tags

Not part of the Public API module either: JWT routes called by `frontend/src/kanban/`, implemented in
`backend/src/modules/kanban/tag.service.ts` and `kanban.routes.ts`. Tags belong to one project: two
projects can both have a "Bug" tag with their own colour. Each new project starts with 5 default tags
(WIP, En cours, À relire, Bloqué, Bug).

| Method | Path | Min role | Body | Success |
|---|---|---|---|---|
| `GET` | `/api/projects/:projectId/tags` | viewer | — | `200 [ Tag ]` |
| `POST` | `/api/projects/:projectId/tags` | member | `{ "name", "color"? }` | `201 Tag` |
| `PUT` | `/api/tags/:id` | member | `{ "name"?, "color"? }`, at least one | `200 Tag` |
| `DELETE` | `/api/tags/:id` | member | — | `204` |
| `PUT` | `/api/cards/:id/tags` | member | `{ "tagIds": [uuid, …] }` | `200 Card` (with `tags`) |

- A `Tag` is `{ id, projectId, name, color, createdAt }`. `name` is 1 to 30 characters with at least one
  non-space character, unique per project. `color` is a `#rrggbb` string (default `#6b7280`).
- Every card sent by the board and card routes now has a `tags` array (`Tag[]`, sorted by name).
- `PUT /api/cards/:id/tags` replaces all the tags of the card (an empty array removes them all).
  It accepts up to 50 ids.
- Deleting a tag removes it from every card.
- Errors: `400` (validation, or `invalid_tags` when a tag does not exist or belongs to another
  project), `401`, `403 insufficient_role`, `404` (tag or card not found), `409 tag_name_taken`.
- Socket.IO events sent to the project room: `tag_created` and `tag_updated` (the `Tag`),
  `tag_deleted` (`{ id }`), and `card_updated` (the `Card`) when the tags of a card change.

## Internal endpoints — Git integration

Not part of the Public API module: JWT routes called by the kanban UI (`GitLinkModal.svelte`), in
`backend/src/modules/git/git.routes.ts`. The receiver GitHub calls is described below the table.

| Method | Path | Min role | Body / query | Success |
|---|---|---|---|---|
| `GET` | `/api/git/status` | any user | — | `200 { "connected": boolean }` (GitHub account linked) |
| `GET` | `/api/projects/:projectId/git/branches` | member | `?repoUrl=` | `200 { "branches": [string] }` |
| `POST` | `/api/cards/:id/git` | member | `{ "repoUrl", "branchName", "createBranch"? }` | `200 Card` |
| `DELETE` | `/api/cards/:id/git` | member | — | `200 Card` |
| `GET` | `/api/projects/:projectId/git/events` | admin | `?limit=` (1 to 200, default 50) | `200 { "events": [ { id, provider, repo, eventType, processedAt, createdAt } ] }` |

- `POST /api/cards/:id/git` links the card to a branch (creating it from the default branch when
  `createBranch` is true, which needs a linked GitHub account). It then tries to register the repository
  webhook (see below); a failure there is logged and does not fail the link.
- `GET .../git/events` is the audit log of `webhook_events` for the repositories linked in the project, newest
  first, without the payload. `processedAt` is `null` when the event was received but not handled.
- Errors: `400 invalid_input`, `401`, `403 insufficient_role`, `409 github_not_linked`, `502 github_error`.

### Webhook receiver (called by GitHub)

`POST /api/webhooks/git`, no JWT: the `X-Hub-Signature-256` HMAC (SHA-256 of the raw body with
`GIT_WEBHOOK_SECRET`) is verified first, `401` otherwise. Every valid delivery is stored in `webhook_events`
and stamped `processed_at` once handled. A card is matched only through its `git_links` row (repo + branch).

| GitHub event | Effect on the linked card |
|---|---|
| `push` to the branch | `todo` becomes `In progress` (a later push never moves a card back from `PR pending` or `Done`); tags and branch deletions are ignored |
| `pull_request` opened / reopened | `PR pending`, PR url stored, `git_links.pr_status = open`, notification to every project member |
| `pull_request` closed, merged into the default branch | `Done`, `pr_status = merged`, notification |
| `pull_request` closed, merged into another branch | ignored |
| `pull_request` closed without merge | `PR pending` goes back to `In progress`, `pr_status = closed`, notification |

The change is broadcast to the open boards (`card_updated`). A processing error answers `500` and leaves the
event unprocessed, so it can be redelivered from GitHub. Setting `WEBHOOK_PUBLIC_URL` (public https origin of
the app) lets the backend register this webhook on the repository when a branch is linked; without it, add it
by hand in the repository settings (payload URL `<origin>/api/webhooks/git`, content type `application/json`,
the same secret, events `push` and `pull requests`).

## Internal endpoints — folders, notes and files

Not part of the Public API module: the app's own routes, called with the user's JWT. Only files have folders; notes are a flat list.

**Folders** — `/api/folders`

| Method | Path | Min role | Body | Success |
|---|---|---|---|---|
| `GET` | `/api/folders/:projectId` | viewer | — | `200 { folders: […], limits: { maxSubfolders, maxDepth } }` (flat list, build the tree from `parentId`) |
| `POST` | `/api/folders/:projectId` | member | `{ name, parentId? }` | `201 { folder }` |
| `PATCH` | `/api/folders/:projectId/:id` | member | `{ name?, parentId? }` (`parentId: null` = top level) | `200 { folder }` |
| `DELETE` | `/api/folders/:projectId/:id` | member | — | `204` |
| `POST` | `/api/folders/:projectId/:id/copy` | member | `{ parentId? }` | `201 { folder }` — copies the folder with its subfolders and files (new files on disk); a copy next to the original is named "… (copie)" |

- Limits: 60 subfolders per folder (top level included) and 8 levels. Errors: `409 max_subfolders_reached`,
  `409 max_depth_reached`, `409 folder_cycle` (moving a folder into itself), `409 folder_not_empty` (only an
  empty folder can be deleted), `400 invalid_name`, `404 folder_not_found`.

**Notes** — `/api/notes`

| Method | Path | Min role | Body | Success |
|---|---|---|---|---|
| `GET` | `/api/notes/:projectId?cardId=` | viewer | — | `200 { notes: […] }` — metadata, `cardIds` and a `preview` (first 400 characters of the text), no full content; `cardId` keeps the notes linked to that card |
| `POST` | `/api/notes/:projectId` | member | `{ title? }` | `201 { note }` |
| `GET` | `/api/notes/:projectId/:noteId` | viewer | — | `200 { note }` (with `contentJson`, a read-only copy) |
| `PATCH` | `/api/notes/:projectId/:noteId` | member | `{ title? }` | `200 { note }` |
| `DELETE` | `/api/notes/:projectId/:noteId` | member | — | `204` (whoever has it open gets `note_deleted`) |
| `PUT` / `DELETE` | `/api/notes/:projectId/:noteId/cards/:cardId` | member | — | `204` — link / unlink a card of the same project |

- A project has any number of notes. The content is not written through HTTP: it is edited live
  (see below). `contentJson` is Tiptap's document JSON, derived by the server from the live Yjs document
  each time it is saved; `search.service.ts` walks it with `extractPlainText` to index the text.
- Errors: `400 invalid_title`, `404 note_not_found` / `card_not_found`, `401 unauthenticated`, `403 insufficient_role`.

**Files** — `/api/attachments` (see the file upload module) also accepts, on top of upload / list / download / delete:
`POST …?folderId=&cardId=` (put the new file in a folder and/or link it to a card), `GET …?cardId=` (files linked to a card),
`PATCH /:projectId/:id { folderId }` (move; `null` = top level), `POST /:projectId/:id/copy { folderId? }` (duplicate, with a new file on disk) and `PUT` / `DELETE /:projectId/:id/cards/:cardId` (link / unlink).
Files are returned with `folderId` and `cardIds`.

### Live editing (Socket.IO)

Each note is a Yjs document relayed over the same Socket.IO connection as the Kanban (same JWT handshake).
Binary fields are Yjs updates. The server keeps the document in memory while someone is editing it and
saves it (`notes.yjs_state` + `notes.content_json`) at most every 2 seconds, and when the last editor leaves.

| Event | Direction | Payload |
|---|---|---|
| `note_join` | client → server | `{ noteId, stateVector }` — any role, must be a member |
| `note_sync` | server → client | `{ noteId, update, stateVector, canEdit }` — answer to `note_join`; `canEdit` is false for viewers |
| `note_update` | both | `{ noteId, update }` — one edit; the server ignores it from viewers and relays it to the others |
| `note_denied` | server → client | `{ noteId }` — not a member (anymore), or the note does not exist |
| `note_awareness` | both | `{ noteId, clientId, update }` — Yjs awareness (name, colour, cursor) of one editor, viewers included; relayed only, never saved. Replayed to people who join later |
| `note_awareness_remove` | server → client | `{ noteId, clientId }` — that editor left, remove its cursor |
| `note_deleted` | server → client | `{ noteId }` — the note was deleted while open |
| `note_leave` | client → server | `noteId` |

The project room (same as the Kanban events) also receives `documents_changed` (`{}`) whenever the notes/files linked to cards change
(link, unlink, deletion, upload with `?cardId=`): the board reloads how many documents each card has.

The role is re-read from the database every 30 seconds, so a removal or demotion takes effect quickly.
