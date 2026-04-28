# Sprint 4

## Detail work we've completed in Sprint 4 (Backend + Frontend)

Sprint 4 focuses on **community engagement, moderation, and platform polish** — adding seven new features that transform the app from a simple sighting tracker into a full community platform. Three features are end-to-end (leaderboard, reports, channels), two form a linked pair (subscriptions + notifications), and two are backend-only infrastructure improvements (pagination, input validation).

### 1. Leaderboard

Users can see who's contributing the most to the wildlife community. The leaderboard ranks users by three different metrics and supports time-based filtering.

- **New endpoint** `GET /api/leaderboard?sort={metric}&period={timeframe}` — queries the database with dynamic SQL depending on the sort metric, returning the top 20 users.
- **Sort metrics** — `sightings` (count of posts), `species` (count of distinct species), `likes` (total likes received on all posts).
- **Time periods** — `all` (all time, default), `month` (last 30 days), `week` (last 7 days).
- **Response** — returns a wrapped object `{ "entries": [...], "period": "all", "sort_by": "sightings" }` where each entry includes `rank`, `user_id`, `username`, and `score`.
- **Frontend panel** — a floating panel with three tab buttons (Sightings / Species / Likes) and a period dropdown. Top 3 ranks display gold / silver / bronze coloring.

### 2. Report Sightings

Users can flag suspicious or inaccurate sightings for admin review, with duplicate protection.

- **New table** `reports` — columns `(id, sighting_id, reporter_id, reason, status, admin_note, created_at, resolved_at)` with foreign keys to `animals.id` and `users.id`.
- **New endpoint** `POST /api/reports` — creates a report. Enforces one pending report per user per sighting (returns 409 on duplicate).
- **New endpoint** `GET /api/reports` — lists all reports (optionally filtered by `?status=pending`). Joins `users` to include the reporter's username.
- **New endpoint** `PUT /api/reports/{id}` — updates report status to `resolved`, `dismissed`, or `pending` with an optional admin note.
- **Frontend modal** — a centered modal with a textarea for the reason and submit button. Shows success/error/duplicate states.

### 3. Subscribe to Species + Notifications

Users can subscribe to specific species and receive notifications when new sightings match their subscriptions.

- **New table** `subscriptions` — columns `(id, user_id, type, value, created_at)`. Type is one of `species`, `category`, `area`.
- **New table** `notifications` — columns `(id, user_id, sighting_id, subscription_id, message, is_read, created_at)`.
- **New endpoints** — `POST /api/subscriptions` (create), `GET /api/subscriptions?user_id=N` (list), `DELETE /api/subscriptions/{id}` (remove).
- **New endpoints** — `GET /api/notifications?user_id=N` (list, most recent 50), `PUT /api/notifications/{id}/read` (mark as read).
- **Automatic trigger** — when a new sighting is created via `POST /api/sightings`, the `triggerNotifications()` function queries all matching subscriptions and inserts notification rows.
- **Frontend** — a subscribe/unsubscribe toggle button in the sighting detail panel, a notification bell with unread badge in the toolbar, and a dropdown panel listing notifications with "View on map →" links that fly to the sighting location.
- **Polling** — the frontend polls for new notifications every 30 seconds.

### 4. Discussion Channels

Area-based group chat channels allow the wildlife community to discuss topics and locations.

- **New table** `area_channels` — columns `(id, name, description, creator_id, created_at)`.
- **New table** `area_messages` — columns `(id, channel_id, sender_id, content, created_at)`.
- **New endpoints** — `POST /api/channels` (create), `GET /api/channels` (list with message counts), `GET /api/channels/{id}/messages` (list messages), `POST /api/channels/{id}/messages` (send message).
- **Frontend panel** — a sliding panel showing channel list, a chat view with message bubbles, and a create-channel form.

### 5. Change Password

Users can securely update their password from the Profile page.

- **New endpoint** `PUT /api/users/password` — validates the old password via bcrypt, enforces password strength rules on the new password (min 8 chars, uppercase, lowercase, digit), and updates the hash.
- **Frontend** — an expandable form on the Profile page with current/new/confirm fields and real-time validation feedback.

### 6. Pagination on `GET /api/sightings`

The sightings list endpoint now supports optional pagination to handle large datasets.

- **Optional query parameters** — `page` (default 1) and `limit` (default 20, max 100).
- **Backward compatible** — when neither `page` nor `limit` is provided, returns all results as a plain JSON array (existing behavior).
- **Paginated response** — when pagination params are provided, returns `{ "data": [...], "total": N, "page": 1, "limit": 20, "total_pages": 3 }`.

### 7. Input Validation on `POST /api/sightings`

The sighting creation endpoint now validates all input fields before inserting into the database.

- **Species** — required, max 200 characters.
- **Description** — max 2000 characters.
- **Latitude** — must be between -90 and 90.
- **Longitude** — must be between -180 and 180.
- **Quantity** — defaults to 1 if ≤ 0, max 9999.
- Returns clear 400 error messages for each validation failure.

---

## Backend

### New Features Added in Sprint 4

#### 1. Leaderboard
`GET /api/leaderboard?sort=sightings&period=all` ranks users by sightings, species discovered, or likes received, filterable by time period (all/month/week). Returns top 20 users with rank, username, and score.

#### 2. Report Sightings
`POST /api/reports` creates a report on a sighting (one pending report per user per sighting). `GET /api/reports` lists reports. `PUT /api/reports/{id}` updates status for admin moderation.

#### 3. Subscriptions & Notifications
`POST /api/subscriptions` subscribes a user to a species/category/area. When a new sighting matches, `triggerNotifications()` auto-creates notification rows. `GET /api/notifications?user_id=N` retrieves them, `PUT /api/notifications/{id}/read` marks as read.

#### 4. Discussion Channels
`POST /api/channels` creates a channel, `GET /api/channels` lists them with message counts, `GET/POST /api/channels/{id}/messages` reads/sends messages.

#### 5. Change Password
`PUT /api/users/password` validates old password, enforces strength rules, updates bcrypt hash.

#### 6. Pagination
`GET /api/sightings?page=1&limit=20` returns paginated results with `total`, `page`, `limit`, `total_pages` metadata. Without params, returns all (backward compatible).

#### 7. Input Validation
`POST /api/sightings` now validates species length (≤200), description length (≤2000), latitude (-90..90), longitude (-180..180), and quantity (≤9999).

---

### Backend API Documentation

**Base URL:** `http://localhost:8080`

All endpoints accept and return JSON. CORS is enabled for `http://localhost:4200`.

---

#### `GET /api/leaderboard` *(new in Sprint 4)*
Rank users by contribution metrics, optionally filtered by time period.

**Query parameters:**
- `sort` — ranking metric: `sightings` (default), `species`, or `likes`
- `period` — time filter: `all` (default), `month` (30 days), `week` (7 days)

**Example:** `GET /api/leaderboard?sort=species&period=month`

| Status | Meaning |
|--------|---------|
| 200 OK | Returns wrapped response with entries array. |
| 400 Bad Request | Invalid `sort` value. |
| 500 Internal Server Error | Database query failed. |

**Response:**
```json
{
  "period": "month",
  "sort_by": "species",
  "entries": [
    { "rank": 1, "user_id": 3, "username": "gator123", "score": 12 },
    { "rank": 2, "user_id": 7, "username": "birdwatcher", "score": 8 }
  ]
}
```

---

#### `POST /api/reports` *(new in Sprint 4)*
Report a suspicious or inaccurate sighting. Each user can only have one pending report per sighting.

**Request body:**
```json
{
  "sighting_id": 5,
  "reporter_id": 3,
  "reason": "Incorrect species identification"
}
```

| Status | Meaning |
|--------|---------|
| 201 Created | Returns `{ "id": <new_report_id> }`. |
| 400 Bad Request | Missing fields or empty reason. |
| 409 Conflict | User already has a pending report on this sighting. |
| 500 Internal Server Error | Database insert failed. |

---

#### `GET /api/reports` *(new in Sprint 4)*
List all reports, optionally filtered by status.

**Optional query parameter:** `status` — filter by `pending`, `resolved`, or `dismissed`.

**Example:** `GET /api/reports?status=pending`

| Status | Meaning |
|--------|---------|
| 200 OK | Returns array of report objects. |
| 500 Internal Server Error | Database query failed. |

**Report object:**
```json
{
  "id": 1,
  "sighting_id": 5,
  "reporter_id": 3,
  "reporter": "gator123",
  "reason": "Incorrect species identification",
  "status": "pending",
  "admin_note": "",
  "created_at": "2026-04-20T10:00:00Z",
  "resolved_at": null
}
```

---

#### `PUT /api/reports/{id}` *(new in Sprint 4)*
Update a report's status (admin moderation).

**Request body:**
```json
{
  "status": "resolved",
  "admin_note": "Species corrected by poster"
}
```

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "status": "resolved" }`. |
| 400 Bad Request | Invalid report ID or status value. |
| 404 Not Found | Report not found. |
| 500 Internal Server Error | Database update failed. |

---

#### `POST /api/subscriptions` *(new in Sprint 4)*
Subscribe to notifications for a species, category, or area.

**Request body:**
```json
{
  "user_id": 3,
  "type": "species",
  "value": "Sandhill Crane"
}
```

| Status | Meaning |
|--------|---------|
| 201 Created | Returns `{ "id": <new_subscription_id> }`. |
| 400 Bad Request | Missing fields, invalid type, or empty value. |
| 409 Conflict | Already subscribed to this exact combination. |
| 500 Internal Server Error | Database insert failed. |

---

#### `GET /api/subscriptions?user_id={id}` *(new in Sprint 4)*
List all subscriptions for a user.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns array of subscription objects. |
| 400 Bad Request | Missing or invalid `user_id`. |
| 500 Internal Server Error | Database query failed. |

**Subscription object:**
```json
{
  "id": 1,
  "user_id": 3,
  "type": "species",
  "value": "Sandhill Crane",
  "created_at": "2026-04-20T10:00:00Z"
}
```

---

#### `DELETE /api/subscriptions/{id}` *(new in Sprint 4)*
Remove a subscription by its ID.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "status": "deleted" }`. |
| 400 Bad Request | Invalid subscription ID. |
| 404 Not Found | Subscription not found. |
| 500 Internal Server Error | Database delete failed. |

---

#### `GET /api/notifications?user_id={id}` *(new in Sprint 4)*
Retrieve notifications for a user (most recent 50).

**Optional query parameter:** `unread=true` — return only unread notifications.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns array of notification objects. |
| 400 Bad Request | Missing or invalid `user_id`. |
| 500 Internal Server Error | Database query failed. |

**Notification object:**
```json
{
  "id": 1,
  "user_id": 3,
  "sighting_id": 42,
  "subscription_id": 1,
  "message": "New Bird sighting: Sandhill Crane spotted nearby!",
  "is_read": false,
  "created_at": "2026-04-20T12:00:00Z"
}
```

---

#### `PUT /api/notifications/{id}/read` *(new in Sprint 4)*
Mark a notification as read.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "status": "read" }`. |
| 400 Bad Request | Invalid notification ID. |
| 404 Not Found | Notification not found. |
| 500 Internal Server Error | Database update failed. |

---

#### `GET /api/channels` *(new in Sprint 4)*
List all discussion channels with message counts.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns array of channel objects. |
| 500 Internal Server Error | Database query failed. |

**Channel object:**
```json
{
  "id": 1,
  "name": "Lake Alice Wildlife",
  "description": "Discuss sightings near Lake Alice",
  "creator_id": 3,
  "creator_name": "gator123",
  "created_at": "2026-04-20T10:00:00Z",
  "message_count": 15
}
```

---

#### `POST /api/channels` *(new in Sprint 4)*
Create a new discussion channel.

**Request body:**
```json
{
  "name": "Lake Alice Wildlife",
  "description": "Discuss sightings near Lake Alice",
  "creator_id": 3
}
```

| Status | Meaning |
|--------|---------|
| 201 Created | Returns `{ "id": <new_channel_id> }`. |
| 400 Bad Request | Missing/empty name, name too long (>100), or missing creator_id. |
| 500 Internal Server Error | Database insert failed. |

---

#### `GET /api/channels/{id}/messages` *(new in Sprint 4)*
Fetch all messages in a channel, ordered chronologically.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns array of message objects. |
| 400 Bad Request | Invalid channel ID. |
| 500 Internal Server Error | Database query failed. |

**Message object:**
```json
{
  "id": 1,
  "channel_id": 1,
  "sender_id": 3,
  "sender": "gator123",
  "content": "Just saw a huge gator near the lake!",
  "created_at": "2026-04-20T12:30:00Z"
}
```

---

#### `POST /api/channels/{id}/messages` *(new in Sprint 4)*
Send a message to a channel.

**Request body:**
```json
{
  "sender_id": 3,
  "content": "Just saw a huge gator near the lake!"
}
```

| Status | Meaning |
|--------|---------|
| 201 Created | Returns `{ "id": <new_message_id> }`. |
| 400 Bad Request | Invalid channel ID, missing sender_id, empty content, or content too long (>2000). |
| 500 Internal Server Error | Database insert failed. |

---

#### `PUT /api/users/password` *(new in Sprint 4)*
Change the current user's password.

**Request body:**
```json
{
  "user_id": 3,
  "old_password": "OldPass123",
  "new_password": "NewPass456"
}
```

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "status": "password changed" }`. |
| 400 Bad Request | Missing fields, same old/new password, or weak new password. |
| 401 Unauthorized | Old password is incorrect. |
| 404 Not Found | User not found. |
| 500 Internal Server Error | Database or hashing error. |

**Password requirements:** At least 8 characters, at least one uppercase letter, one lowercase letter, and one digit.

---

#### `GET /api/sightings` *(updated in Sprint 4 — pagination)*
Now supports optional pagination via `page` and `limit` query parameters.

**Optional query parameters:**
- `page` — page number (default 1)
- `limit` — items per page (default 20, max 100)
- `category` — filter by category (existing from Sprint 3)

**Examples:**
- `GET /api/sightings` — all sightings (backward compatible)
- `GET /api/sightings?page=1&limit=10` — paginated, first page
- `GET /api/sightings?page=2&limit=10&category=Bird` — paginated + filtered

**Without pagination (no `page`/`limit` params):**
Returns plain JSON array of sighting objects (unchanged from Sprint 3).

**With pagination:**
```json
{
  "data": [ /* array of sighting objects */ ],
  "total": 42,
  "page": 1,
  "limit": 10,
  "total_pages": 5
}
```

---

#### `POST /api/sightings` *(updated in Sprint 4 — input validation)*
Now validates all input fields before inserting into the database.

**New validation rules:**
| Field | Rule |
|-------|------|
| `species` | Required, max 200 characters |
| `description` | Max 2000 characters |
| `latitude` | Must be between -90 and 90 |
| `longitude` | Must be between -180 and 180 |
| `quantity` | Defaults to 1 if ≤ 0, max 9999 |

Invalid requests return 400 with a descriptive error message (e.g., `"Latitude must be between -90 and 90"`).

**Additionally:** When a sighting is successfully created, `triggerNotifications()` is called to generate notifications for all matching subscriptions.

---

### Backend Unit Tests

**Framework:** Go standard library `testing` + `net/http/httptest`

**Test file:** `backend/main_test.go`

**Run command:**
```bash
cd backend
go test ./... -v
```

**Total: 97 unit tests, all passing.** (16 from Sprint 2 + 14 from Sprint 3 + 67 added in Sprint 4.)

#### Sprint 2 tests (still passing)

| Test | Function Tested |
|------|----------------|
| `TestGenerateJWT_Success` | `generateJWT()` — creates valid JWT with correct claims |
| `TestGenerateJWT_DefaultSecret` | `generateJWT()` — works without `JWT_SECRET` env var |
| `TestHandleSignup_MethodNotAllowed` | `handleSignup()` — rejects non-POST requests with 405 |
| `TestHandleSignup_MissingFields` | `handleSignup()` — returns 400 when fields are empty |
| `TestHandleSignup_InvalidEmailDomain` | `handleSignup()` — rejects non-`@ufl.edu` emails with 400 |
| `TestHandleSignup_PasswordMismatch` | `handleSignup()` — returns 400 when passwords don't match |
| `TestHandleSignup_InvalidJSON` | `handleSignup()` — returns 400 on malformed request body |
| `TestHandleLogin_MethodNotAllowed` | `handleLogin()` — rejects non-POST requests with 405 |
| `TestHandleLogin_MissingFields` | `handleLogin()` — returns 400 when fields are empty |
| `TestHandleLogin_InvalidEmailDomain` | `handleLogin()` — rejects non-`@ufl.edu` emails with 400 |
| `TestHandleStats_MethodNotAllowed` | `handleStats()` — rejects non-GET requests with 405 |
| `TestHandleGetComments_MethodNotAllowed` | `handleGetComments()` — rejects non-GET requests with 405 |
| `TestHandleCreateComment_MissingContent` | `handleCreateComment()` — returns 400 when content is empty |
| `TestHandleDeleteComment_MethodNotAllowed` | `handleDeleteComment()` — rejects non-DELETE requests with 405 |
| `TestWriteJSON_SetsContentType` | `writeJSON()` — sets Content-Type to application/json |
| `TestWriteJSON_EncodesBody` | `writeJSON()` — correctly encodes response body as JSON |

#### Sprint 3 tests (still passing)

| Test | Function Tested |
|------|----------------|
| `TestHandleToggleLike_MethodNotAllowed` | `handleToggleLike()` — rejects non-POST requests with 405 |
| `TestHandleToggleLike_InvalidSightingID` | `handleToggleLike()` — returns 400 when path id is non-numeric |
| `TestHandleToggleLike_InvalidJSON` | `handleToggleLike()` — returns 400 on malformed request body |
| `TestHandleToggleLike_MissingUserID` | `handleToggleLike()` — returns 400 when `user_id` is missing or 0 |
| `TestHandleGetLikes_MethodNotAllowed` | `handleGetLikes()` — rejects non-GET requests with 405 |
| `TestHandleGetLikes_InvalidSightingID` | `handleGetLikes()` — returns 400 when path id is non-numeric |
| `TestParseSightingIDFromLikePath_Valid` | `parseSightingIDFromLikePath()` — extracts `{id}` from path |
| `TestParseSightingIDFromLikePath_NoSubpath` | `parseSightingIDFromLikePath()` — returns error on invalid path |
| `TestHandleGetNearby_MethodNotAllowed` | `handleGetNearbySightings()` — rejects non-GET requests with 405 |
| `TestHandleGetNearby_MissingLat` | `handleGetNearbySightings()` — returns 400 when `lat` is missing |
| `TestHandleGetNearby_MissingLng` | `handleGetNearbySightings()` — returns 400 when `lng` is missing |
| `TestHandleGetNearby_InvalidLat` | `handleGetNearbySightings()` — returns 400 when `lat` is non-numeric |
| `TestHandleGetNearby_InvalidLng` | `handleGetNearbySightings()` — returns 400 when `lng` is non-numeric |
| `TestHandleGetSightings_MethodNotAllowed` | `handleGetSightings()` — rejects non-GET requests with 405 |

#### Sprint 4 new tests

**Channels (14 tests):**

| Test | Function Tested |
|------|----------------|
| `TestHandleCreateChannel_MethodNotAllowed` | `handleCreateChannel()` — rejects non-POST requests with 405 |
| `TestHandleCreateChannel_EmptyName` | `handleCreateChannel()` — returns 400 when name is empty |
| `TestHandleCreateChannel_NameTooLong` | `handleCreateChannel()` — returns 400 when name exceeds 100 chars |
| `TestHandleCreateChannel_MissingCreatorID` | `handleCreateChannel()` — returns 400 when creator_id is 0 |
| `TestHandleCreateChannel_InvalidJSON` | `handleCreateChannel()` — returns 400 on malformed request body |
| `TestHandleGetChannels_MethodNotAllowed` | `handleGetChannels()` — rejects non-GET requests with 405 |
| `TestHandleGetChannelMessages_MethodNotAllowed` | `handleGetChannelMessages()` — rejects non-GET requests with 405 |
| `TestHandleGetChannelMessages_InvalidID` | `handleGetChannelMessages()` — returns 400 for non-numeric channel ID |
| `TestHandleCreateChannelMessage_MethodNotAllowed` | `handleCreateChannelMessage()` — rejects non-POST requests with 405 |
| `TestHandleCreateChannelMessage_InvalidChannelID` | `handleCreateChannelMessage()` — returns 400 for non-numeric channel ID |
| `TestHandleCreateChannelMessage_MissingSenderID` | `handleCreateChannelMessage()` — returns 400 when sender_id is 0 |
| `TestHandleCreateChannelMessage_EmptyContent` | `handleCreateChannelMessage()` — returns 400 when content is empty |
| `TestHandleCreateChannelMessage_ContentTooLong` | `handleCreateChannelMessage()` — returns 400 when content exceeds 2000 chars |
| `TestHandleCreateChannelMessage_InvalidJSON` | `handleCreateChannelMessage()` — returns 400 on malformed request body |

**Subscriptions (10 tests):**

| Test | Function Tested |
|------|----------------|
| `TestHandleCreateSubscription_MethodNotAllowed` | `handleCreateSubscription()` — rejects non-POST requests with 405 |
| `TestHandleCreateSubscription_MissingUserID` | `handleCreateSubscription()` — returns 400 when user_id is 0 |
| `TestHandleCreateSubscription_InvalidType` | `handleCreateSubscription()` — returns 400 for invalid subscription type |
| `TestHandleCreateSubscription_EmptyValue` | `handleCreateSubscription()` — returns 400 when value is empty |
| `TestHandleCreateSubscription_InvalidJSON` | `handleCreateSubscription()` — returns 400 on malformed request body |
| `TestHandleGetSubscriptions_MethodNotAllowed` | `handleGetSubscriptions()` — rejects non-GET requests with 405 |
| `TestHandleGetSubscriptions_MissingUserID` | `handleGetSubscriptions()` — returns 400 when user_id is missing |
| `TestHandleGetSubscriptions_InvalidUserID` | `handleGetSubscriptions()` — returns 400 when user_id is non-numeric |
| `TestHandleDeleteSubscription_MethodNotAllowed` | `handleDeleteSubscription()` — rejects non-DELETE requests with 405 |
| `TestHandleDeleteSubscription_InvalidID` | `handleDeleteSubscription()` — returns 400 for non-numeric subscription ID |

**Notifications (4 tests):**

| Test | Function Tested |
|------|----------------|
| `TestHandleGetNotifications_MethodNotAllowed` | `handleGetNotifications()` — rejects non-GET requests with 405 |
| `TestHandleGetNotifications_MissingUserID` | `handleGetNotifications()` — returns 400 when user_id is missing |
| `TestHandleMarkNotificationRead_MethodNotAllowed` | `handleMarkNotificationRead()` — rejects non-PUT requests with 405 |
| `TestHandleMarkNotificationRead_InvalidID` | `handleMarkNotificationRead()` — returns 400 for non-numeric notification ID |

**Reports (10 tests):**

| Test | Function Tested |
|------|----------------|
| `TestHandleCreateReport_MethodNotAllowed` | `handleCreateReport()` — rejects non-POST requests with 405 |
| `TestHandleCreateReport_MissingFields` | `handleCreateReport()` — returns 400 when sighting_id or reporter_id is 0 |
| `TestHandleCreateReport_EmptyReason` | `handleCreateReport()` — returns 400 when reason is empty |
| `TestHandleCreateReport_ReasonTooLong` | `handleCreateReport()` — returns 400 when reason exceeds 1000 chars |
| `TestHandleCreateReport_InvalidJSON` | `handleCreateReport()` — returns 400 on malformed request body |
| `TestHandleGetReports_MethodNotAllowed` | `handleGetReports()` — rejects non-GET requests with 405 |
| `TestHandleUpdateReport_MethodNotAllowed` | `handleUpdateReport()` — rejects non-PUT requests with 405 |
| `TestHandleUpdateReport_InvalidID` | `handleUpdateReport()` — returns 400 for non-numeric report ID |
| `TestHandleUpdateReport_InvalidStatus` | `handleUpdateReport()` — returns 400 for invalid status value |
| `TestHandleUpdateReport_InvalidJSON` | `handleUpdateReport()` — returns 400 on malformed request body |

**Leaderboard (4 tests):**

| Test | Function Tested |
|------|----------------|
| `TestHandleLeaderboard_MethodNotAllowed` | `handleLeaderboard()` — rejects non-GET requests with 405 |
| `TestHandleLeaderboard_InvalidSort` | `handleLeaderboard()` — returns 400 for invalid sort value |
| `TestHandleLeaderboard_DefaultSort` | `handleLeaderboard()` — defaults to "sightings" when sort param is omitted |
| `TestHandleLeaderboard_SortValidation` | `handleLeaderboard()` — accepts all three valid sort values |

**Input Validation on Sightings (11 tests):**

| Test | Function Tested |
|------|----------------|
| `TestHandleCreateSighting_MethodNotAllowed` | `handleCreateSighting()` — rejects non-POST requests with 405 |
| `TestHandleCreateSighting_MissingSpecies` | `handleCreateSighting()` — returns 400 when species is empty |
| `TestHandleCreateSighting_SpeciesTooLong` | `handleCreateSighting()` — returns 400 when species exceeds 200 chars |
| `TestHandleCreateSighting_InvalidLatitude` | `handleCreateSighting()` — returns 400 when latitude is out of range |
| `TestHandleCreateSighting_InvalidLongitude` | `handleCreateSighting()` — returns 400 when longitude is out of range |
| `TestHandleCreateSighting_QuantityTooLarge` | `handleCreateSighting()` — returns 400 when quantity exceeds 9999 |
| `TestHandleCreateSighting_InvalidJSON` | `handleCreateSighting()` — returns 400 on malformed request body |
| `TestHandleUpdateSighting_MethodNotAllowed` | `handleUpdateSighting()` — rejects non-PUT requests with 405 |
| `TestHandleUpdateSighting_InvalidID` | `handleUpdateSighting()` — returns 400 for non-numeric sighting ID |
| `TestHandleDeleteSighting_MethodNotAllowed` | `handleDeleteSighting()` — rejects non-DELETE requests with 405 |
| `TestHandleDeleteSighting_InvalidID` | `handleDeleteSighting()` — returns 400 for non-numeric sighting ID |

**Pagination (4 tests):**

| Test | Function Tested |
|------|----------------|
| `TestParsePaginationParams_Defaults` | `parsePaginationParams()` — returns page=1, limit=20 when no params |
| `TestParsePaginationParams_LimitCap` | `parsePaginationParams()` — caps limit at 100 |
| `TestParsePaginationParams_NegativePageDefaults` | `parsePaginationParams()` — defaults negative page to 1 |
| `TestParsePaginationParams_NoPagination` | `parsePaginationParams()` — returns usePagination=false when no params |

**Change Password (10 tests):**

| Test | Function Tested |
|------|----------------|
| `TestValidatePasswordStrength_TooShort` | `validatePasswordStrength()` — rejects passwords under 8 chars |
| `TestValidatePasswordStrength_NoUppercase` | `validatePasswordStrength()` — rejects passwords without uppercase |
| `TestValidatePasswordStrength_NoLowercase` | `validatePasswordStrength()` — rejects passwords without lowercase |
| `TestValidatePasswordStrength_NoDigit` | `validatePasswordStrength()` — rejects passwords without digits |
| `TestValidatePasswordStrength_Valid` | `validatePasswordStrength()` — accepts valid passwords |
| `TestHandleChangePassword_MethodNotAllowed` | `handleChangePassword()` — rejects non-PUT requests with 405 |
| `TestHandleChangePassword_MissingFields` | `handleChangePassword()` — returns 400 when fields are empty |
| `TestHandleChangePassword_SamePassword` | `handleChangePassword()` — returns 400 when old=new password |
| `TestHandleChangePassword_WeakNewPassword` | `handleChangePassword()` — returns 400 for weak new password |
| `TestHandleChangePassword_InvalidJSON` | `handleChangePassword()` — returns 400 on malformed request body |

---

## Manual Verification (Sprint 4 backend features)

With the backend running on `localhost:8080`:

**1. Leaderboard**
```bash
# All time, sorted by sightings
curl "http://localhost:8080/api/leaderboard"

# This month, sorted by species
curl "http://localhost:8080/api/leaderboard?sort=species&period=month"

# This week, sorted by likes
curl "http://localhost:8080/api/leaderboard?sort=likes&period=week"
```

**2. Report a sighting**
```bash
# Create a report
curl -X POST http://localhost:8080/api/reports \
     -H "Content-Type: application/json" \
     -d '{"sighting_id":1,"reporter_id":3,"reason":"Incorrect species"}'
# → {"id":1}

# Try duplicate → 409
curl -X POST http://localhost:8080/api/reports \
     -H "Content-Type: application/json" \
     -d '{"sighting_id":1,"reporter_id":3,"reason":"Duplicate"}'
# → {"error":"You have already reported this sighting"}

# List pending reports
curl "http://localhost:8080/api/reports?status=pending"

# Resolve a report
curl -X PUT http://localhost:8080/api/reports/1 \
     -H "Content-Type: application/json" \
     -d '{"status":"resolved","admin_note":"Species corrected"}'
```

**3. Subscriptions**
```bash
# Subscribe to a species
curl -X POST http://localhost:8080/api/subscriptions \
     -H "Content-Type: application/json" \
     -d '{"user_id":3,"type":"species","value":"Sandhill Crane"}'
# → {"id":1}

# List subscriptions
curl "http://localhost:8080/api/subscriptions?user_id=3"

# Delete subscription
curl -X DELETE http://localhost:8080/api/subscriptions/1
```

**4. Notifications**
```bash
# Get notifications for user 3
curl "http://localhost:8080/api/notifications?user_id=3"

# Get only unread
curl "http://localhost:8080/api/notifications?user_id=3&unread=true"

# Mark as read
curl -X PUT http://localhost:8080/api/notifications/1/read
```

**5. Channels**
```bash
# Create a channel
curl -X POST http://localhost:8080/api/channels \
     -H "Content-Type: application/json" \
     -d '{"name":"Lake Alice Wildlife","description":"Discuss sightings near Lake Alice","creator_id":3}'
# → {"id":1}

# List channels
curl http://localhost:8080/api/channels

# Send a message
curl -X POST http://localhost:8080/api/channels/1/messages \
     -H "Content-Type: application/json" \
     -d '{"sender_id":3,"content":"Just saw a huge gator!"}'

# Get messages
curl http://localhost:8080/api/channels/1/messages
```

**6. Change password**
```bash
curl -X PUT http://localhost:8080/api/users/password \
     -H "Content-Type: application/json" \
     -d '{"user_id":3,"old_password":"OldPass123","new_password":"NewPass456"}'
# → {"status":"password changed"}
```

**7. Pagination**
```bash
# Default (all results, no pagination)
curl http://localhost:8080/api/sightings

# Page 1, 3 items per page
curl "http://localhost:8080/api/sightings?page=1&limit=3"
# → {"data":[...],"total":9,"page":1,"limit":3,"total_pages":3}

# Page 2
curl "http://localhost:8080/api/sightings?page=2&limit=3"
```

**8. Input validation**
```bash
# Species name too long
curl -X POST http://localhost:8080/api/sightings \
     -H "Content-Type: application/json" \
     -d '{"species":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","latitude":29.6,"longitude":-82.3}'
# → 400: {"error":"Species name too long (max 200 characters)"}

# Invalid coordinates
curl -X POST http://localhost:8080/api/sightings \
     -H "Content-Type: application/json" \
     -d '{"species":"Gator","latitude":999,"longitude":-82.3}'
# → 400: {"error":"Latitude must be between -90 and 90"}
```

---

## Frontend

### New Features Added in Sprint 4

Sprint 4 frontend work focuses on **community features and platform polish** — adding leaderboard, reporting, subscriptions, notifications, channels, and password management UI.

| # | Feature | Affected Page |
|---|---------|---------------|
| 1 | Leaderboard panel | Map |
| 2 | Report sighting modal | Map — Sighting Detail Panel |
| 3 | Subscribe to species + Notifications | Map — Sighting Detail Panel + Map toolbar |
| 4 | Discussion channels panel | Map |
| 5 | Change password form | Profile |

---

### Feature Details

#### 1. Leaderboard Panel

A floating panel that ranks users by their contributions to the wildlife community.

- **Toggle button** — gold "Leaderboard" button in the map toolbar opens/closes the panel.
- **Sort tabs** — three tab buttons (Sightings / Species / Likes) switch the ranking metric. The active tab is highlighted.
- **Period dropdown** — "All Time", "This Month", "This Week" filter the time range.
- **Ranked list** — each entry shows rank number, username, and score. Top 3 ranks display gold (#FFD700), silver (#C0C0C0), and bronze (#CD7F32) coloring.
- **Empty state** — shows "No data yet" when no results are returned.

#### 2. Report Sighting Modal

Users can flag suspicious or inaccurate sightings directly from the detail panel.

- **Report button** — a grey flag-icon button in the detail panel's like row (rightmost).
- **Login guard** — clicking Report while logged out triggers the login-required modal.
- **Modal** — centered overlay with a textarea for the reason and a Submit button.
- **States** — success (green "Report submitted successfully"), duplicate (amber "already reported"), error (red message).

#### 3. Subscribe to Species + Notifications

A two-part feature linking species subscriptions to real-time notifications.

- **Subscribe button** — yellow bell button in the detail panel. Toggles between "Subscribe" and "Subscribed" (highlighted when active).
- **Notification bell** — toolbar button with a red unread-count badge. Positioned to avoid overlap with map zoom controls.
- **Notification panel** — dropdown listing recent notifications. Unread items have a blue-tinted background.
- **Click-to-navigate** — clicking a notification marks it as read, closes the panel, flies the map to the sighting location, and opens the detail panel.
- **Auto-polling** — notifications refresh every 30 seconds via `setInterval`, with cleanup in `ngOnDestroy()`.

#### 4. Discussion Channels Panel

A sliding panel for area-based group discussions.

- **Toggle button** — purple "Channels" button in the map toolbar.
- **Channel list** — shows channel name, message count badge, and creator name. Empty state prompts "No channels yet. Create one!".
- **Create channel** — bottom form with name and description inputs.
- **Chat view** — clicking a channel opens its message history with a send input at the bottom. Messages show sender name and timestamp. Back arrow returns to channel list.

#### 5. Change Password

An expandable form on the Profile page for securely updating passwords.

- **Toggle button** — "Change Password" button with lock icon, located below the sightings list.
- **Form fields** — Current Password, New Password, Confirm New Password (all password-type inputs).
- **Client-side validation** — checks that new passwords match and are at least 8 characters before submitting.
- **Server-side validation** — backend enforces uppercase, lowercase, and digit requirements.
- **Feedback** — green success message or red error message displayed inline.

---

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/app/sighting.service.ts` | Added `API_ROOT` constant, 6 new interfaces (`LeaderboardEntry`, `Subscription`, `Notification`, `Channel`, `ChannelMessage`), 12 new API methods |
| `frontend/src/app/map/map.ts` | Added ~25 signals and ~20 methods for leaderboard, reports, subscriptions, notifications, and channels |
| `frontend/src/app/map/map.html` | Added 4 toolbar buttons, 3 floating panels, subscribe/report buttons in detail panel, report modal, notification panel |
| `frontend/src/app/map/map.css` | Added styles for leaderboard, channels, notifications, subscriptions, reports; adjusted zoom control position |
| `frontend/src/app/profile/profile.ts` | Added change password signals and methods (`toggleChangePassword`, `savePassword`) |
| `frontend/src/app/profile/profile.html` | Added "Change Password" expandable section with 3 password inputs |
| `frontend/src/app/profile/profile.css` | Added styles for change password section |

---

### Frontend Unit Tests

**Framework:** Vitest + Angular TestBed

**Test files:**
- `frontend/src/app/sighting.service.spec.ts`
- `frontend/src/app/map/map.spec.ts`
- `frontend/src/app/upload.service.spec.ts` 
- `frontend/src/app/login/login.spec.ts` 
- `frontend/src/app/signup/signup.spec.ts` 
- `frontend/src/app/home/home.spec.ts` 
- `frontend/src/app/profile/profile.spec.ts`
- `frontend/src/app/photos/photos.spec.ts` 

**Run command:**
```bash
cd frontend
npx ng test --no-watch
```

**Total: 209 unit tests across 13 spec files, all passing.** (77 from prior sprints + 132 added in Sprint 4.)

#### Sprint 4 new tests — `sighting.service.spec.ts` (18 tests)

| Test | Function Tested |
|------|----------------|
| `getLeaderboard() extracts entries from wrapped response` | `getLeaderboard()` — unwraps `{ entries: [...] }` response |
| `getLeaderboard() returns empty array on error` | `getLeaderboard()` — returns `[]` when API fails |
| `createReport() returns success on 200` | `createReport()` — returns `{ success: true }` on success |
| `createReport() returns error message on failure` | `createReport()` — extracts error message from failed response |
| `getSubscriptions() returns subscription array` | `getSubscriptions()` — returns array of subscription objects |
| `getSubscriptions() returns empty array on error` | `getSubscriptions()` — returns `[]` on failure |
| `createSubscription() returns success with id` | `createSubscription()` — returns `{ success: true, id }` |
| `deleteSubscription() returns true on success` | `deleteSubscription()` — returns `true` when delete succeeds |
| `getNotifications() returns notification array` | `getNotifications()` — returns array of notification objects |
| `getNotifications() returns empty array for non-array response` | `getNotifications()` — handles null/non-array responses |
| `markNotificationRead() returns true on success` | `markNotificationRead()` — returns `true` on success |
| `getChannels() returns channel array` | `getChannels()` — returns array of channel objects |
| `createChannel() returns success with id` | `createChannel()` — returns `{ success: true, id }` |
| `getChannelMessages() returns message array` | `getChannelMessages()` — returns array of message objects |
| `getChannelMessages() returns empty array for non-array response` | `getChannelMessages()` — handles null responses |
| `sendChannelMessage() returns true on success` | `sendChannelMessage()` — returns `true` on success |
| `changePassword() returns success on 200` | `changePassword()` — returns `{ success: true }` |
| `changePassword() returns error message on failure` | `changePassword()` — extracts error message from failed response |

#### Sprint 4 new tests — `map.spec.ts` (16 tests)

| Test | Function Tested |
|------|----------------|
| `toggleLeaderboard() flips showLeaderboard signal` | `toggleLeaderboard()` — toggles panel visibility |
| `leaderboardRankColor() returns gold for index 0` | `leaderboardRankColor()` — returns #FFD700 for rank 1 |
| `leaderboardRankColor() returns silver for index 1` | `leaderboardRankColor()` — returns #C0C0C0 for rank 2 |
| `leaderboardRankColor() returns bronze for index 2` | `leaderboardRankColor()` — returns #CD7F32 for rank 3 |
| `leaderboardRankColor() returns grey for index 3+` | `leaderboardRankColor()` — returns #888 for rank 4+ |
| `openReportModal() sets showReportModal and clears state` | `openReportModal()` — opens modal with clean state |
| `openReportModal() shows login required when not logged in` | `openReportModal()` — redirects to login when unauthenticated |
| `closeReportModal() hides the modal` | `closeReportModal()` — closes the report modal |
| `isSubscribedToSpecies() returns false with empty subscriptions` | `isSubscribedToSpecies()` — returns false when no subs |
| `isSubscribedToSpecies() returns true when subscription exists` | `isSubscribedToSpecies()` — returns true when subscribed |
| `getSubscriptionForSpecies() returns the matching subscription` | `getSubscriptionForSpecies()` — finds matching sub object |
| `getSubscriptionForSpecies() returns undefined for non-subscribed species` | `getSubscriptionForSpecies()` — returns undefined when not found |
| `toggleNotifPanel() flips showNotifPanel signal` | `toggleNotifPanel()` — toggles notification panel |
| `unreadCount defaults to 0` | `unreadCount` — signal starts at 0 |
| `toggleChannelsPanel() flips showChannelsPanel signal` | `toggleChannelsPanel()` — toggles channels panel |
| `closeChannel() clears selectedChannel and channelMessages` | `closeChannel()` — resets channel view state |

---

### Manual Verification (Frontend)

**1. Leaderboard**

1. Click the gold **Leaderboard** button in the map toolbar.
2. The panel opens showing ranked users with gold/silver/bronze highlights.
3. Click the **Sightings** / **Species** / **Likes** tabs — ranking updates.
4. Change the period dropdown to **This Month** or **This Week** — data filters by time.
5. Close with the × button.

**2. Report a sighting**

1. Click a map marker to open the detail panel.
2. In the like-row at the bottom, click the grey **Report** button (flag icon).
3. A modal appears — enter a reason and click **Submit Report**.
4. Green success message appears: "Report submitted successfully."
5. Reporting the same sighting again shows "already reported."

**3. Subscribe + Notifications**

1. Open a sighting detail panel.
2. Click the yellow **Subscribe** button — it toggles to **Subscribed** (highlighted).
3. From another account, post a new sighting of the same species.
4. The notification bell in the toolbar shows a red badge with the unread count.
5. Click the bell — the notification panel opens listing the new notification.
6. Click a notification → the map flies to the sighting location and opens the detail panel.

**4. Discussion channels**

1. Click the purple **Channels** button in the toolbar.
2. Click **+ New Channel** → enter a name (e.g., "Lake Alice") and click **Create**.
3. Click the channel to enter the chat view.
4. Type a message and press Send — it appears in the chat area.
5. Click the ← arrow to return to the channel list.

**5. Change password**

1. Navigate to **Profile**.
2. Scroll down and click **Change Password**.
3. Fill in Current Password, New Password (min 8 chars, upper+lower+digit), and Confirm.
4. Click **Save** — green "Password changed successfully!" appears on success.
5. Wrong current password shows a red error message.
