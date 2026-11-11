// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the /forgot-password entry point.
// The backend has no reset endpoint yet, so the page only explains the options.
import { boot } from "../shared/boot";
import ForgotPassword from "./ForgotPassword.svelte";

boot(ForgotPassword, { auth: "guest", footer: false });
