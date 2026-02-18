# Sprint 1

## User Stories

### Hailin — Frontend UI & Map

1. As a frontend developer, I need to use Figma to design the user login page so that users can log in to the web using email and password.

2. As a frontend developer, I need to implement the Login & Signup pages so that the backend developer can start setting up the rules for login email and password and make sure users can log in with valid account info.

3. As a frontend developer, I need to implement the framework structure of the website including the "Map", "Species", and "Profile" tabs so that users know the main functionalities of the app.

4. As a frontend developer, I need to implement the functionality of adding animal sightings when users search a location or pick a location on the map so that they can record the animals they found on campus.

5. As a frontend developer, I need to build the Profile page with user info display, sighting statistics, personal sighting history (with edit/delete), profile editing, and logout so that users can manage their account and review their contributions.

---

### Yao Min — Backend API & Authentication

6. As a backend developer, I need to implement a secure user registration and login API so that users can create accounts and authenticate with email and password.

   Acceptance Criteria:
   - User can register with username, email, and password
   - Passwords are hashed using bcrypt before storing
   - Login returns a JWT token for session management
   - Duplicate email/username returns an appropriate error

7. As a backend developer, I need to implement CRUD API endpoints for animal sightings so that the frontend can save, retrieve, update, and delete sighting records.

   Acceptance Criteria:
   - Backend API supports GET, POST, PUT, DELETE for sightings
   - Latitude, longitude, address, and timestamp are stored per sighting
   - Each photo ID is linked to its sighting record
   - CORS is configured to allow communication between frontend (port 4200) and backend (port 8080)

---

### Zhengqi Li — Database Setup, Map Popup & Species Classification

8. As a developer, I need to set up a cloud PostgreSQL database so that all user and sighting data can be persistently stored and shared across the team.

   Acceptance Criteria:
   - Supabase PostgreSQL database is created and configured
   - Tables for users, animals, and messages are initialized automatically on backend startup
   - Database connection uses Session Pooler for network compatibility
   - Supabase Storage bucket `wildlife-photos` is created for photo storage

9. As a user, I want to click on the map and fill out a popup form to report an animal sighting so that I can easily log what I saw and where.

   Acceptance Criteria:
   - Clicking anywhere on the map opens a sighting form popup
   - The form includes a two-level species selector (category → specific species, e.g. Mammal → Squirrel)
   - The selected species is saved and displayed on the map marker

10. As a user, I want to browse animal species by category so that I can explore what has been spotted on campus.

    Acceptance Criteria:
    - The Species page displays categories (Mammal, Bird, Reptile, etc.) as grid cards
    - Clicking a category shows the specific species recorded under it
    - Category cover photo is automatically taken from the latest sighting photo in that category

11. As a user, I want to browse a shared photo gallery so that I can see what animals other users have spotted on campus.

    Acceptance Criteria:
    - The Photos page displays all submitted sighting photos in a card grid layout
    - Photos are grouped by category and shared across all users
    - Photos are stored in Supabase Storage, not directly in the database

---

## What Issues Our Team Planned to Address

- Build the interactive Map page with location search, map click-to-pin, and a sighting submission form (including photo upload).
- Set up cloud database and connect frontend to backend API.
- Implement species classification system with two-level navigation.
- Build a shared photo gallery page.

## Which Ones Were Successfully Completed

- **Login & Signup pages** — Fully implemented with email/password validation, password strength requirements, loading states, and UF-branded styling.
- **App shell & navigation** — Home layout with top bar, bottom tab navigation (Map / Species / Photos / Profile), and switches smoothly between all pages.
- **Map page** — Interactive Leaflet map centered on UF campus. Supports location search via Nominatim, click-to-pin, reverse geocoding, and a full sighting form with two-level species selector, category chips, behavior select, drag-and-drop photo upload, and marker rendering by category color.
- **Species page** — Displays animal categories as grid cards (Mammal, Bird, Reptile, etc.). Clicking a category shows specific species recorded under it. Cover photo is auto-filled from the latest sighting photo in that category.
- **Photos page** — Shared photo gallery displaying all sighting cards grouped by category. Photos are stored in Supabase Storage.
- **Profile page** — User info card (avatar, username, email, role badge, join date), 4-stat dashboard (Total Sightings, Unique Species, Locations, Top Category), personal sighting list with inline edit and delete (with confirmation step), Edit Profile form, and Logout button.
- **Database** — Supabase PostgreSQL database set up with users, animals, and messages tables. Session Pooler used for network compatibility. Supabase Storage configured for photo uploads.
- **Backend API** — Full CRUD endpoints for sightings, secure user authentication with bcrypt and JWT, CORS configured for frontend-backend communication.

### We Chose Leaflet + OpenStreetMap for the Map Page

When building the interactive map — the core feature of UF Wildlife — we needed a mapping solution that supports **click-to-pin location selection**, **custom colored markers per animal category**, **location search with geocoding**, and **popup info windows on each sighting**. We evaluated the options and chose **Leaflet.js + OpenStreetMap (OSM)** for the following reasons:

**1. Completely free and open-source — no API key, no billing, no usage limits.**
Google Maps requires a Google Cloud billing account and charges per map load and per geocoding request after the free tier. For a student project with unpredictable traffic, this is a risk. Leaflet + OSM tiles are 100% free with no API key required, and the Nominatim geocoding API is also free to use.

**2. Lightweight and fast.**
The entire Leaflet library is ~42 KB gzipped. Google Maps JS SDK is significantly larger. Since our app is a mobile-first SPA where users switch between Map/Species/Profile tabs frequently, keeping the bundle small matters for load speed. We also **dynamically import** Leaflet (`await import('leaflet')`) so the library is only loaded when the user actually visits the Map tab, not on initial page load.

**3. Full control over custom markers.**
A key UX requirement was that each animal category (Mammal, Bird, Reptile, etc.) should have its own colored pin on the map. With Leaflet, we generate custom SVG pin icons on the fly using inline SVG + `btoa()` base64 encoding, and cache them in a `Map<string, L.Icon>` so each color is only created once. This gives us pixel-perfect control over marker appearance without needing external image assets.

### How We Installed and Integrated Leaflet + OpenStreetMap

**Step 1 — Install packages:**
```bash
npm install leaflet @types/leaflet
```
`leaflet` is the map library itself; `@types/leaflet` provides TypeScript type definitions. OpenStreetMap does not require a separate package — it is loaded as a tile URL at runtime.

**Step 2 — Allow CommonJS in Angular build:**
Leaflet is a CommonJS module, which Angular flags with a build warning by default. We added the following in `angular.json` under `architect > build > options`:
```json
"allowedCommonJsDependencies": ["leaflet"]
```

**Step 3 — Import Leaflet CSS globally:**
Leaflet's CSS controls the layout of map tiles, zoom buttons, popups, and attribution. We import it in `src/styles.css`:
```css
@import 'leaflet/dist/leaflet.css';
```

**Step 4 — Dynamic import in the component to support SSR:**
Our app uses Server-Side Rendering, but Leaflet requires browser APIs (`window`, `document`). To avoid server crashes, we do not import Leaflet at the top of the file. Instead, in `map.ts`:
```typescript
import type * as L from 'leaflet';          // type-only (erased at compile time)

async ngAfterViewInit() {
  if (!isPlatformBrowser(this.platformId)) return;   // skip on server
  const leaflet = await import('leaflet');            // load only in browser
  this.map = leaflet.map('map', { center: [29.6436, -82.3549], zoom: 15 });
  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
  }).addTo(this.map);
}
```
This also means Leaflet is lazy-loaded — it only downloads when the user visits the Map tab, keeping the initial bundle small.

## Which Ones Didn't and Why

- **Species detail page (Partially completed)** — The Species page currently supports two-level navigation: users can browse by category (e.g. Mammal) and see a list of specific species (e.g. Squirrel). However, clicking on an individual species does not yet display any detail view. The planned functionality is to show a dedicated page for each species with its sighting history, photos, and statistics. This will be implemented in Sprint 2.

- **Heatmap layer on the map (Not started)** — We planned to add a heatmap overlay on the map to visualize the density of animal sightings across campus. However, this feature requires sufficient sighting data to be meaningful, and we have not yet collected enough data points to generate a useful heatmap. This feature will be revisited in a later sprint once more sightings have been submitted by users.
