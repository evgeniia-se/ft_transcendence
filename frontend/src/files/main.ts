// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the /app/:id/files entry point.
import { boot } from "../shared/boot";
import Files from "./Files.svelte";

const projectId = window.location.pathname.match(/^\/app\/([^/]+)\/files\/?$/)?.[1];

if (!projectId) {
	window.location.replace("/app");
} else {
	boot(Files, { //pass the projectId to the Files.svelte
        auth: "required", 
        props: { projectId } });
}