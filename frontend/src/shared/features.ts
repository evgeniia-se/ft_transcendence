// Disabled pages. Remove a name to bring its tab back.
export type ProjectPage = "notes" | "whiteboard";

export const DISABLED_PAGES: ReadonlySet<ProjectPage> = new Set<ProjectPage>([]);

export const isPageEnabled = (page: string): boolean => !DISABLED_PAGES.has(page as ProjectPage);
