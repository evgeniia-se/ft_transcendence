// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the /signup entry point.
import { boot } from "../shared/boot";
import Signup from "./Signup.svelte";

boot(Signup, { auth: "guest", footer: false });
