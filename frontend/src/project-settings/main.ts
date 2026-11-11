// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the /app/:id/settings entry point.
import { boot } from "../shared/boot";
import ProjectSettings from "./ProjectSettings.svelte";

const projectId = window.location.pathname.match(/^\/app\/([^/]+)\/settings\/?$/)?.[1];

if (!projectId) {
  window.location.replace("/app");
} else {
  boot(ProjectSettings, { auth: "required", props: { projectId } });
}
