import { boot } from "../shared/boot";
import Search from "./Search.svelte";

const projectId = window.location.pathname.match(/^\/app\/([^/]+)\/search\/?$/)?.[1];

if (!projectId) {
  window.location.replace("/app");
} else {
  boot(Search, { auth: "required", props: { projectId } });
}
