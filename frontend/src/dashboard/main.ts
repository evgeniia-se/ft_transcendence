// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the /app entry point (login required).
import { boot } from "../shared/boot";
import Dashboard from "./Dashboard.svelte";

boot(Dashboard, { auth: "required" });
