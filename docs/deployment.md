<!-- Owner: Shared, coordinated by the Tech Lead -->
<!-- Responsible for: how to run the project (the "Instructions" part of the README comes from here). -->

# Running the project

One command builds and starts everything: the database, the backend, the frontend and the HTTPS reverse proxy.

## Prerequisites

- **Docker** with the Compose plugin (`docker compose`), or Podman with a compatible `docker` command
- **Bash** and **OpenSSL** on the host (the script generates the certificate and the secrets)
- Free ports 8080 and 8443 (change them in `.env` otherwise)

Nothing else: Node.js, PostgreSQL and the dependencies all live in the containers.

## Start

```bash
git clone <repository> && cd ft_transcendence
./transcendence start
```

On a fresh clone the script, in this order:

1. creates `.env` from `.env.example` (`.env` is git-ignored);
2. asks for the GitHub OAuth app credentials (press Enter, or run without a terminal, to use random placeholders:
   email and password login works, "Continue with GitHub" does not until real credentials are set);
3. generates `OAUTH_TOKEN_ENCRYPTION_KEY` (32 random bytes) if it is not already valid;
4. generates a self-signed certificate in `infra/nginx/certs/` (git-ignored);
5. builds the `backend` and `frontend` images, only when their sources changed since the last build;
6. starts the containers; the backend applies the database migrations (`prisma migrate deploy`) before it listens.

Then open **https://localhost:8443/** and accept the browser warning (self-signed certificate).
`http://localhost:8080/` redirects to https. `https://localhost:8443/api/health` answers `"status":"ok"` when the
backend and the database are up. The public API documentation is at `https://localhost:8443/api-docs`.

`./transcendence start` generates the secrets that must not be guessable: a new `.env` gets a random `POSTGRES_PASSWORD`,
and `JWT_SECRET` and `GIT_WEBHOOK_SECRET` are replaced when they still hold the `change_me` placeholder (a value you chose
yourself is never touched). The backend warns at start-up if one of them is still the placeholder and refuses to start
with it when `NODE_ENV=production`. Replacing `GIT_WEBHOOK_SECRET` means the webhooks already registered on GitHub must be
recreated (unlink and link the branch again).

## Commands

| Command | Effect |
|---|---|
| `./transcendence start` | Start everything, building only what changed |
| `./transcendence stop` | Stop and remove the containers (the data is kept) |
| `./transcendence restart` | Stop, then start |
| `./transcendence reload` | Rebuild only the frontend and refresh what nginx serves |
| `./transcendence oauth` | Enter the GitHub OAuth credentials again |
| `./transcendence clean` | Remove build leftovers; running images and the database are kept |
| `--no-cache` (after a command) | Rebuild the images from scratch |

Plain `docker compose up` is not enough on a fresh clone: it needs the `.env`, the encryption key and the certificate
that the script prepares.

## What runs

| Service | Image | Role | Reachable from the host |
|---|---|---|---|
| `nginx` | nginx 1.27 | HTTPS, static frontend, proxy of `/api/` and `/socket.io/` | ports 8443 (https) and 8080 (redirect) |
| `backend` | built from `backend/` (Node.js 22) | API and Socket.IO | no, only through nginx |
| `db` | PostgreSQL 16 | Data | no (to open a shell: `docker compose exec db psql -U "$POSTGRES_USER" "$POSTGRES_DB"`) |
| `frontend` | built from `frontend/` | Builds the pages and copies them into the volume nginx serves, then exits | no |

Volumes: `db_data` (database), `uploads_data` (uploaded files), `frontend_dist` (built pages).
`docker compose down -v` deletes them, and with them **all the data**.

## HTTPS and security

The subject requires every connection from a browser, a script or an external service to use HTTPS. Here:

- nginx is the only way in. `http://` answers `308` to `https://` (the method and body are kept for scripts).
  TLS 1.2 and 1.3 only, session tickets off, version hidden.
- Pages come with `Content-Security-Policy` (scripts, fonts and connections from this origin only, nothing may frame
  the app), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. There is no inline
  script, and Excalidraw's fonts and chunks are served from `/excalidraw-assets/` (not from a CDN), so the app works
  without Internet access and under that policy.
- The browser's WebSocket is `wss://` (Socket.IO uses the page's origin) through nginx.
- The GitHub callback URL is `https://`, and the OAuth state cookie is `Secure`.
- Between containers (nginx to backend, backend to database) traffic is plain, on a private Docker network that is not
  published on the host: the subject allows it.
- nginx tells the backend the real client address (`X-Forwarded-For`, overwritten, never appended) and the backend
  trusts it only from the private network (`trustProxy`), so per-client rate limits really are per client.
- `Strict-Transport-Security` is deliberately not sent: the browser would remember it for the whole host `localhost`,
  with a self-signed certificate. In a real deployment, with a real certificate, add it in
  `infra/nginx/default.conf.template` (the line is there as a comment).

## GitHub login and the Git integration

1. Create an OAuth App on <https://github.com/settings/developers>. Its callback URL must be exactly
   `GITHUB_OAUTH_REDIRECT_URI` from `.env` (default `https://localhost:8443/api/auth/oauth/github/callback`).
2. Run `./transcendence oauth` and enter its client id and secret.
3. For the repository webhook to be registered automatically when a card is linked to a branch, GitHub must reach the
   app: set `WEBHOOK_PUBLIC_URL` to the public https address of your deployment. On localhost leave it empty and add the
   webhook by hand if you want to test it (see `docs/api-spec.md`, "Git integration").

## Troubleshooting

- **"port is already allocated"**: another program uses 8080 or 8443. Change `HTTP_PORT` and `HTTPS_PORT` in `.env`,
  and the port in `GITHUB_OAUTH_REDIRECT_URI`.
- **The browser warns about the certificate**: expected, it is self-signed. Delete `infra/nginx/certs/` to generate a
  new one on the next start.
- **502 page**: the backend is not up yet or crashed: `docker compose logs backend`. A missing or malformed variable is
  reported by name at startup.
- **Start over from nothing**: `./transcendence stop && docker compose down -v`, then `./transcendence start`.
