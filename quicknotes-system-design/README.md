# QuickNotes System Design

QuickNotes is a learning project that demonstrates a browser-based notes client using a practice REST API and documents a production backend design for a service intended to support one million registered users.

## Files

- `index.html` — accessible HTML5 page and note form.
- `style.css` — responsive styling, including separate success and error status styles.
- `api.js` — reusable fetch helper and GET, POST, and DELETE behavior.
- `docs/api-design.md` — proposed production REST API contract.
- `docs/data-model.md` — relational schema, relationships, queries, and indexes.
- `docs/architecture.md` — requirements, load estimates, diagram, request flows, and resilience trade-offs.

## How to run the API client

1. Download and extract the project ZIP, or clone the repository.
2. Open the project folder in Visual Studio Code.
3. Open `index.html` in a browser. For local development, you can use the VS Code Live Server extension.
4. Click **Load notes** to fetch ten example posts. Use the form to create a note or click **Delete** on a note.

The client calls `https://jsonplaceholder.typicode.com/posts`. JSONPlaceholder is a practice API: it simulates POST and DELETE responses but does not permanently persist those changes. The client updates its in-memory list for the current page session; refreshing can restore the original demo posts. The API described in `docs/api-design.md` is a proposed real backend contract and is not deployed by this project.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- How to make asynchronous GET, POST, and DELETE requests with `fetch`, check `response.ok`, and handle failures with `try`, `catch`, and `finally`.
- Why loading, success, error, and empty states—and disabling buttons during requests—make an interface easier to understand.
- How to validate form input and safely render user text with `textContent` rather than inserting it as HTML.
- How primary keys, foreign keys, a many-to-many junction table, and indexes support reliable relational data.
- How caches, CDNs, read replicas, queues, and workers help scale a read-heavy system, and how they introduce freshness, consistency, and operational trade-offs.
