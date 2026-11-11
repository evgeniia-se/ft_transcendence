// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: live whiteboard collaboration over the Socket.IO hub — relays scene deltas and cursors
// between the members who have the whiteboard open. Persistence stays with the HTTP autosave.
import type { Socket } from "socket.io";
import { prisma } from "../../db/prisma/client.js";
import { ROLE_RANK, SOCKET_ROLE_TTL_MS, getUserRole, type Role } from "../permissions/roles.service.js";
import { whiteboardRoom } from "../kanban/rooms.js";
import { MAX_ELEMENTS_PER_MESSAGE, validateElements } from "./whiteboard.elements.js";

//Per-socket limits: a token bucket for scene updates, a minimum gap between cursor updates.
const UPDATE_BURST = 40;
const UPDATE_REFILL_PER_SEC = 20;
const POINTER_MIN_GAP_MS = 20;


interface JoinedWhiteboard {
	projectId: string;
	role: Role;
	name: string;
	checkedAt: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// registerWhiteboardEvents wires the whiteboard events onto an already authenticated socket
// (socket.data.userId is set by the hub's handshake middleware).
export function registerWhiteboardEvents(socket: Socket): void {
	let tokens = UPDATE_BURST;
	let refilledAt = Date.now();
	let lastPointerAt = 0;

	const takeUpdateToken = (): boolean => {
		const now = Date.now();
		tokens = Math.min(UPDATE_BURST, tokens + ((now - refilledAt) / 1000) * UPDATE_REFILL_PER_SEC);
		refilledAt = now;
		if (tokens < 1) return false;
		tokens -= 1;
		return true;
	};

	// The role is read at join and again every SOCKET_ROLE_TTL_MS: a member who is demoted stops being able to
	// draw, and one who is removed is taken out of the room, without having to reconnect.
	const currentRole = async (joined: JoinedWhiteboard): Promise<Role | null> => {
		if (Date.now() - joined.checkedAt < SOCKET_ROLE_TTL_MS) return joined.role;
		const role = await getUserRole(joined.projectId, socket.data.userId);
		if (!role) {
			socket.leave(whiteboardRoom(joined.projectId));
			socket.data.whiteboard = undefined;
			return null;
		}
		joined.role = role;
		joined.checkedAt = Date.now();
		return role;
	};

	socket.on("join_whiteboard", async (projectId: unknown) => {
		if (typeof projectId !== "string" || projectId.length === 0) return;
		const role = await getUserRole(projectId, socket.data.userId);
		if (!role) {
			socket.emit("join_denied", { projectId });
			return;
		}
		const user = await prisma.user.findUnique({ where: { id: socket.data.userId }, select: { name: true } });
		socket.data.whiteboard = { projectId, role, name: user?.name ?? "", checkedAt: Date.now() } satisfies JoinedWhiteboard;
		socket.join(whiteboardRoom(projectId));
		//tells the client it is now in the room, so it can catch up on what it missed before joining
		socket.emit("whiteboard_joined", { projectId });
	});

	socket.on("whiteboard_update", async (data: unknown) => {
		const joined = socket.data.whiteboard as JoinedWhiteboard | undefined;
		if (!joined) return;
		// viewers may watch the board but not change it
		const role = await currentRole(joined);
		if (!role || ROLE_RANK[role] < ROLE_RANK.member) return;
		if (!isObject(data) || !takeUpdateToken()) return;
		const elements = validateElements(data.elements, MAX_ELEMENTS_PER_MESSAGE);
		if (!elements || elements.length === 0) return;
		socket.to(whiteboardRoom(joined.projectId)).emit("whiteboard_update", { elements });
	});

	socket.on("whiteboard_pointer", async (data: unknown) => {
		const joined = socket.data.whiteboard as JoinedWhiteboard | undefined;
		if (!joined || !isObject(data)) return;
		if (!(await currentRole(joined))) return;
		const { x, y, tool, button } = data;
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		const now = Date.now();
		if (now - lastPointerAt < POINTER_MIN_GAP_MS) return;
		lastPointerAt = now;
		socket.to(whiteboardRoom(joined.projectId)).volatile.emit("whiteboard_pointer", {
			userId: socket.data.userId,
			name: joined.name,
			pointer: { x, y, tool: tool === "laser" ? "laser" : "pointer" },
			button: button === "down" ? "down" : "up",
		});
	});

	socket.on("disconnect", () => {
		const joined = socket.data.whiteboard as { projectId: string } | undefined;
		if (joined) {
			socket.to(whiteboardRoom(joined.projectId)).emit("whiteboard_left", { userId: socket.data.userId });
		}
	});
}
