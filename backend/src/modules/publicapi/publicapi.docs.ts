// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the documentation of the Public API served by the app itself (GET /api/docs for people,
// GET /api/openapi.json for tools), required by the Public API major module. One OpenAPI description feeds both.
import type { FastifyInstance, FastifyReply } from "fastify";
import { DEFAULT_PAGE_LIMIT, MAX_CARD_DESCRIPTION_LENGTH, MAX_CARD_TITLE_LENGTH, MAX_PAGE_LIMIT } from "./publicapi.validation.js";
import { MAX_RATE_LIMIT } from "./apikeys.service.js";

interface Parameter {
	name: string;
	in: "path" | "query";
	required: boolean;
	description: string;
	schema: { type: string; minimum?: number; maximum?: number; default?: number };
}

interface Operation {
	method: "get" | "post" | "put" | "delete";
	path: string;
	summary: string;
	description: string;
	parameters: Parameter[];
	body?: { description: string; example: Record<string, unknown> };
	success: { status: string; description: string; example?: unknown };
	errors: Record<string, string>;
}

const projectId: Parameter = { name: "projectId", in: "path", required: true, description: "Id of the project", schema: { type: "string" } };
const cardId: Parameter = { name: "cardId", in: "path", required: true, description: "Id of the card", schema: { type: "string" } };

const card = {
	id: "c0a8…",
	projectId: "7f3e…",
	listId: "5b21…",
	title: "Write the README",
	description: "Team, modules, stack",
	status: "todo",
	position: 0,
	linkedBranch: null,
	linkedPrUrl: null,
	createdAt: "2026-10-19T10:00:00.000Z",
	updatedAt: "2026-10-19T10:00:00.000Z",
};

const OPERATIONS: Operation[] = [
	{
		method: "get",
		path: "/api/projects",
		summary: "List your projects",
		description: "The projects the key's owner belongs to. A key restricted to one project only sees that one.",
		parameters: [],
		success: {
			status: "200",
			description: "The projects",
			example: { projects: [{ id: "7f3e…", name: "Apollo", ownerId: "a91d…", createdAt: "2026-10-01T09:00:00.000Z", updatedAt: "2026-10-01T09:00:00.000Z" }] },
		},
		errors: { "401": "missing_api_key / invalid_api_key", "429": "rate_limit_exceeded" },
	},
	{
		method: "get",
		path: "/api/projects/{projectId}/cards",
		summary: "List the cards of a project",
		description: "Ordered by list then position. Needs the viewer role or more.",
		parameters: [
			projectId,
			{ name: "listId", in: "query", required: false, description: "Only the cards of this list", schema: { type: "string" } },
			{ name: "status", in: "query", required: false, description: "Only the cards with this status (todo, In progress, PR pending, Done)", schema: { type: "string" } },
			{ name: "limit", in: "query", required: false, description: `Page size, 1 to ${MAX_PAGE_LIMIT}`, schema: { type: "integer", minimum: 1, maximum: MAX_PAGE_LIMIT, default: DEFAULT_PAGE_LIMIT } },
			{ name: "offset", in: "query", required: false, description: "Cards to skip", schema: { type: "integer", minimum: 0, default: 0 } },
		],
		success: { status: "200", description: "A page of cards and the total", example: { cards: [card], total: 1, limit: DEFAULT_PAGE_LIMIT, offset: 0 } },
		errors: { "400": "invalid_input (bad query parameter)", "401": "missing_api_key / invalid_api_key", "403": "insufficient_role / api_key_project_mismatch", "429": "rate_limit_exceeded" },
	},
	{
		method: "post",
		path: "/api/projects/{projectId}/cards",
		summary: "Create a card",
		description: "The card is added at the end of the list. Needs the member role or more. Everybody on the project sees it live and is notified.",
		parameters: [projectId],
		body: {
			description: `listId (required), title (required, at most ${MAX_CARD_TITLE_LENGTH} characters), description (optional, at most ${MAX_CARD_DESCRIPTION_LENGTH})`,
			example: { listId: "5b21…", title: "Write the README", description: "Team, modules, stack" },
		},
		success: { status: "201", description: "The created card", example: { card } },
		errors: { "400": "invalid_input", "401": "missing_api_key / invalid_api_key", "403": "insufficient_role / api_key_project_mismatch", "404": "list_not_found (also for a list of another project)", "429": "rate_limit_exceeded" },
	},
	{
		method: "put",
		path: "/api/projects/{projectId}/cards/{cardId}",
		summary: "Update a card",
		description: "Partial update: only the fields sent change, at least one is required. Needs the member role or more.",
		parameters: [projectId, cardId],
		body: { description: "title and/or description (same limits as on creation)", example: { title: "README final" } },
		success: { status: "200", description: "The updated card", example: { card: { ...card, title: "README final" } } },
		errors: { "400": "invalid_input", "401": "missing_api_key / invalid_api_key", "403": "insufficient_role / api_key_project_mismatch", "404": "card_not_found (also for a card of another project)", "429": "rate_limit_exceeded" },
	},
	{
		method: "delete",
		path: "/api/projects/{projectId}/cards/{cardId}",
		summary: "Delete a card",
		description: "Needs the member role or more.",
		parameters: [projectId, cardId],
		success: { status: "204", description: "Deleted, no content" },
		errors: { "401": "missing_api_key / invalid_api_key", "403": "insufficient_role / api_key_project_mismatch", "404": "card_not_found (also for a card of another project)", "429": "rate_limit_exceeded" },
	},
];

//the machine-readable description (OpenAPI 3.0)
export function buildOpenApi(): Record<string, unknown> {
	const paths: Record<string, Record<string, unknown>> = {};
	for (const op of OPERATIONS) {
		paths[op.path] ??= {};
		paths[op.path][op.method] = {
			summary: op.summary,
			description: op.description,
			security: [{ ApiKeyAuth: [] }],
			parameters: op.parameters,
			...(op.body
				? { requestBody: { required: true, description: op.body.description, content: { "application/json": { example: op.body.example } } } }
				: {}),
			responses: {
				[op.success.status]: {
					description: op.success.description,
					...(op.success.example ? { content: { "application/json": { example: op.success.example } } } : {}),
				},
				...Object.fromEntries(Object.entries(op.errors).map(([status, text]) => [status, { description: text }])),
			},
		};
	}
	return {
		openapi: "3.0.3",
		info: {
			title: "ft_transcendence public API",
			version: "1.0.0",
			description:
				"Read and edit the Kanban cards of your projects from a script. Every request carries an API key in the X-API-Key header, issued by a project admin in the project settings (Clés API). A key acts as the user who issued it, with that user's role in each project.",
		},
		servers: [{ url: "/" }],
		components: { securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } } },
		paths,
	};
}

const escapeHtml = (value: unknown): string =>
	String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

//the same description as a readable page: no script, no external resource, so it works under the default CSP
export function renderDocsPage(): string {
	const json = (value: unknown) => escapeHtml(JSON.stringify(value, null, 2));
	const sections = OPERATIONS.map((op) => {
		const curl = [
			`curl -X ${op.method.toUpperCase()} "https://<host>${op.path.replace(/\{(\w+)\}/g, "<$1>")}"`,
			`  -H "X-API-Key: tk_..."`,
			...(op.body ? [`  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(op.body.example)}'`] : []),
		].join(" \\\n");
		const params = op.parameters.length
			? `<table><tr><th>Parameter</th><th>In</th><th>Description</th></tr>${op.parameters
					.map((p) => `<tr><td><code>${escapeHtml(p.name)}</code>${p.required ? " *" : ""}</td><td>${p.in}</td><td>${escapeHtml(p.description)}</td></tr>`)
					.join("")}</table>`
			: "";
		const errors = Object.entries(op.errors)
			.map(([status, text]) => `<li><code>${status}</code> ${escapeHtml(text)}</li>`)
			.join("");
		return `<section id="${op.method}-${escapeHtml(op.path)}">
<h3><span class="m ${op.method}">${op.method.toUpperCase()}</span> <code>${escapeHtml(op.path)}</code></h3>
<p><strong>${escapeHtml(op.summary)}.</strong> ${escapeHtml(op.description)}</p>
${params}
${op.body ? `<p>Body (JSON): ${escapeHtml(op.body.description)}</p><pre>${json(op.body.example)}</pre>` : ""}
<p>Success <code>${op.success.status}</code>: ${escapeHtml(op.success.description)}</p>
${op.success.example ? `<pre>${json(op.success.example)}</pre>` : ""}
<p>Errors:</p><ul>${errors}</ul>
<p>Example:</p><pre>${escapeHtml(curl)}</pre>
</section>`;
	}).join("\n");

	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Public API</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1d2330;--soft:#5b6475;--line:#d9dde5;--code:#f3f5f8}
@media (prefers-color-scheme:dark){:root{--bg:#14171f;--fg:#e6e9f0;--soft:#9aa3b5;--line:#2c3140;--code:#1d212c}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}
h1{margin-top:0}h2{margin-top:40px;border-bottom:1px solid var(--line);padding-bottom:6px}
section{border:1px solid var(--line);border-radius:10px;padding:4px 18px 10px;margin:18px 0}
code,pre{background:var(--code);border-radius:6px;font:14px ui-monospace,monospace}code{padding:1px 5px}
pre{padding:12px;overflow-x:auto}table{border-collapse:collapse;width:100%;margin:8px 0}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
.m{display:inline-block;min-width:64px;text-align:center;border-radius:6px;color:#fff;font:700 13px system-ui;padding:2px 8px}
.get{background:#1f7a4d}.post{background:#1d62c9}.put{background:#a05a00}.delete{background:#b3261e}
.soft{color:var(--soft)}
</style></head>
<body><main>
<h1>Public API</h1>
<p class="soft">Machine-readable version: <a href="/api/openapi.json">/api/openapi.json</a> (OpenAPI 3.0).</p>
<p>Read and edit the Kanban cards of your projects from a script. Everything goes through HTTPS.</p>

<h2>Authentication</h2>
<p>Every request carries an API key in the <code>X-API-Key</code> header. A project admin issues keys in the project
settings, under <em>Clés API</em>: the key is shown <strong>once</strong>, only its hash is stored, and it can be revoked at any time.
Keys look like <code>tk_…</code>.</p>
<p>A key acts as the user who issued it, with that user's role in each project (viewer reads, member also creates,
updates and deletes): if the user is demoted or removed, the key loses access at once. A key can also be restricted to
one project (<code>403 api_key_project_mismatch</code> elsewhere). Cards and lists of another project answer
<code>404</code>, never <code>403</code>, so ids cannot be probed.</p>

<h2>Rate limiting</h2>
<p>Each key has its own limit, in requests per minute (default set by the admin, from 1 to ${MAX_RATE_LIMIT}), counted over a one-minute window. Every
response carries <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code> (epoch seconds).
Over the limit:</p>
<pre>429 Too Many Requests
Retry-After: 37
{ "error": "rate_limit_exceeded", "limit": 100, "retryAfter": 37 }</pre>

<h2>Errors</h2>
<p>Always JSON: <code>{ "error": "&lt;code&gt;", "details": [ … ] }</code> (<code>details</code> lists what is wrong on a <code>400</code>).</p>

<h2>Endpoints</h2>
${sections}
</main></body></html>`;
}

//GET /api/docs and GET /api/openapi.json: public, the documentation holds no secret
export async function registerPublicApiDocsRoutes(app: FastifyInstance): Promise<void> {
	const page = renderDocsPage();
	const spec = buildOpenApi();
	app.get("/docs", async (_request, reply: FastifyReply) => reply.type("text/html; charset=utf-8").send(page));
	app.get("/openapi.json", async (_request, reply: FastifyReply) => reply.type("application/json").send(spec));
}
