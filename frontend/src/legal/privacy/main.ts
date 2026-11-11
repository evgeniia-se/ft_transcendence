// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the /legal/privacy entry point.
import { boot } from "../../shared/boot";
import LegalPage from "../LegalPage.svelte";
import { privacyPolicy } from "../privacyPolicy";

boot(LegalPage, { footer: false, props: { versions: privacyPolicy, other: { href: "/legal/terms", label: "footer.terms" } } });
