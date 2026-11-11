<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { getProject } from "../api/projectsApi";
	import type { Project } from "../api/types";
	import { theme } from "../shared/theme.svelte";
	import { i18n, t } from "../shared/i18n.svelte";
	import AppHeader from "../shared/ui/AppHeader.svelte";
	import type { WhiteboardHandle, WhiteboardTheme } from "./mountWhiteboard";

	const { projectId }: { projectId: string } = $props();

	let host: HTMLDivElement;
	let handle: WhiteboardHandle | null = null;
	let project = $state<Project | null>(null);

	function resolvedTheme(): WhiteboardTheme {
		if (theme.pref !== "system") return theme.pref;
		return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}

	$effect(() => {
		document.title = project ? `${t("nav.whiteboard")} · ${project.name} — Transcendance` : `${t("nav.whiteboard")} — Transcendance`;
	});

	//follow the app theme (also when it is "system" and the OS preference changes) and the interface language
	$effect(() => {
		void theme.pref;
		void i18n.lang;
		handle?.setTheme(resolvedTheme());
	});

	onMount(async () => {
		void getProject(projectId)
			.then((p) => (project = p))
			.catch(() => {});

		//React and Excalidraw are heavy: load them only once the page shell is up
		const { mountWhiteboard } = await import("./mountWhiteboard");
		handle = await mountWhiteboard(host, projectId, resolvedTheme());
	});

	onDestroy(() => handle?.destroy());
</script>

<div class="screen">
	<AppHeader project={project ?? undefined} active="whiteboard" />
	<div class="board" bind:this={host}></div>
</div>

<style>
	.screen {
		display: flex;
		flex-direction: column;
		height: calc(100vh - var(--footer-h, 0px));
		height: calc(100dvh - var(--footer-h, 0px));
	}
	.board {
		flex: 1;
		min-height: 0;
		position: relative;
	}
</style>
