// The public API documentation (/api-docs, also reached from /api/docs). Public page: no session needed.
import { boot } from "../shared/boot";
import ApiDocs from "./ApiDocs.svelte";

boot(ApiDocs, { auth: "none" });
