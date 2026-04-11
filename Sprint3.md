# Sprint 3

## Detail work we've completed in Sprint 3 (Backend)

Sprint 3 focuses on **backend extensibility** — adding social, geographic, and analytics capabilities on top of the basic CRUD infrastructure built in Sprint 1 and Sprint 2. Two brand-new features were implemented end-to-end (likes and nearby search), and two features whose code already existed but were never documented (`category` filter and `/api/stats`) are now formally surfaced for the first time.

### 1. Like / Unlike a Sighting

Users can express appreciation for individual wildlife sightings by liking them. Each `(user, sighting)` pair is a unique row in a new `sighting_likes` table — toggling a like simply flips that row between existing and not existing.

- **New table** `sighting_likes` — columns `(user_id, sighting_id, created_at)` with a composite primary key and foreign keys to `users.id` and `animals.id` (cascade on delete).
- **New endpoint** `POST /api/sightings/{id}/like` — toggles the like for a given user. On the first call it inserts a row; on the second it deletes it. Always returns the updated total like count plus a `liked` boolean indicating the new state.
- **New endpoint** `GET /api/sightings/{id}/likes` — returns the total count for a sighting. When called with `?user_id=N`, also tells you whether that specific user has liked the sighting (`liked_by_me`).
- **Modified endpoint** `GET /api/sightings` — the list response now includes a `like_count` field for every sighting, computed via a `LEFT JOIN` aggregating the `sighting_likes` table. The frontend gets like counts "for free" on the initial sightings load, without having to make N extra requests.

### 2. Nearby Sightings (Geo Search)

Because this is a location-centric wildlife app, a user's most common question is "what's been spotted *near me*?" The new nearby endpoint answers that in one request using the Haversine formula directly in PostgreSQL — no PostGIS extension or external geo service required.

- **New endpoint** `GET /api/sightings/nearby?lat={lat}&lng={lng}&radius={meters}` — returns all sightings within `radius` meters of the given coordinates, ordered by distance ascending.
- **Radius policy** — default `1000` meters (1 km), hard cap at `10000` meters (10 km) to prevent clients from requesting giant result sets.
- **Distance math** — uses the [Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula) with Earth's radius `6,371,000` meters. The `acos` argument is clamped to `[-1, 1]` with `GREATEST/LEAST` to prevent floating-point noise from producing `NaN` at exactly-colocated points.
- **Response enrichment** — each returned sighting includes a `distance_meters` field so the client can display "23 m away" without recomputing the distance.

### 3. Category Filter on `GET /api/sightings` (now formally documented)

The backend already accepted an optional `?category=` query parameter, but it was omitted from the Sprint 2 documentation. Sprint 3 formally documents and demos this feature.

- **Example** `GET /api/sightings?category=Bird` returns only bird sightings, ordered by most recent first.
- **Accepted values** — any of `Mammal`, `Bird`, `Reptile`, `Amphibian`, `Fish`, `Insect`, `Other`. Unknown values return an empty array.

### 4. Stats Endpoint (now formally documented)

Same story — the `/api/stats` handler already existed but was not documented in Sprint 2.

- **Endpoint** `GET /api/stats` — returns a single summary object containing `total_sightings`, `total_users`, and a `by_category` map counting sightings per animal category.
- **Intended use** — feeds an admin dashboard or a landing-page "at-a-glance" widget.

---

## Backend

### New Features Added in Sprint 3

#### 1. Like / Unlike Sightings
A new `sighting_likes` join table plus three changes to the API: `POST /api/sightings/{id}/like` (toggle), `GET /api/sightings/{id}/likes` (count + `liked_by_me`), and an extra `like_count` field added to every item returned by `GET /api/sightings`.

#### 2. Nearby Sighting Search
A new `GET /api/sightings/nearby?lat=&lng=&radius=` endpoint that uses the Haversine formula in raw SQL to return sightings within a given radius, sorted by distance, with each result enriched by a `distance_meters` field.

#### 3. Category Filter
`GET /api/sightings?category=Bird` filters the sightings list by animal category. The implementation already existed in Sprint 2 but is now formally documented and demoed.

#### 4. Stats Endpoint
`GET /api/stats` returns total sightings, total users, and a per-category breakdown. The handler already existed in Sprint 2 but is now formally documented and demoed.

---

### Backend API Documentation

**Base URL:** `http://localhost:8080`

All endpoints accept and return JSON. CORS is enabled for `http://localhost:4200`.

---

#### `POST /api/signup`
Register a new user account.

**Request body:**
```json
{
  "username": "gator123",
  "email": "gator123@ufl.edu",
  "password": "SecurePass1",
  "confirmPassword": "SecurePass1"
}
```

| Status | Meaning |
|--------|---------|
| 201 Created | Registration successful. Returns `token` (JWT) and `user` object. |
| 400 Bad Request | Missing fields, passwords don't match, or non-`@ufl.edu` email. |
| 409 Conflict | Username or email already exists. |
| 500 Internal Server Error | Database or hashing error. |

---

#### `POST /api/login`
Log in with an existing account.

**Request body:**
```json
{
  "email": "gator123@ufl.edu",
  "password": "SecurePass1"
}
```

| Status | Meaning |
|--------|---------|
| 200 OK | Login successful. Returns `token` (JWT) and `user` object. |
| 400 Bad Request | Missing fields or non-`@ufl.edu` email. |
| 401 Unauthorized | Invalid email or password. |
| 500 Internal Server Error | Database or token generation error. |

---

#### `GET /api/sightings`
Retrieve all wildlife sighting records, ordered by most recent first.

**Optional query parameter:** `category` — filter by animal category (e.g., `Bird`, `Mammal`, `Reptile`).

**Examples:**
- `GET /api/sightings` — all sightings
- `GET /api/sightings?category=Bird` — only bird sightings

| Status | Meaning |
|--------|---------|
| 200 OK | Returns JSON array of sighting objects. |
| 500 Internal Server Error | Database query failed. |

**Sighting object** *(now includes `like_count`)***:**
```json
{
  "id": 1,
  "species": "Sandhill Crane",
  "image_url": "https://...",
  "latitude": 29.6436,
  "longitude": -82.3549,
  "address": "Turlington Hall, UF",
  "category": "Bird",
  "quantity": 2,
  "behavior": "Feeding",
  "description": "Two cranes near the fountain",
  "date": "2026-03-20",
  "time": "14:30",
  "user_id": 3,
  "username": "gator123",
  "created_at": "2026-03-20T14:30:00Z",
  "like_count": 5
}
```

---

#### `GET /api/sightings/nearby` *(new in Sprint 3)*
Find sightings within a given radius of a coordinate, ordered by distance ascending.

**Required query parameters:**
- `lat` — latitude (float)
- `lng` — longitude (float)

**Optional query parameter:**
- `radius` — radius in meters. Default `1000`, maximum `10000`.

**Example:** `GET /api/sightings/nearby?lat=29.6436&lng=-82.3549&radius=500`

| Status | Meaning |
|--------|---------|
| 200 OK | Returns array of sightings, each with an added `distance_meters` field. |
| 400 Bad Request | Missing or invalid `lat`/`lng`. |
| 500 Internal Server Error | Database query failed. |

**Response item** *(adds one field to the normal Sighting object)***:**
```json
{
  "id": 1,
  "species": "Sandhill Crane",
  "latitude": 29.6436,
  "longitude": -82.3549,
  "like_count": 5,
  "distance_meters": 23.4,
  "...": "other sighting fields"
}
```

---

#### `POST /api/sightings`
Create a new wildlife sighting record.

**Request body:**
```json
{
  "species": "Sandhill Crane",
  "image_url": "https://...",
  "latitude": 29.6436,
  "longitude": -82.3549,
  "address": "Turlington Hall, UF",
  "category": "Bird",
  "quantity": 2,
  "behavior": "Feeding",
  "description": "Two cranes near the fountain",
  "date": "2026-03-20",
  "time": "14:30",
  "userId": "3",
  "username": "gator123"
}
```

| Status | Meaning |
|--------|---------|
| 201 Created | Returns `{ "id": <new_id> }`. |
| 400 Bad Request | `species` field is missing. |
| 500 Internal Server Error | Database insert failed. |

---

#### `PUT /api/sightings/{id}`
Update an existing sighting by its integer ID.

**Request body:** Same fields as `POST /api/sightings`.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "status": "updated" }`. |
| 400 Bad Request | Invalid or non-integer ID. |
| 404 Not Found | No sighting with that ID exists. |
| 500 Internal Server Error | Database update failed. |

---

#### `DELETE /api/sightings/{id}`
Delete a sighting by its integer ID.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "status": "deleted" }`. |
| 400 Bad Request | Invalid or non-integer ID. |
| 404 Not Found | No sighting with that ID exists. |
| 500 Internal Server Error | Database delete failed. |

---

#### `POST /api/sightings/{id}/like` *(new in Sprint 3)*
Toggle a like on a sighting for a given user. If the user already liked the sighting, this removes the like; otherwise it adds one.

**Request body:**
```json
{ "user_id": 3 }
```

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "liked": <bool>, "count": <int> }`. |
| 400 Bad Request | Invalid sighting ID, invalid JSON, or missing `user_id`. |
| 500 Internal Server Error | Database insert/delete failed. |

**Response:**
```json
{
  "liked": true,
  "count": 6
}
```

---

#### `GET /api/sightings/{id}/likes` *(new in Sprint 3)*
Return the total number of likes on a sighting. When called with `?user_id=N`, also returns whether that user has liked it.

**Examples:**
- `GET /api/sightings/3/likes`
- `GET /api/sightings/3/likes?user_id=7`

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "count": <int>, "liked_by_me": <bool> }`. |
| 400 Bad Request | Invalid sighting ID. |
| 500 Internal Server Error | Database query failed. |

---

#### `GET /api/stats`
Return a summary of database statistics.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns counts object. |
| 500 Internal Server Error | Database query failed. |

**Response:**
```json
{
  "total_sightings": 42,
  "total_users": 8,
  "by_category": {
    "Bird": 15,
    "Mammal": 10,
    "Reptile": 8,
    "Insect": 5,
    "Amphibian": 4
  }
}
```

---

#### `GET /api/sightings/{id}/messages`
Fetch all comments for a specific sighting, ordered oldest first.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns JSON array of comment objects (empty array if none). |
| 400 Bad Request | Invalid or non-integer sighting ID. |
| 500 Internal Server Error | Database query failed. |

**Comment object:**
```json
{
  "ID": 1,
  "SightingID": 3,
  "Sender": "gator123",
  "Content": "Saw this too near Marston!",
  "CreateTime": "2026-03-21T01:00:00Z"
}
```

---

#### `POST /api/sightings/{id}/messages`
Post a new comment on a sighting.

**Request body:**
```json
{
  "content": "Saw this too near Marston!",
  "sender": "gator123",
  "sender_id": "1"
}
```

| Status | Meaning |
|--------|---------|
| 201 Created | Returns `{ "id": <new_id> }`. |
| 400 Bad Request | Missing content or invalid sighting ID. |
| 500 Internal Server Error | Database insert failed. |

---

#### `DELETE /api/messages/{id}`
Delete a comment by its ID.

| Status | Meaning |
|--------|---------|
| 200 OK | Returns `{ "status": "deleted" }`. |
| 400 Bad Request | Invalid or non-integer comment ID. |
| 404 Not Found | No comment with that ID exists. |
| 500 Internal Server Error | Database delete failed. |

---

### Backend Unit Tests

**Framework:** Go standard library `testing` + `net/http/httptest`

**Test file:** `backend/main_test.go`

**Run command:**
```bash
cd backend
go test ./... -v
```

**Total: 30 unit tests, all passing.** (16 carried over from Sprint 2 + 14 added in Sprint 3.)

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

#### Sprint 3 new tests

| Test | Function Tested |
|------|----------------|
| `TestHandleToggleLike_MethodNotAllowed` | `handleToggleLike()` — rejects non-POST requests with 405 |
| `TestHandleToggleLike_InvalidSightingID` | `handleToggleLike()` — returns 400 when path id is non-numeric |
| `TestHandleToggleLike_InvalidJSON` | `handleToggleLike()` — returns 400 on malformed request body |
| `TestHandleToggleLike_MissingUserID` | `handleToggleLike()` — returns 400 when `user_id` field is missing or 0 |
| `TestHandleGetLikes_MethodNotAllowed` | `handleGetLikes()` — rejects non-GET requests with 405 |
| `TestHandleGetLikes_InvalidSightingID` | `handleGetLikes()` — returns 400 when path id is non-numeric |
| `TestParseSightingIDFromLikePath_Valid` | `parseSightingIDFromLikePath()` — correctly extracts `{id}` from `/api/sightings/{id}/like` |
| `TestParseSightingIDFromLikePath_NoSubpath` | `parseSightingIDFromLikePath()` — returns error when path has no sub-segment |
| `TestHandleGetNearby_MethodNotAllowed` | `handleGetNearbySightings()` — rejects non-GET requests with 405 |
| `TestHandleGetNearby_MissingLat` | `handleGetNearbySightings()` — returns 400 when `lat` query param is missing |
| `TestHandleGetNearby_MissingLng` | `handleGetNearbySightings()` — returns 400 when `lng` query param is missing |
| `TestHandleGetNearby_InvalidLat` | `handleGetNearbySightings()` — returns 400 when `lat` is non-numeric |
| `TestHandleGetNearby_InvalidLng` | `handleGetNearbySightings()` — returns 400 when `lng` is non-numeric |
| `TestHandleGetSightings_MethodNotAllowed` | `handleGetSightings()` — rejects non-GET requests with 405 |

---

## Manual Verification (Sprint 3 backend features)

With the backend running on `localhost:8080`:

**1. Category filter**
```bash
curl "http://localhost:8080/api/sightings?category=Bird"
```

**2. Stats**
```bash
curl http://localhost:8080/api/stats
```

**3. Like a sighting**
```bash
# First call: creates the like
curl -X POST http://localhost:8080/api/sightings/1/like \
     -H "Content-Type: application/json" \
     -d '{"user_id":3}'
# → {"count":1,"liked":true}

# Second call: removes the like
curl -X POST http://localhost:8080/api/sightings/1/like \
     -H "Content-Type: application/json" \
     -d '{"user_id":3}'
# → {"count":0,"liked":false}
```

**4. Query likes**
```bash
curl "http://localhost:8080/api/sightings/1/likes?user_id=3"
# → {"count":0,"liked_by_me":false}
```

**5. Nearby sightings**
```bash
curl "http://localhost:8080/api/sightings/nearby?lat=29.6436&lng=-82.3549&radius=500"
```
