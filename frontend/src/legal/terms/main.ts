// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the /legal/terms entry point.
import { boot } from "../../shared/boot";
import LegalPage from "../LegalPage.svelte";
import { termsOfService } from "../termsOfService";

boot(LegalPage, { footer: false, props: { versions: termsOfService, other: { href: "/legal/privacy", label: "footer.privacy" } } });
