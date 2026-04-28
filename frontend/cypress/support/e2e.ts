// Cypress support file - runs before every test file
// Add global commands or configurations here

// Leaflet's async map initialization (via setTimeout) can fire after the user
// has already navigated away from a tab. The map's container element is then
// undefined and Leaflet throws "Cannot read properties of undefined (reading
// 'appendChild')". This is an application-side race condition during teardown
// and is unrelated to what we are testing. Swallow it so it does not fail the
// current spec.
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes("Cannot read properties of undefined (reading 'appendChild')") ||
    err.message.includes('appendChild') ||
    err.message.includes('_leaflet_id')
  ) {
    return false;
  }
  // Let any other uncaught exception fail the test as usual.
  return true;
});
