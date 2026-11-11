// Owner: Track 1 (Foundation, Auth, and API infrastructure)
// Responsible for: the admin page that opens/closes signup. It is protected by SIGNUP_ADMIN_PASSWORD (.env), not by
// a user account, so it still works when nobody can sign up. Without that variable the endpoint answers 404.

import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { isSignupOpen, setSignupOpen } from "../auth/signupGate.js";

// 5 tries a minute per client address: the password is the only thing standing between the internet and the switch
const ADMIN_RATE_LIMIT = { max: 5, timeWindow: "1 minute" } as const;

const PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Inscriptions</title>
<style>
:root{--bg:#f5f2ec;--surface:#fbf9f5;--line:#e2dccf;--line-strong:#cdc6b6;--text:#24221e;--text-soft:#5d584d;--text-faint:#857f72;
--accent:#3b6b52;--accent-strong:#2b5440;--accent-soft:#e1ebe4;--on-accent:#fff;--danger:#a5412c;--danger-soft:#f5e3dd;
--shadow:0 4px 14px rgba(60,50,30,.10),0 1px 3px rgba(60,50,30,.06);color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#171614;--surface:#1f1e1b;--line:#34322c;--line-strong:#47443c;--text:#ece7dd;
--text-soft:#b3ac9c;--text-faint:#867f71;--accent:#8fbfa5;--accent-strong:#a9d3bc;--accent-soft:#233229;--on-accent:#0f1f18;
--danger:#e38d77;--danger-soft:#3a2420;--shadow:0 4px 14px rgba(0,0,0,.4)}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;background:var(--bg);color:var(--text);
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.5}
main{width:100%;max-width:24rem;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:2rem;box-shadow:var(--shadow)}
.kicker{margin:0;font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint)}
h1{margin:.25rem 0 1.25rem;font-size:1.5rem;font-weight:650;letter-spacing:-.01em}
.status{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem 1rem;margin-bottom:1.5rem;
border:1px solid var(--line);border-radius:10px;color:var(--text-soft);font-size:.95rem}
#state{display:inline-flex;align-items:center;gap:.4rem;padding:.2rem .65rem;border-radius:999px;font-weight:600;font-size:.85rem;
background:var(--line);color:var(--text-soft)}
#state::before{content:"";width:.5rem;height:.5rem;border-radius:50%;background:currentColor}
#state[data-open="true"]{background:var(--accent-soft);color:var(--accent-strong)}
#state[data-open="false"]{background:var(--danger-soft);color:var(--danger)}
label{display:block;font-size:.875rem;font-weight:600;margin-bottom:.4rem}
input,button{font:inherit;width:100%;border-radius:10px}
input{padding:.65rem .8rem;background:var(--bg);color:var(--text);border:1px solid var(--line-strong)}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
button{margin-top:1rem;padding:.7rem;border:0;font-weight:600;cursor:pointer;background:var(--accent);color:var(--on-accent);transition:background .15s}
button:hover{background:var(--accent-strong)}
button:disabled{opacity:.6;cursor:default}
button[data-action="close"]{background:var(--danger);color:#fff}
button[data-action="close"]:hover{filter:brightness(.92)}
#msg{min-height:1.5rem;margin:1rem 0 0;font-size:.9rem;color:var(--text-soft)}
#msg[data-kind="error"]{color:var(--danger)}
#msg[data-kind="ok"]{color:var(--accent)}
</style></head>
<body><main>
<p class="kicker">Administration</p>
<h1>Inscriptions</h1>
<div class="status"><span>État actuel</span><span id="state">…</span></div>
<form id="f"><label for="pw">Mot de passe admin</label>
<input id="pw" type="password" autocomplete="current-password" required>
<button type="submit" id="toggle" disabled>…</button></form>
<p id="msg" role="status"></p>
</main><script src="/api/admin/signup.js"></script></body></html>`;

const SCRIPT = `(() => {
	const state = document.getElementById("state"), toggle = document.getElementById("toggle");
	const pw = document.getElementById("pw"), msg = document.getElementById("msg");
	let open = null;
	const say = (text, kind) => { msg.textContent = text; msg.dataset.kind = kind || ""; };
	const render = () => {
		if (open === null) return;
		state.dataset.open = String(open);
		state.textContent = open ? "Ouvertes" : "Fermées";
		toggle.dataset.action = open ? "close" : "open";
		toggle.textContent = open ? "Fermer les inscriptions" : "Ouvrir les inscriptions";
		toggle.disabled = false;
	};
	fetch("/api/auth/signup-status").then((r) => r.json()).then((s) => { open = s.open; render(); }).catch(() => say("Serveur injoignable.", "error"));
	document.getElementById("f").addEventListener("submit", async (e) => {
		e.preventDefault();
		if (open === null) return;
		say("");
		toggle.disabled = true;
		try {
			const r = await fetch("/api/admin/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw.value, open: !open }) });
			if (r.status === 429) say("Trop de tentatives, patientez une minute.", "error");
			else if (r.status === 401) say("Mot de passe incorrect.", "error");
			else if (!r.ok) say("Action impossible.", "error");
			else { open = (await r.json()).open; pw.value = ""; say(open ? "Inscriptions ouvertes." : "Inscriptions fermées.", "ok"); }
		} catch { say("Serveur injoignable.", "error"); }
		render();
	});
})();`;

function passwordMatches(given: unknown, expected: string): boolean {
	if (typeof given !== "string") return false;
	// hashing first gives both sides the same length, which timingSafeEqual requires, and hides the real length
	const a = createHash("sha256").update(given).digest();
	const b = createHash("sha256").update(expected).digest();
	return timingSafeEqual(a, b);
}

export async function registerAdminRoutes(app: FastifyInstance, opts: { signupAdminPassword: string }): Promise<void> {
	if (!opts.signupAdminPassword) return;

	app.get("/signup", async (_request, reply) => {
		reply.header("Cache-Control", "no-store").type("text/html; charset=utf-8").send(PAGE);
	});
	app.get("/signup.js", async (_request, reply) => {
		reply.header("Cache-Control", "no-store").type("application/javascript; charset=utf-8").send(SCRIPT);
	});
	app.post("/signup", { config: { rateLimit: ADMIN_RATE_LIMIT } }, async (request, reply) => {
		const body = request.body as { password?: unknown; open?: unknown } | undefined;
		if (!passwordMatches(body?.password, opts.signupAdminPassword)) {
			request.log.warn("admin signup switch: wrong password");
			reply.code(401).send({ error: "unauthorized" });
			return;
		}
		if (typeof body?.open !== "boolean") {
			reply.code(400).send({ error: "invalid_input" });
			return;
		}
		await setSignupOpen(body.open);
		request.log.warn({ open: body.open }, "signup switched by admin");
		reply.send({ open: await isSignupOpen() });
	});
}
