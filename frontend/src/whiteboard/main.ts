// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the /app/:id/whiteboard entry point.
import { boot } from "../shared/boot";
import Whiteboard from "./Whiteboard.svelte";

//the route is /app/:id/whiteboard (see docs/frontend-routing.md)
const projectId = window.location.pathname.match(/^\/app\/([^/]+)\/whiteboard\/?$/)?.[1];

if (!projectId) {
	window.location.replace("/app");
} else {
	boot(Whiteboard, { auth: "required", props: { projectId } });
}
