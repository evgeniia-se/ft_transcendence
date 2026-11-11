// Owner: Track 2 (Person A — Kanban CRUD and UI)
// Svelte compiler config: vitePreprocess lets Svelte components use TypeScript through
// <script lang="ts"> inside .svelte components.
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
};
