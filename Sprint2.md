# Sprint 2

## Detail work we've completed in Sprint 2

### Added the new feature: Heatmap on the Main Map Page

In Sprint 1, the main map page displayed individual colored pins for each animal sighting. While this works well for viewing specific records, it becomes difficult to read at a glance when many sightings are clustered in the same area — the pins overlap and the overall density pattern is hard to see.

The **heatmap layer** solves this by visualizing the *density and intensity* of sightings across campus using overlapping colored circles instead of individual pins. Areas where many sightings have been reported appear as bright, dense hot spots, while sparse areas remain faint. This gives users an immediate visual understanding of *where* wildlife activity is concentrated on the UF campus without needing to read individual markers.

Each sighting is represented by two concentric circles:
- **Outer circle** — large radius, low opacity, warm orange color. Creates a soft glow that blends with nearby sightings to form a continuous heat field.
- **Inner circle** — smaller radius, higher opacity, deep red-orange color. Marks the exact location of the sighting as a concentrated hot point.

The radius of both circles scales with the **quantity** field of each sighting (how many animals were observed). A sighting of 10 animals produces a larger, more prominent heat spot than a sighting of 1, accurately reflecting ecological significance.

### How to Use the Heatmap

1. Open the **Map** tab from the bottom navigation bar.
2. In the **top-right corner** of the map, find the **"Heatmap"** button.
3. Click the button to switch from the standard pin markers to the heatmap view.
   - The button turns **red-orange** and its label changes to **"Markers"** to indicate heatmap mode is active.
   - All individual colored pins are hidden and replaced by overlapping heat circles.
4. To return to the standard pin view, click the button again (now labeled **"Markers"**).
   - The button returns to its default white style and individual pins reappear.

The heatmap updates automatically whenever new sightings are added — no page refresh is needed.

---

## Frontend Testing

### Unit Tests

Unit tests verify that individual **functions and classes** behave correctly in isolation. The real backend is never contacted — all HTTP calls are replaced with mocks using `vi.fn()`. Tests run entirely in Node.js without a browser.

**Framework:** Vitest 4.0.8 + Angular TestBed
**Run command:**
```bash
cd frontend
npm test
```

#### Test Files and Coverage

**`src/app/auth.service.spec.ts`** — 7 tests

| Test | Function Tested |
|------|----------------|
| `isLoggedIn` returns false when no user is set | `isLoggedIn` computed signal |
| `login()` sets currentUser and stores JWT token on success | `login()` |
| `login()` throws when backend returns 401 Unauthorized | `login()` error path |
| `signup()` sets currentUser on successful registration | `signup()` |
| `signup()` throws when backend returns 409 Conflict | `signup()` error path |
| `updateProfile()` merges new fields without touching other fields | `updateProfile()` |
| `logout()` clears currentUser and removes JWT from localStorage | `logout()` |

**`src/app/sighting.service.spec.ts`** — 8 tests

| Test | Function Tested |
|------|----------------|
| `sightings()` starts as an empty array | `sightings` signal |
| `groupedByCategory()` groups sightings by category using real backend response format | `groupedByCategory()` |
| `loadAll()` correctly maps backend fields to frontend Sighting shape | `loadAll()` |
| `add()` uses the server-assigned integer id from POST response | `add()` success path |
| `add()` falls back to local insert when the backend is unreachable | `add()` fallback path |
| `remove()` deletes the sighting locally after backend DELETE succeeds | `remove()` |
| `update()` merges changed fields after backend PUT succeeds | `update()` |
| `update()` does nothing when the sighting id does not exist locally | `update()` no-op path |

**`src/app/map/map.spec.ts`** — 13 tests

| Test | Function Tested |
|------|----------------|
| `toggleHeatmap()` flips showHeatmap from false to true | `toggleHeatmap()` |
| `toggleHeatmap()` flips showHeatmap back to false on second call | `toggleHeatmap()` |
| `onCategoryChipClick()` sets category and clears animalName | `onCategoryChipClick()` |
| `onCategoryChipClick()` switching category resets animalName | `onCategoryChipClick()` |
| `availableSpecies` returns species list for selected category | `availableSpecies` getter |
| `availableSpecies` returns empty array for "Other" category | `availableSpecies` getter |
| `categoryColor()` returns the correct color for Bird | `categoryColor()` |
| `categoryColor()` falls back to Other color for unknown category | `categoryColor()` |
| `openSightingForm()` shows the modal and sets coordinates | `openSightingForm()` |
| `closeSightingForm()` hides the modal | `closeSightingForm()` |
| `updateField()` updates a single field without affecting others | `updateField()` |
| `removePhoto()` clears photoPreview and photoFile | `removePhoto()` |
| `clearSearch()` resets query, results, and search state | `clearSearch()` |

**`src/app/app.spec.ts`** — 2 tests

| Test | Function Tested |
|------|----------------|
| Should create the app | Root component initialization |
| Should contain a router-outlet for navigation | Root template structure |

**Total: 30 unit tests, all passing.**

---

### Cypress E2E Test

End-to-end (E2E) tests simulate a real user interacting with the application inside a real browser. Unlike unit tests, Cypress loads the full Angular app, clicks buttons, types into inputs, and verifies what the user actually sees on screen.

**Framework:** Cypress 15.12.0
**Test file:** `cypress/e2e/login.cy.ts`

#### Three Core Concepts of Cypress

**1. `cy.get()` — Find an element on the page**

Uses CSS selectors to locate DOM elements, the same way a browser's DevTools inspector would:
```typescript
cy.get('#email')                  // find by id
cy.get('.login-btn')              // find by class
cy.get('button[type="submit"]')   // find by attribute
cy.get('h1.app-title')            // find by tag + class
```

The selectors are derived directly from the HTML source. For example, `<input id="email" />` in `login.html` → `cy.get('#email')`.

**2. Action commands — Interact with the element**

Chain actions onto a found element to simulate user behavior:
```typescript
cy.get('#email').type('test@ufl.edu')   // type text into an input
cy.get('.login-btn').click()            // click a button
```

**3. `.should()` — Assert the expected result**

Verify that the element or page is in the correct state after the interaction:
```typescript
cy.get('#email').should('have.value', 'test@ufl.edu')  // input contains the typed value
cy.get('#password').should('have.attr', 'type', 'password')  // input is a password field
cy.get('button[type="submit"]').should('contain.text', 'Sign In')  // button label
cy.url().should('include', '/home')  // URL has changed after navigation
```

#### The Cypress Test

```typescript
describe('Login Page', () => {
  beforeEach(() => {
    cy.visit('/login');       // open the login page before each test
  });

  it('should fill in the login form and submit', () => {
    cy.get('#email').type('test@ufl.edu');
    cy.get('#password').type('Password1');

    cy.get('#email').should('have.value', 'test@ufl.edu');
    cy.get('#password').should('have.value', 'Password1');

    cy.get('button[type="submit"]').click();
  });
});
```

This test covers the most fundamental user interaction in the app: arriving at the login page, entering credentials, and clicking Sign In.

#### How to Run the Cypress Test

Cypress requires the Angular development server to be running first.

**Step 1 — Start the frontend (Terminal 1):**
```bash
cd frontend
npm start
# Wait until: Local: http://localhost:4200
```

**Step 2 — Open Cypress (Terminal 2):**
```bash
cd frontend
npm run cypress:open
```
In the Cypress window: click **E2E Testing** → select a browser → click **`login.cy.ts`**.

**Or run headlessly (no GUI):**
```bash
npm run cypress:run
```

---

### Differences Between Unit Tests and Cypress E2E Tests

| | Unit Tests | Cypress E2E Tests |
|---|---|---|
| **File naming** | `*.spec.ts` | `*.cy.ts` |
| **File location** | `src/app/` alongside source files | `cypress/e2e/` separate directory |
| **Run command** | `npm test` | `npm run cypress:open` |
| **What is tested** | Individual functions and class logic | Complete user flows in a real browser |
| **Backend required** | ❌ No — HTTP calls are mocked | ✅ Yes — or use `cy.intercept()` to mock |
| **Frontend server required** | ❌ No | ✅ Yes — `npm start` must be running |
| **Speed** | Very fast (~700ms for 30 tests) | Slower (real browser rendering) |
| **Purpose** | Catch logic bugs in functions | Catch UI and integration bugs |

**Unit tests** answer: *"Does this function return the right value when given this input?"*

**Cypress E2E tests** answer: *"Can a real user complete this action in the browser?"*

Both types of tests are necessary. Unit tests run on every save during development to catch regressions early. Cypress E2E tests verify that all the pieces work together as a complete application.
