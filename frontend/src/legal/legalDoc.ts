// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: rendering a legal page (terms, privacy) in the interface language.
import { i18n, type Lang } from "../shared/i18n.svelte";

export interface LegalSection {
	title: string;
	paragraphs: string[];
}

export interface LegalDoc {
	title: string;
	updated: string;
	sections: LegalSection[];
}

// English is the original text: a language without its own version shows it
export type LegalVersions = Partial<Record<Lang, LegalDoc>> & { en: LegalDoc };

export function currentVersion(versions: LegalVersions): LegalDoc {
	return versions[i18n.lang] ?? versions.en;
}

// renderLegalDoc mounts the page content (plain text nodes, no HTML)
export function renderLegalDoc(container: HTMLElement, doc: LegalDoc): void {
	container.textContent = "";

	const title = document.createElement("h1");
	title.textContent = doc.title;
	container.append(title);

	const updated = document.createElement("p");
	updated.className = "updated";
	updated.textContent = doc.updated;
	container.append(updated);

	for (const section of doc.sections) {
		const heading = document.createElement("h2");
		heading.textContent = section.title;
		container.append(heading);

		for (const text of section.paragraphs) {
			const paragraph = document.createElement("p");
			paragraph.textContent = text;
			container.append(paragraph);
		}
	}
}
