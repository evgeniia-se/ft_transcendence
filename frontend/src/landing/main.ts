// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the / entry point (landing page).
import { boot } from "../shared/boot";
import Landing from "./Landing.svelte";

boot(Landing, { footer: false });
