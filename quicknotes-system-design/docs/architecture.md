# QuickNotes Architecture for 1 Million Users

## Assumptions and requirements

### Functional requirements
- Users can register/sign in and only access their own notes.
- Users can create, read, update, delete, search, and tag notes.
- Notes are paginated; clients receive predictable validation and error responses.
- The service records operational logs and supports backups and recovery.

### Non-functional requirements
- Scale to 1 million registered users and tolerate five-times average traffic peaks.
- Target 99.9% monthly availability, with an initial p95 read API latency target below 300 ms under expected load.
- Encrypt traffic with HTTPS, protect data at rest, enforce authorization, and monitor service health.
- Support horizontal application scaling, backup/restore, graceful degradation, and observability.

### Capacity estimates

Illustrative planning assumptions: 1,000,000 registered users; 10% daily active users = 100,000 DAU; each active user loads 50 note/feed pages and creates 1 note per day; average stored note text and metadata = 2 KB per note; 365 days per year. A page load is treated as one API read request. These estimates exclude retries, background requests, attachments, replicas, indexes, backups, and growth in note history.

| Metric | Calculation | Estimate |
|---|---|---:|
| Reads per day | 100,000 DAU × 50 reads | 5,000,000 |
| Average reads/sec | 5,000,000 ÷ 86,400 | about 58 |
| Peak reads/sec | Average × 5 | about 290 |
| Writes per day | 100,000 DAU × 1 note | 100,000 |
| Average writes/sec | 100,000 ÷ 86,400 | about 1.16 |
| Peak writes/sec | Average × 5 | about 6 |
| New notes/year | 100,000 × 365 | 36.5 million |
| Logical note storage/year | 36.5 million × 2 KB | about 73 GB/year |

Traffic is read-heavy: the assumed 50 reads per daily active user greatly exceed one write, so CDN/cache efficiency and indexed read queries are important. The 2 KB storage estimate is only a planning average; real note bodies can vary widely, and operational storage must account for indexes, backups, replication, and retained versions.

## Architecture diagram

```text
                   +------------------+
                   | Client / Browser |
                   +---------+--------+
                             |
                           DNS
                             |
                      +------v------+
                      |     CDN     |  Static assets / cacheable responses
                      +------+------+
                             |
                    +--------v---------+
                    |  Load Balancer    |
                    +----+---------+----+
                         |         |
                  +------v--+   +--v-------+
                  | App     |   | App      |
                  | Server 1|   | Server 2 |   (horizontal scale-out)
                  +----+----+   +----+-----+
                       |             |
                 +-----v-------------v----+
                 | Shared Cache (e.g. Redis)|
                 +------------+------------+
                              |
                   +----------v-----------+
                   | Primary Database     |
                   | (writes / source of  |
                   | truth)               |
                   +----------+-----------+
                              | replication
                   +----------v-----------+
                   | Read Replica         |
                   +----------------------+

       App Servers -----> Queue -----> Worker
                           async jobs: email, cleanup, exports
```

## Component responsibilities

- **Client/browser:** presents the interface, validates fields for usability, and calls the API over HTTPS.
- **DNS:** maps the service hostname to the public entry point and allows routing changes without changing the user-facing URL.
- **CDN:** serves versioned static assets close to users and can cache explicitly public/cacheable responses to reduce latency and origin traffic.
- **Load balancer:** health-checks instances and distributes incoming requests across healthy application servers.
- **App servers (two or more):** run stateless API logic, authenticate users, validate input, enforce per-user authorization, and apply business rules.
- **Shared cache:** stores frequently requested note lists or metadata with a short TTL to reduce repeated database reads.
- **Primary database:** is the authoritative transactional store for note creation, updates, deletes, and relational constraints.
- **Read replica:** serves eligible read queries to increase read capacity, while acknowledging replication lag.
- **Queue:** durably buffers asynchronous jobs so slow or retryable background work does not hold open user requests.
- **Worker:** processes queued tasks such as notification delivery, exports, and cleanup, with retries and idempotency.
- **Monitoring and logs:** collect metrics, traces, and structured errors to detect saturation and investigate incidents.

## GET /api/v1/notes flow

1. The client resolves the service hostname through DNS and sends an HTTPS `GET /api/v1/notes?page=1&limit=20` request.
2. The CDN serves only responses that are explicitly safe to cache; private per-user note responses are not shared publicly.
3. The load balancer forwards the request to a healthy app server.
4. The app server verifies the access token, derives the user ID from it, validates pagination, and builds a user-scoped query.
5. The app server checks the shared cache using a key that includes the user and query parameters; a cache hit returns the authorized cached result.
6. On a cache miss, the server queries the read replica when the consistency requirement permits; otherwise it reads from the primary.
7. The app server returns the paginated JSON response and caches it for a short TTL; note writes invalidate or refresh affected keys.

## POST /api/v1/notes flow

1. The client sends `POST /api/v1/notes` over HTTPS with JSON containing `title`, optional `body`, and optional tag IDs.
2. The load balancer routes the request to a healthy app server.
3. The app server authenticates the user, validates the title and body, checks tag ownership, and ignores any client-supplied owner ID.
4. The app server starts a database transaction and inserts the note and any `note_tags` rows.
5. The primary database commits and returns the generated note ID and timestamps.
6. The app server invalidates the user's affected cached list keys and optionally places non-critical follow-up work on the queue.
7. The server returns `201 Created` with the new note representation; the client shows the created note.

## Trade-offs and resilience

- **Cache speed versus freshness:** cached lists reduce database load, but may be briefly stale. Use short TTLs plus invalidation after writes; bypass cache for reads that require strong consistency.
- **Read replica scale versus consistency:** replicas improve read capacity, but replication lag can make a just-created note temporarily absent from a read. Return the created note directly and route read-after-write requests to the primary when needed.
- **Asynchronous work versus immediate completion:** queues keep notifications and exports out of the critical request path, but jobs may be delayed. Make jobs idempotent, retry transient failures with backoff, and send exhausted jobs to a dead-letter queue.
- **CDN performance versus complexity:** CDN caching speeds static assets but requires cache-control rules and asset versioning; do not publicly cache private note data.
- **Redundancy versus cost:** multiple app servers and a health-checking load balancer avoid a single application instance failure. Deploy the database with managed failover/standby and backups, use a highly available cache/queue configuration, and monitor replica health. DNS/CDN/load-balancer providers should offer redundancy across zones or regions. Backups protect recovery but are not a substitute for tested failover.
