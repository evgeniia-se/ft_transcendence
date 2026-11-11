// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: the React side of the whiteboard page — Excalidraw, autosave over HTTP and live
// collaboration (scene deltas + cursors) over the project's Socket.IO connection. Mounted from Whiteboard.svelte.
import "./assetPath"; // first: it must run before Excalidraw is evaluated
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type { BinaryFileData, BinaryFiles, Collaborator, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { apiRequest, ApiError } from "../api/apiClient";
import { createSocketConnection, type SocketConnection } from "../api/wsClientWrapper";
import { getStoredToken, clearAuthSession } from "../auth/authClient";
import { loginUrl } from "../shared/session";
import { i18n, t } from "../shared/i18n.svelte";
import "./suppressUnload";

//Checked against the installed package: Excalidraw 0.17 ships its CSS inside the bundle, so there is
//no "@excalidraw/excalidraw/index.css" to import — that entry only exists from 0.18 on.

const SAVE_DELAY_MS = 1000;
const POINTER_THROTTLE_MS = 40;
//An image element can reach a client before its file is uploaded: ask again a few times before giving up.
const FILE_FETCH_ATTEMPTS = 6;
const FILE_RETRY_DELAY_MS = 1500;

export type WhiteboardTheme = "light" | "dark";

interface SceneResponse {
	whiteboard: { sceneJson?: { elements?: ExcalidrawElement[] } } | null;
}

interface PointerEvent {
	userId: string;
	name: string;
	pointer: { x: number; y: number; tool: "pointer" | "laser" };
	button: "up" | "down";
}

type LoadResult =
	| { kind: "ready"; elements: ExcalidrawElement[] }
	| { kind: "error"; message: string };

async function loadScene(projectId: string): Promise<LoadResult> {
	try {
		const body = await apiRequest<SceneResponse>({
			method: "GET",
			path: `/whiteboards/${projectId}`,
		});
		//whiteboard === null means nothing has been saved for this project yet, so an empty board is correct.
		const elements = body.whiteboard?.sceneJson?.elements;
		return { kind: "ready", elements: Array.isArray(elements) ? elements : [] };
	} catch (error) {
		//A failed load must NOT fall back to an empty board: autosave would then overwrite what is stored.
		const message =
			error instanceof ApiError && error.status === 403
				? t("whiteboard.noAccess")
				: t("whiteboard.loadFailed");
		return { kind: "error", message };
	}
}

//Merge remote elements into the local scene. Same rule as Excalidraw's own reconciliation: the higher
//version wins, and on a tie the lower versionNonce does, so every client converges on the same result.
//An element the local user is dragging or editing right now is never replaced under their hands.
function mergeElements(
	local: readonly ExcalidrawElement[],
	remote: readonly ExcalidrawElement[],
	busyIds: ReadonlySet<string>,
): ExcalidrawElement[] {
	const merged = [...local];
	const indexById = new Map(merged.map((element, index) => [element.id, index]));

	for (const incoming of remote) {
		const index = indexById.get(incoming.id);
		if (index === undefined) {
			indexById.set(incoming.id, merged.length);
			merged.push(incoming);
			continue;
		}
		const current = merged[index];
		if (busyIds.has(incoming.id)) continue;
		if (
			incoming.version > current.version ||
			(incoming.version === current.version && incoming.versionNonce < current.versionNonce)
		) {
			merged[index] = incoming;
		}
	}
	return merged;
}

interface WhiteboardAppProps {
	projectId: string;
	initialElements: ExcalidrawElement[];
	theme: WhiteboardTheme;
}

function WhiteboardApp({ projectId, initialElements, theme }: WhiteboardAppProps) {
	const saveTimer = useRef<number | undefined>(undefined);
	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const socketRef = useRef<SocketConnection | null>(null);
	//id -> last version this client has sent or received, so only real changes go over the wire
	const knownVersions = useRef(new Map<string, number>(initialElements.map((e) => [e.id, e.version])));
	const collaborators = useRef(new Map<string, Collaborator>());
	const lastPointerAt = useRef(0);
	const readOnlyRef = useRef(false);
	//file ids the server already has (uploaded by us or fetched from it), and those being fetched right now
	const knownFiles = useRef(new Set<string>());
	const fetchingFiles = useRef(new Set<string>());
	const [readOnly, setReadOnly] = useState(false);

	function switchToReadOnly(): void {
		readOnlyRef.current = true;
		setReadOnly(true);
	}

	useEffect(() => {
		const token = getStoredToken();
		if (!token) {
			window.location.href = loginUrl();
			return;
		}
		const socket = createSocketConnection(window.location.origin, token);
		socketRef.current = socket;

		socket.onConnect(() => {
			//rooms live on the server-side socket, so every (re)connect has to join again
			socket.emit("join_whiteboard", projectId);
		});

		socket.onConnectError((error) => {
			if (error.message === "unauthorized" || error.message === "token_expired") {
				clearAuthSession();
				window.location.href = loginUrl();
			}
		});

		socket.onAny((event, payload) => {
			const api = apiRef.current;
			if (!api) return;

			if (event === "whiteboard_joined") {
				//In the room now. Everything that happened before this point (while offline, or between the
				//first load and the join) was not relayed: catch up from the saved scene.
				void resync(api);
			} else if (event === "whiteboard_update") {
				const remote = (payload as { elements?: ExcalidrawElement[] }).elements;
				if (!Array.isArray(remote)) return;
				applyRemote(api, remote);
			} else if (event === "whiteboard_pointer") {
				const data = payload as PointerEvent;
				collaborators.current.set(data.userId, {
					pointer: data.pointer,
					button: data.button,
					username: data.name,
					id: data.userId,
				});
				api.updateScene({ collaborators: new Map(collaborators.current) });
			} else if (event === "whiteboard_left") {
				collaborators.current.delete((payload as { userId: string }).userId);
				api.updateScene({ collaborators: new Map(collaborators.current) });
			}
		});

		return () => {
			window.clearTimeout(saveTimer.current);
			socket.disconnect();
			socketRef.current = null;
		};
	}, [projectId]);

	//Excalidraw keeps image pixels out of the elements: an image element only has a fileId. Upload new files
	//so the other members (and a refresh) can get them.
	function uploadNewFiles(elements: readonly ExcalidrawElement[], files: BinaryFiles): void {
		if (readOnlyRef.current) return;
		for (const element of elements) {
			if (element.type !== "image" || element.isDeleted || !element.fileId) continue;
			const file = files[element.fileId];
			if (!file || knownFiles.current.has(file.id)) continue;

			knownFiles.current.add(file.id);
			apiRequest<unknown>({
				method: "PUT",
				path: `/whiteboards/${projectId}/files/${encodeURIComponent(file.id)}`,
				body: { dataURL: file.dataURL },
			}).catch(() => knownFiles.current.delete(file.id));//forgotten, so the next change retries
		}
	}

	//Download the files of image elements this client does not have yet.
	function fetchMissingFiles(api: ExcalidrawImperativeAPI, elements: readonly ExcalidrawElement[]): void {
		const have = api.getFiles();
		for (const element of elements) {
			if (element.type !== "image" || element.isDeleted || !element.fileId) continue;
			const fileId = element.fileId;
			if (have[fileId] || fetchingFiles.current.has(fileId)) continue;

			fetchingFiles.current.add(fileId);
			void fetchFile(fileId)
				.then((file) => {
					if (!file) return;
					knownFiles.current.add(fileId);
					api.addFiles([file]);
				})
				.finally(() => fetchingFiles.current.delete(fileId));
		}
	}

	async function fetchFile(fileId: string): Promise<BinaryFileData | null> {
		for (let attempt = 0; attempt < FILE_FETCH_ATTEMPTS; attempt++) {
			try {
				const body = await apiRequest<{ file: BinaryFileData }>({
					method: "GET",
					path: `/whiteboards/${projectId}/files/${encodeURIComponent(fileId)}`,
				});
				return body.file;
			} catch (error) {
				//404: the sender is probably still uploading. Anything else will not fix itself.
				if (!(error instanceof ApiError) || error.status !== 404) return null;
			}
			await new Promise((resolve) => window.setTimeout(resolve, FILE_RETRY_DELAY_MS));
		}
		return null;
	}

	//Merge elements that came from elsewhere into the board. restoreElements repairs or drops anything malformed.
	function applyRemote(api: ExcalidrawImperativeAPI, remote: readonly ExcalidrawElement[]): void {
		const restored = restoreElements(remote as ExcalidrawElement[], null);
		const appState = api.getAppState();
		const busyIds = new Set<string>(
			[appState.editingElement?.id, appState.draggingElement?.id, appState.resizingElement?.id].filter(
				(id): id is string => typeof id === "string",
			),
		);
		for (const element of restored) knownVersions.current.set(element.id, element.version);
		api.updateScene({ elements: mergeElements(api.getSceneElementsIncludingDeleted(), restored, busyIds) });
		fetchMissingFiles(api, restored);
	}

	//Catch up with the saved scene, then push whatever this client has that the saved scene lacks (drawn offline).
	async function resync(api: ExcalidrawImperativeAPI): Promise<void> {
		const saved = await loadScene(projectId);
		if (saved.kind === "error") return;//the next reconnect tries again

		applyRemote(api, saved.elements);
		if (readOnlyRef.current) return;

		const savedVersions = new Map(saved.elements.map((element) => [element.id, element.version]));
		const local = api.getSceneElementsIncludingDeleted();
		const ahead = local.filter((element) => savedVersions.get(element.id) !== element.version);
		if (ahead.length === 0) return;
		//forget them so broadcastChanges sends them, then let autosave persist the merged result
		for (const element of ahead) knownVersions.current.delete(element.id);
		broadcastChanges(local);
		window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => void saveScene(local), SAVE_DELAY_MS);
	}

	//send only the elements whose version moved since the last time this client sent or received them
	//Returns whether this client changed anything: changes that came from elsewhere are already known.
	function broadcastChanges(elements: readonly ExcalidrawElement[]): boolean {
		const changed = elements.filter((element) => knownVersions.current.get(element.id) !== element.version);
		if (changed.length === 0) return false;
		for (const element of changed) knownVersions.current.set(element.id, element.version);
		socketRef.current?.emit("whiteboard_update", { elements: changed });
		return true;
	}

	//saveScene sends the current scene, erased shapes included: the server keeps them as tombstones and
	//merges the save into the stored scene, so a client that is behind cannot wipe out a newer change.
	async function saveScene(elements: readonly ExcalidrawElement[]): Promise<void> {
		try {
			await apiRequest<unknown>({
				method: "PUT",
				path: `/whiteboards/${projectId}`,
				body: { sceneJson: { elements } },
			});
		} catch (error) {
			//Viewers may open the board but not save it: stop retrying and switch the board to view mode.
			if (error instanceof ApiError && error.status === 403) {
				switchToReadOnly();
			}
			//any other failure: keep drawing, the next save retries
		}
	}

	// onChange fires on every change (even mouse moves). Local changes go out live; the HTTP save waits until
	// the user has stopped for SAVE_DELAY_MS.
	function handleChange(elements: readonly ExcalidrawElement[], _appState: unknown, files: BinaryFiles): void {
		if (readOnlyRef.current) return;
		uploadNewFiles(elements, files);
		//only the author of a change saves it; everyone saving every remote update would just be noise
		if (!broadcastChanges(elements)) return;
		window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => void saveScene(elements), SAVE_DELAY_MS);
	}

	function handlePointer(payload: {
		pointer: { x: number; y: number; tool: "pointer" | "laser" };
		button: "up" | "down";
	}): void {
		const now = Date.now();
		if (now - lastPointerAt.current < POINTER_THROTTLE_MS) return;
		lastPointerAt.current = now;
		socketRef.current?.emit("whiteboard_pointer", { ...payload.pointer, button: payload.button });
	}

	return (
		<Excalidraw
			theme={theme}
			langCode={excalidrawLang()}
			initialData={{ elements: initialElements }}
			viewModeEnabled={readOnly}
			isCollaborating
			excalidrawAPI={(api) => {
				apiRef.current = api;
				//images already on the saved board: their pixels are not part of the scene
				fetchMissingFiles(api, initialElements);
			}}
			onChange={handleChange}
			onPointerUpdate={handlePointer}
		/>
	);
}

//Excalidraw names its languages with a region (fr-FR, ja-JP), except English
const EXCALIDRAW_LANGS: Record<string, string> = { en: "en", fr: "fr-FR", ja: "ja-JP", ru: "ru-RU", zh: "zh-CN" };
function excalidrawLang(): string {
	return EXCALIDRAW_LANGS[i18n.lang] ?? `${i18n.lang}-${i18n.lang.toUpperCase()}`;
}

export interface WhiteboardHandle {
	//re-renders with this theme and the current interface language
	setTheme: (theme: WhiteboardTheme) => void;
	destroy: () => void;
}

//replace the board with a plain message — used when there is no board to show at all.
function showMessage(host: HTMLElement, message: string): void {
	const paragraph = document.createElement("p");
	paragraph.textContent = message;
	paragraph.style.cssText = "padding:2rem;text-align:center;color:var(--text-soft)";
	host.replaceChildren(paragraph);
}

//Load before mounting, so nothing can be drawn — and therefore nothing can be overwritten —
//until the saved scene is in hand. Resolves with null when there is no board to show.
export async function mountWhiteboard(
	host: HTMLElement,
	projectId: string,
	initialTheme: WhiteboardTheme,
): Promise<WhiteboardHandle | null> {
	const result = await loadScene(projectId);
	if (result.kind === "error") {
		showMessage(host, result.message);
		return null;
	}

	const root = createRoot(host);
	const render = (theme: WhiteboardTheme): void =>
		root.render(
			<StrictMode>
				<WhiteboardApp projectId={projectId} initialElements={result.elements} theme={theme} />
			</StrictMode>,
		);
	render(initialTheme);

	return { setTheme: render, destroy: () => root.unmount() };
}
