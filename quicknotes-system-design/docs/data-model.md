# QuickNotes Data Model

## Entities and columns

The production design uses a relational database (for example, PostgreSQL). `users` owns notes and tags. `notes` stores each note's text and owner. `tags` stores labels owned by a user. `note_tags` is the junction table connecting notes and tags.

| Entity | Columns and types | Keys |
|---|---|---|
| `users` | `id BIGINT`, `email VARCHAR(254)`, `display_name VARCHAR(100)`, `created_at TIMESTAMP` | PK `id`; unique `email` |
| `notes` | `id BIGINT`, `user_id BIGINT`, `title VARCHAR(100)`, `body TEXT`, `created_at TIMESTAMP`, `updated_at TIMESTAMP` | PK `id`; FK `user_id` → `users.id` |
| `tags` | `id BIGINT`, `user_id BIGINT`, `name VARCHAR(50)`, `created_at TIMESTAMP` | PK `id`; FK `user_id` → `users.id`; unique `(user_id, name)` |
| `note_tags` | `note_id BIGINT`, `tag_id BIGINT`, `created_at TIMESTAMP` | Composite PK `(note_id, tag_id)`; FKs to `notes.id` and `tags.id` |

## Relationships

- **One-to-many:** one user can own many notes, while each note has one owner (`users.id` → `notes.user_id`).
- **One-to-many:** one user can create many tags (`users.id` → `tags.user_id`).
- **Many-to-many:** a note can have many tags and each tag can be attached to many notes. `note_tags` resolves this relationship into two one-to-many relationships and prevents duplicate note/tag pairs with its composite primary key.
- Foreign keys use cascading deletes for owned content so deleting a user or note cannot leave orphaned note-tag links. A production system should implement user deletion with the applicable retention and audit policy.

## CREATE TABLE statements

These statements use PostgreSQL-compatible SQL. `BIGINT GENERATED ALWAYS AS IDENTITY` creates numeric IDs automatically.

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL CHECK (length(trim(title)) > 0),
    body TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL CHECK (length(trim(name)) > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_notes_user_updated
    ON notes (user_id, updated_at DESC);

CREATE INDEX idx_note_tags_tag
    ON note_tags (tag_id);
```

The composite index on `notes(user_id, updated_at DESC)` helps the common request to list one user's newest notes. `idx_note_tags_tag` supports looking up notes associated with a tag. Indexes speed reads but consume storage and add work to inserts/updates, so they should be validated against actual query plans.

## Example SQL queries

**1. List the newest notes for one user**

```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = 42
ORDER BY updated_at DESC
LIMIT 20;
```

**2. Join notes to their tags (JOIN example)**

```sql
SELECT n.id, n.title, t.name AS tag
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.id
JOIN tags AS t ON t.id = nt.tag_id
WHERE n.user_id = 42
ORDER BY n.id, t.name;
```

**3. Count notes per user**

```sql
SELECT u.id, u.display_name, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.display_name
ORDER BY note_count DESC;
```

**4. Find notes without any tags**

```sql
SELECT n.id, n.title
FROM notes AS n
LEFT JOIN note_tags AS nt ON nt.note_id = n.id
WHERE n.user_id = 42 AND nt.note_id IS NULL;
```

## SQL versus NoSQL

Choose **SQL** for the core QuickNotes data because users, notes, tags, and note-tag links have clear relationships and need referential integrity, uniqueness, and transactional consistency. PostgreSQL supports joins, constraints, indexing, and reliable transactions for creating a note and attaching its tags together. A document or key-value store could be useful later for specific high-volume workloads, but introducing one now would add operational complexity without removing the need for relational ownership and authorization rules.
