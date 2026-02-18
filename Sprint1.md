# Sprint 1

## User Stories

1. As a frontend developer, I need to use Figma to design the user login page so that users can log in to the web using email and password.

2. As a frontend developer, I need to implement the Login & Signup pages so that the backend developer can start setting up the rules for login email and password and make sure users can log in with valid account info.

3. As a frontend developer, I need to implement the framework structure of the website including the "Map", "Species", and "Profile" tabs so that users know the main functionalities of the app.

4. As a frontend developer, I need to implement the functionality of adding animal sightings when users search a location or pick a location on the map so that they can record the animals they found on campus.

5. As a frontend developer, I need to build the Profile page with user info display, sighting statistics, personal sighting history (with edit/delete), profile editing, and logout so that users can manage their account and review their contributions.


## What Issues Our Team Planned to Address

- Build the interactive Map page with location search, map click-to-pin, and a sighting submission form (including photo upload).

## Which Ones Were Successfully Completed

- **Login & Signup pages** — Fully implemented with email/password validation, password strength requirements, loading states, and UF-branded styling.
- **App shell & navigation** — Home layout with top bar, bottom tab navigation (Map / Species / Profile), and switch smoothly between all pages.
- **Map page** — Interactive Leaflet map centered on UF campus. Supports location search via Nominatim, click-to-pin, reverse geocoding, and a full sighting form with category chips, behavior select, drag-and-drop photo upload, and marker rendering by category color.
- **Species page** — Displays all sightings grouped by category with responsive card grids, photos, and category-colored badges.
- **Profile page** — User info card (avatar, username, email, role badge, join date), 4-stat dashboard (Total Sightings, Unique Species, Locations, Top Category), personal sighting list with inline edit and delete (with confirmation step), Edit Profile form (username, email, role, avatar upload), and Logout button.

### We Chose Leaflet + OpenStreetMap for the Map Page

When building the interactive map — the core feature of UF Wildlife — we needed a mapping solution that supports **click-to-pin location selection**, **custom colored markers per animal category**, **location search with geocoding**, and **popup info windows on each sighting**. We evaluated the options and chose **Leaflet.js + OpenStreetMap (OSM)** for the following reasons:

**1. Completely free and open-source — no API key, no billing, no usage limits.**
Google Maps requires a Google Cloud billing account and charges per map load and per geocoding request after the free tier. For a student project with unpredictable traffic, this is a risk. Leaflet + OSM tiles are 100% free with no API key required, and the Nominatim geocoding API is also free to use.

**2. Lightweight and fast.**
The entire Leaflet library is ~42 KB gzipped. Google Maps JS SDK is significantly larger. Since our app is a mobile-first SPA where users switch between Map/Species/Profile tabs frequently, keeping the bundle small matters for load speed. We also **dynamically import** Leaflet (`await import('leaflet')`) so the library is only loaded when the user actually visits the Map tab, not on initial page load.

**3. Full control over custom markers.**
A key UX requirement was that each animal category (Mammal, Bird, Reptile, etc.) should have its own colored pin on the map. With Leaflet, we generate custom SVG pin icons on the fly using inline SVG + `btoa()` base64 encoding, and cache them in a `Map<string, L.Icon>` so each color is only created once. This gives us pixel-perfect control over marker appearance without needing external image assets. The same approach would require significantly more boilerplate with Google Maps' `AdvancedMarkerElement`.

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


