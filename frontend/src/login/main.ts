// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the /login entry point.
import { boot } from "../shared/boot";
import Login from "./Login.svelte";

boot(Login, { auth: "guest", footer: false });
