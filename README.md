# UFwildlife🐊

UFwildlife is a community-driven web platform that allows University of Florida students and faculty to record, share, and explore the animals found on campus. 

The project follows a **separated frontend–backend architecture**, using Angular for the frontend and Go (Golang) for the backend API.

---

## 📌 Project Overview

UFwildlife brings campus to life through an interactive map where students capture and share the animals they meet every day in different seasons. Upload a photo, drop a pin, and tell your story — then explore what others have discovered across campus. It's more than a map; it's a shared memory that Gators have tucked into every corner of campus.

This project is developed by a small software engineering team as a full-stack web application.

---

## 💻 Team member

Frontend Developers: Hailin Zeng

Backend Developers: Zhengqi Li, Min Yao

---

## 🏗 System Architecture

```text
Browser
  ↓
Angular Frontend (http://localhost:4200)
  ↓  HTTP API requests
Go Backend API (http://localhost:8080)


## Set Up Environment

### 1️⃣ Install Node.js and npm (required for frontend)

- Download Node.js from: <span style="color:blue">https://nodejs.org/</span>  
- Recommended version: <span style="color:blue">Node.js 22.12+</span>

- Verify installation:

```bash
node -v
npm -v
```

---

### 2️⃣ Install Angular CLI (Global Tool)

- Install Angular CLI globally:

```bash
npm install -g @angular/cli
```

- Check version:

```bash
ng version
```

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
```

This installs all frontend dependencies defined in <span style="color:blue">package.json</span>.

---

### 4️⃣ Install Go (Required for Backend)

- Download Go from: <span style="color:blue">https://go.dev/dl/</span>  
- Verify installation:

```bash
go version
```

---

### 5️⃣ Backend Setup

This sets up Go modules for dependency management:

```bash
cd backend
go mod init parkinGator-backend  # only if not initialized
go mod tidy
```

---

## Run

### 1️⃣ Run Backend

```bash
cd backend
go run main.go
```

- Server runs at: <span style="color:blue">http://localhost:8080/api/parking</span>

---

### 2️⃣ Run Frontend

```bash
cd frontend
ng serve --open
```

- Server runs at: <span style="color:blue">http://localhost:4200</span>  
- Browser will open automatically

---

## Notes

- Make sure both frontend and backend are running simultaneously during development.
- Frontend communicates with backend through HTTP requests to endpoints like `/api/parking`.
- If you encounter permission issues with npm globally, you can fix them by:

```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```

> **Windows PowerShell tip:** If your path contains spaces, use single quotes:
> ```powershell
> cd 'C:\Users\Yao Min\my-todo\UF-Wildlife-main\backend'
> ```

---

## 📡 API Endpoints

All endpoints include CORS headers for `http://localhost:4200`.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/signup` | Register a new user, returns JWT token |
| POST | `/api/login` | Login, returns JWT token |

### Sightings (Wildlife Records)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sightings` | Get all sighting records (newest first) |
| POST | `/api/sightings` | Create a new sighting record |
| PUT | `/api/sightings/{id}` | Update an existing record |
| DELETE | `/api/sightings/{id}` | Delete a record |

#### POST /api/sightings — Request Body
```json
{
  "species": "White-tailed Deer",
  "image_url": "",
  "latitude": 29.6436,
  "longitude": -82.3549,
  "address": "Museum Road, Gainesville, FL...",
  "category": "Mammal",
  "quantity": 2,
  "behavior": "Feeding",
  "description": "Spotted near the lake",
  "date": "2026-02-18",
  "time": "14:30",
  "userId": "5",
  "username": "min.yao"
}
```

---

## 🗄 Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-increment |
| username | TEXT UNIQUE | |
| email | TEXT UNIQUE | |
| password | TEXT | bcrypt hashed |
| created_at | TIMESTAMP | |

### `animals` (Sighting Records)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-increment |
| species | TEXT | Animal name (maps to frontend `animalName`) |
| image_url | TEXT | Photo URL / base64 (maps to frontend `photoUrl`) |
| latitude | DOUBLE PRECISION | |
| longitude | DOUBLE PRECISION | |
| address | TEXT | Location name from Nominatim reverse geocoding |
| category | TEXT | Mammal / Bird / Reptile / Amphibian / Fish / Insect / Other |
| quantity | INTEGER | Default 1 |
| behavior | TEXT | Resting / Feeding / Moving / Nesting / Swimming / Flying / Unknown |
| description | TEXT | Free-form notes |
| date | TEXT | Sighting date (YYYY-MM-DD) |
| time | TEXT | Sighting time (HH:MM) |
| user_id | INTEGER | FK → users.id |
| username | TEXT | Denormalized creator username |
| created_at | TIMESTAMP | |

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| sender_id | TEXT | |
| sender | TEXT | |
| content | TEXT | |
| created_at | TIMESTAMP | |

---

## 🔧 Environment Variables (`backend/.env`)

```
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/postgres?sslmode=require
JWT_SECRET=<your-secret-key>
```

The `.env` file is loaded automatically at startup via `loadEnv(".env")` in `main.go`.

---

## 🗺 Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | LoginComponent | Email + password login |
| `/signup` | SignupComponent | New account registration |
| `/home/map` | MapComponent | Interactive Leaflet map — click to record a sighting |
| `/home/species` | SpeciesComponent | All sightings grouped by category |
| `/home/profile` | ProfileComponent | Personal stats, my sightings, edit profile, logout |

---

## 🧩 Key Frontend Services

### `SightingService` (`sighting.service.ts`)
- Calls `loadAll()` in the constructor — data is fetched from the backend on every page load automatically
- `add(sighting)` — POST to backend, then updates local Angular signal
- `remove(id)` — DELETE on backend, then updates local signal
- `update(id, data)` — PUT on backend, then updates local signal
- `sightingsByUser(userId)` — filters sightings by user ID (used in Profile)

### `AuthService` (`auth.service.ts`)
- `login()` / `signup()` — calls backend, stores JWT in `localStorage`
- `currentUser` — Angular signal holding the logged-in user object
- `logout()` — clears token and navigates to `/login`

---

## ⚠️ Known Limitations

| Issue | Status |
|-------|--------|
| Login state lost on page refresh | `AuthService` constructor needs to restore `currentUser` signal from `localStorage` |
| Profile "My Sightings" may not filter correctly | Backend `INSERT` for sightings currently does not save `user_id` — needs to be added |
| Photo storage as base64 in DB | Large images will bloat the database — recommend migrating to Supabase Storage |
