const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadButton = document.getElementById("load-btn");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitButton = document.getElementById("submit-btn");
const statusMessage = document.getElementById("status");
const notesList = document.getElementById("notes-list");

let notes = [];
let isLoading = false;
let isSubmitting = false;
const deletingIds = new Set();

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`The server returned HTTP ${response.status}.`);
  }
  // DELETE responses may have no body, so do not try to parse a 204 response as JSON.
  const data = response.status === 204 ? null : await response.json();
  return { data, status: response.status };
}

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status status--${type}`;
}

function updateControls() {
  const busy = isLoading || isSubmitting || deletingIds.size > 0;
  loadButton.disabled = busy;
  submitButton.disabled = busy;
  titleInput.disabled = isSubmitting;
  bodyInput.disabled = isSubmitting;
  notesList.querySelectorAll("button[data-delete-id]").forEach((button) => {
    button.disabled = busy;
  });
}

function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No notes found. Load notes or create your first note.";
    notesList.appendChild(emptyItem);
    return;
  }

  for (const note of notes) {
    const item = document.createElement("li");
    item.className = "note-card";

    const content = document.createElement("div");
    content.className = "note-content";
    const title = document.createElement("h3");
    title.textContent = note.title || "Untitled note";
    const body = document.createElement("p");
    body.textContent = note.body || "No note text provided.";
    content.append(title, body);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button--danger";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.deleteId = String(note.id);
    deleteButton.setAttribute("aria-label", `Delete note: ${note.title || "Untitled note"}`);
    deleteButton.addEventListener("click", () => deleteNote(note.id));

    item.append(content, deleteButton);
    notesList.appendChild(item);
  }
}

async function loadNotes() {
  if (isLoading || isSubmitting || deletingIds.size > 0) return;

  isLoading = true;
  updateControls();
  setStatus("Loading notes...", "loading");

  try {
    const result = await request(`${API_URL}?_limit=10`);
    if (!Array.isArray(result.data)) {
      throw new Error("The server returned an unexpected response.");
    }

    notes = result.data.map(({ id, title, body, userId }) => ({ id, title, body, userId }));
    renderNotes();
    if (notes.length === 0) {
      setStatus("No notes were found on the server.", "empty");
    } else if (notes.length === 10) {
      setStatus("Loaded 10 notes from the server.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus(`Sorry, we couldn't load your notes. ${error.message}`, "error");
  } finally {
    isLoading = false;
    updateControls();
  }
}

async function createNote(event) {
  event.preventDefault();
  if (isLoading || isSubmitting || deletingIds.size > 0) return;

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title) {
    setStatus("Please enter a title. A title is required.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  isSubmitting = true;
  updateControls();
  setStatus("Creating note...", "loading");

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, body, userId: 1 })
    });
    const created = result.data;
    if (!created || typeof created.id === "undefined") {
      throw new Error("The server did not return a note ID.");
    }

    // JSONPlaceholder simulates POST writes (often returning id 101) but does not persist them.
    // Keep the created note in this page's in-memory list; refreshing restores server demo data.
    notes.unshift({
      id: created.id,
      title: created.title || title,
      body: typeof created.body === "string" ? created.body : body,
      userId: created.userId || 1
    });
    renderNotes();
    noteForm.reset();
    setStatus(`Note created (status ${result.status}, id ${created.id}).`, "success");
  } catch (error) {
    setStatus(`Sorry, we couldn't create your note. ${error.message}`, "error");
  } finally {
    isSubmitting = false;
    updateControls();
  }
}

async function deleteNote(id) {
  if (isLoading || isSubmitting || deletingIds.size > 0) return;

  deletingIds.add(id);
  updateControls();
  setStatus("Deleting note...", "loading");

  try {
    await request(`${API_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
    // JSONPlaceholder acknowledges DELETE but does not persist the removal. Remove it from
    // local state for this session; reloading may show seeded demo posts again.
    notes = notes.filter((note) => String(note.id) !== String(id));
    renderNotes();
    if (notes.length === 0) {
      setStatus("Note deleted. Your list is now empty.", "empty");
    } else {
      setStatus("Note deleted successfully.", "success");
    }
  } catch (error) {
    setStatus(`Sorry, we couldn't delete this note. ${error.message}`, "error");
  } finally {
    deletingIds.delete(id);
    updateControls();
  }
}

loadButton.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
renderNotes();

// Practice API note: JSONPlaceholder does not persist demo POST or DELETE operations.
