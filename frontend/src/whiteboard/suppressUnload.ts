// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: dropping the `unload` listener that Excalidraw registers.
//
// Chrome has deprecated `unload` and refuses it, reporting every registration as a console
// violation. The subject requires a console free of warnings and errors, and the listener lives
// inside Excalidraw's own bundle, so it cannot be removed at the source — upgrading to 0.18.1 does
// not help, it still registers one. Nothing on this page relies on `unload`, so the registration is
// dropped here. This module is imported before Excalidraw so the patch is in place by the time its
// module code runs.
const register = window.addEventListener.bind(window);

window.addEventListener = function patchedAddEventListener(
	type: string,
	listener: EventListenerOrEventListenerObject,
	options?: boolean | AddEventListenerOptions,
): void {
	if (type === "unload") return;
	register(type, listener, options);
} as typeof window.addEventListener;