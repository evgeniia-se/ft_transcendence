// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the /settings entry point.
import { boot } from "../shared/boot";
import Settings from "./Settings.svelte";

boot(Settings, { auth: "required" });
