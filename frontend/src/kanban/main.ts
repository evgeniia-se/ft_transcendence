// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Responsible for: the /app/:id entry point.
import { boot } from "../shared/boot";
import App from "./App.svelte";
import { BoardStore } from "./boardStore.svelte";

const projectId = window.location.pathname.match(/^\/app\/([^/]+)\/?$/)?.[1];

if (!projectId) {
  window.location.replace("/app");
} else {
  boot(App, { auth: "required", props: { store: new BoardStore(projectId) } });
}
