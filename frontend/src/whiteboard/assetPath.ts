// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: telling Excalidraw to load its fonts and chunks from this app instead of unpkg.com.
// Excalidraw reads window.EXCALIDRAW_ASSET_PATH when its module is first evaluated, so this file must be imported
// BEFORE "@excalidraw/excalidraw" (ES modules run in import order). The files are served at /excalidraw-assets/ by the
// build (vite.config.ts, plugin excalidrawAssets).
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = "/";
