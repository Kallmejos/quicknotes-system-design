# QuickNotes REST API Design

This document describes the **proposed production QuickNotes API**, not the JSONPlaceholder practice API used by the browser demo. The service is versioned under `/api/v1`, uses JSON, and requires authentication for private notes. All timestamps are UTC ISO 8601 strings.

## Endpoint table

| Method | Path | Description | Success status |
|---|---|---|---|
| GET | `/api/v1/notes` | List the authenticated user's notes; supports `page`, `limit`, `q`, and `tag` filters | `200 OK` |
| POST | `/api/v1/notes` | Create a note owned by the authenticated user | `201 Created` |
| GET | `/api/v1/notes/{noteId}` | Retrieve one note owned by the authenticated user | `200 OK` |
| PATCH | `/api/v1/notes/{noteId}` | Update a note's title, body, or tags | `200 OK` |
| DELETE | `/api/v1/notes/{noteId}` | Delete a note owned by the authenticated user | `204 No Content` |
| GET | `/api/v1/tags` | List the authenticated user's tags | `200 OK` |
| POST | `/api/v1/tags` | Create a tag for the authenticated user | `201 Created` |
| GET | `/api/v1/health` | Report service health for monitoring (no private user data) | `200 OK` |

`{noteId}` is a server-generated identifier. `limit` defaults to 20 and is capped at 100. `q` searches title and body. Clients must not be able to read or modify another user's private notes by changing an ID.

## Create a note

Request:

```http
POST /api/v1/notes HTTP/1.1
Content-Type: application/json
Authorization: Bearer <access-token>
```

```json
{
  "title": "Revision plan",
  "body": "Review database joins on Saturday.",
  "tagIds": [2, 5]
}
```

Response: `201 Created`

```json
{
  "id": "note_01JABC123",
  "userId": "user_01JXYZ789",
  "title": "Revision plan",
  "body": "Review database joins on Saturday.",
  "tags": [
    {"id": 2, "name": "school"},
    {"id": 5, "name": "revision"}
  ],
  "createdAt": "2026-10-11T12:00:00Z",
  "updatedAt": "2026-10-11T12:00:00Z"
}
```

The server derives `userId` from the verified access token, rather than trusting a user ID supplied in the request body.

## List notes

Request:

```http
GET /api/v1/notes?page=1&limit=2 HTTP/1.1
Authorization: Bearer <access-token>
```

Response: `200 OK`

```json
{
  "data": [
    {
      "id": "note_01JABC123",
      "title": "Revision plan",
      "body": "Review database joins on Saturday.",
      "tags": [{"id": 2, "name": "school"}],
      "createdAt": "2026-10-11T12:00:00Z",
      "updatedAt": "2026-10-11T12:00:00Z"
    },
    {
      "id": "note_01JABC124",
      "title": "Shopping",
      "body": "Buy a notebook.",
      "tags": [],
      "createdAt": "2026-10-10T08:30:00Z",
      "updatedAt": "2026-10-10T08:30:00Z"
    }
  ],
  "pagination": {"page": 1, "limit": 2, "totalItems": 17, "totalPages": 9}
}
```

## Error codes

| Status | Meaning | Typical use |
|---|---|---|
| `400 Bad Request` | Invalid JSON, validation failure, or invalid query parameter | Missing title or title longer than 100 characters |
| `401 Unauthorized` | Authentication missing or invalid | Expired or absent access token |
| `403 Forbidden` | Authenticated user is not permitted to perform this action | Attempt to use an administrative operation without permission |
| `404 Not Found` | Resource does not exist or is not visible to the user | Unknown note ID |
| `409 Conflict` | Request conflicts with current resource state | Duplicate tag name for the same user |
| `429 Too Many Requests` | Rate limit exceeded | Too many requests in a short period |
| `500 Internal Server Error` | Unexpected server failure | Unhandled server-side exception |

Example error body:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title must be 100 characters or fewer.",
    "details": [{"field": "title", "issue": "max_length", "limit": 100}],
    "requestId": "req_01JABCXYZ"
  }
}
```

## Conventions and security

- Use HTTPS for all traffic and bearer-token authentication for private endpoints.
- Validate request shape and field lengths on the server; client validation is for usability, not security.
- Return consistent JSON error bodies for errors, except where HTTP semantics call for an empty body (such as `204 No Content`).
- Apply per-user authorization to every note and tag query, parameterized SQL to avoid injection, and rate limits to protect service availability.
- Use pagination rather than returning an unbounded collection.
