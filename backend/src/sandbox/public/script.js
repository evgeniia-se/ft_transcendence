const TEST_PROJECT_ID = "22222222-2222-2222-2222-222222222222";

document.getElementById("board-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = document.getElementById("board-title").value;
    const status = document.getElementById("board-status");
    const result = document.getElementById("board-result");

    try {
      const response = await fetch("/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: TEST_PROJECT_ID, title }),
      });

      const board = await response.json();
      result.textContent = JSON.stringify(board, null, 2);

      if (response.ok) {
        status.textContent = "✅ Board created";
        status.style.color = "green";
      } else {
        status.textContent = "❌ Error " + response.status;
        status.style.color = "red";
      }
    } catch (err) {
      status.textContent = "❌ Network error : " + err.message;
      status.style.color = "red";
    }
});

  
document.getElementById("list-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const boardId = document.getElementById("board-id").value;
    const title = document.getElementById("list-title").value;
    const position = Number(document.getElementById("list-position").value);
    const status = document.getElementById("list-status");
    const result = document.getElementById("list-result");

    try {
      const response = await fetch("/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: boardId, title: title, position: position }),
      });

      const list = await response.json();
      result.textContent = JSON.stringify(list, null, 2);

      if (response.ok) {
        status.textContent = "✅ List Created";
        status.style.color = "green";
      } else {
        status.textContent = "❌ Error " + response.status;
        status.style.color = "red";
      }
    } catch (err) {
      status.textContent = "❌ Network error : " + err.message;
      status.style.color = "red";
    }
});

document.getElementById("card-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const listId = document.getElementById("list-id").value;
    const title = document.getElementById("card-title").value;
    const description = document.getElementById("card-description").value;
    const position = Number(document.getElementById("card-position").value);
    const status = document.getElementById("card-status");
    const result = document.getElementById("card-result");

    try {
      const response = await fetch("/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: listId, title: title, description: description, position: position }),
      });

      const list = await response.json();
      result.textContent = JSON.stringify(list, null, 2);

      if (response.ok) {
        status.textContent = "✅ Card Created";
        status.style.color = "green";
      } else {
        status.textContent = "❌ Error " + response.status;
        status.style.color = "red";
      }
    } catch (err) {
      status.textContent = "❌ Network error : " + err.message;
      status.style.color = "red";
    }
});

document.getElementById("view-board-form").addEventListener("submit", async (event) => {
	event.preventDefault();

	const id = document.getElementById("view-board-id").value;
	const view = document.getElementById("board-view");

	try {
	const response = await fetch("/boards/" + id);
	const board = await response.json();

	if (!response.ok) {
		view.textContent = "❌ Error " + response.status + ": " + board.error;
		return;
	}

	view.innerHTML = "<h3>" + board.title + "</h3>" +
		board.lists.map((list) => `
		<div style="border:1px solid #ccc; padding:8px; margin:4px; display:inline-block; vertical-align:top;">
			<strong>${list.title}</strong>
			<ul>
			${list.cards.map((card) => `<li>${card.title}</li>`).join("")}
			</ul>
		</div>
		`).join("");
	} catch (err) {
	view.textContent = "❌ Network error: " + err.message;
	}
});

document.getElementById("view-list-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const id = document.getElementById("view-list-id").value;
	const view = document.getElementById("list-view");

	const response = await fetch("/lists/" + id);
	const list = await response.json();

	if (!response.ok) {
	view.textContent = "❌ Error " + response.status + ": " + list.error;
	return;
	}

	view.innerHTML = "<strong>" + list.title + "</strong><ul>" +
	list.cards.map((card) => `<li>${card.title}</li>`).join("") +
	"</ul>";
});

document.getElementById("view-card-form").addEventListener("submit", async (event) => {
	event.preventDefault();
	const id = document.getElementById("view-card-id").value;
	const view = document.getElementById("card-view");

	const response = await fetch("/cards/" + id);
	const card = await response.json();

	if (!response.ok) {
	view.textContent = "❌ Error " + response.status + ": " + card.error;
	return;
	}

	view.innerHTML = "<strong>" + card.title + "</strong> — " + card.description + " (" + card.status + ")";
});

document.getElementById("update-list-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("update-list-id").value;
  const titleInput = document.getElementById("update-list-title").value;
  const positionInput = document.getElementById("update-list-position").value;
  const status = document.getElementById("update-list-status");
  const result = document.getElementById("update-list-result");

  const body = {};
  if (titleInput !== "") body.title = titleInput;
  if (positionInput !== "") body.position = Number(positionInput);

  try {
    const response = await fetch("/lists/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const list = await response.json();
    result.textContent = JSON.stringify(list, null, 2);

    if (response.ok) {
      status.textContent = "✅ List updated";
      status.style.color = "green";
    } else {
      status.textContent = "❌ Error " + response.status;
      status.style.color = "red";
    }
  } catch (err) {
    status.textContent = "❌ Network error: " + err.message;
    status.style.color = "red";
  }
});

document.getElementById("update-card-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("update-card-id").value;
  const titleInput = document.getElementById("update-card-title").value;
  const descriptionInput = document.getElementById("update-card-description").value;
  const listIdInput = document.getElementById("update-card-list-id").value;
  const linkedBranchInput = document.getElementById("update-card-linked-branch").value;
  const linkedPrUrlInput = document.getElementById("update-card-linked-pr-url").value;
  const statusFieldInput = document.getElementById("update-card-status-field").value;
  const positionInput = document.getElementById("update-card-position").value;
  const feedback = document.getElementById("update-card-feedback");
  const result = document.getElementById("update-card-result");

  const body = {};
  if (titleInput !== "") body.title = titleInput;
  if (descriptionInput !== "") body.description = descriptionInput;
  if (listIdInput !== "") body.listId = listIdInput;
  if (linkedBranchInput !== "") body.linkedBranch = linkedBranchInput;
  if (linkedPrUrlInput !== "") body.linkedPrUrl = linkedPrUrlInput;
  if (statusFieldInput !== "") body.status = statusFieldInput;
  if (positionInput !== "") body.position = Number(positionInput);

  try {
    const response = await fetch("/cards/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const card = await response.json();
    result.textContent = JSON.stringify(card, null, 2);

    if (response.ok) {
      feedback.textContent = "✅ Card updated";
      feedback.style.color = "green";
    } else {
      feedback.textContent = "❌ Error " + response.status;
      feedback.style.color = "red";
    }
  } catch (err) {
    feedback.textContent = "❌ Network error: " + err.message;
    feedback.style.color = "red";
  }
});

async function deleteResource(path, feedbackId) {
  const feedback = document.getElementById(feedbackId);

  try {
    const response = await fetch(path, { method: "DELETE" });

    if (response.ok) {
      feedback.textContent = "✅ Deleted";
      feedback.style.color = "green";
    } else {
      const error = await response.json();
      feedback.textContent = "❌ Error " + response.status + ": " + error.error;
      feedback.style.color = "red";
    }
  } catch (err) {
    feedback.textContent = "❌ Network error: " + err.message;
    feedback.style.color = "red";
  }
}

document.getElementById("delete-board-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("delete-board-id").value;
  await deleteResource("/boards/" + id, "delete-board-feedback");
});

document.getElementById("delete-list-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("delete-list-id").value;
  await deleteResource("/lists/" + id, "delete-list-feedback");
});

document.getElementById("delete-card-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("delete-card-id").value;
  await deleteResource("/cards/" + id, "delete-card-feedback");
});