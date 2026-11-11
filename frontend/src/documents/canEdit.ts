// Owner: Track 4 (Whiteboard, notes, and supporting modules)
// Responsible for: whether the signed in user may edit notes and files
import { listMembers } from "../api/projectsApi";
import { getStoredUser } from "../auth/authClient";

// the server enforces roles so on failure show the controls and let it answer
export async function fetchCanEdit(projectId: string): Promise<boolean> {
	try {
		const me = getStoredUser();
		const role = (await listMembers(projectId)).find((member) => member.userId === me?.id)?.role;
		return role !== "viewer";
	} catch {
		return true;
	}
}
