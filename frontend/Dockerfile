# Owner: Track 1

# --- build stage ---
FROM node:22-bookworm AS builder
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime stage ---
# Not a server: this image only carries the built static files. docker-compose.yml
# overrides the command to copy /usr/share/nginx/html into the shared frontend_dist
# volume and exit — the nginx service is what actually serves them. Base is nginx:1.27
# purely so the layer is already cached by the nginx service (no extra image pull).
FROM nginx:1.27

COPY --from=builder /app/dist /usr/share/nginx/html
