/// <reference types="cypress" />

// Smoke tests for the bottom-bar navigation in the authenticated shell.
// Uses "Skip for now" so the tests do not require a backend account.
describe('Home Navigation', () => {
  beforeEach(() => {
    cy.visit('/login');
    cy.get('.skip-link').click();
    cy.location('pathname').should('include', '/home');
  });

  it('renders the top-bar branding and the four bottom-bar tabs', () => {
    cy.get('header.top-bar').should('contain', 'Wildlife');
    cy.get('nav.bottom-bar a.tab').should('have.length', 4);
  });

  it('navigates to the Map tab', () => {
    cy.get('nav.bottom-bar a[href$="/map"]').click();
    cy.location('pathname').should('eq', '/home/map');
  });

  it('navigates to the Species tab', () => {
    cy.get('nav.bottom-bar a[href$="/species"]').click();
    cy.location('pathname').should('eq', '/home/species');
  });

  it('navigates to the Photos tab', () => {
    cy.get('nav.bottom-bar a[href$="/photos"]').click();
    cy.location('pathname').should('eq', '/home/photos');
  });

  it('navigates to the Profile tab', () => {
    cy.get('nav.bottom-bar a[href$="/profile"]').click();
    cy.location('pathname').should('eq', '/home/profile');
  });

  it('moves between tabs in sequence', () => {
    // Use href-based selectors instead of cy.contains() so the lookup is not
    // confused by page text such as the photos empty-state hint
    // ("Go to the Map tab and submit a sighting...") which contains "Map".
    cy.get('nav.bottom-bar a[href$="/species"]').click();
    cy.location('pathname').should('eq', '/home/species');

    cy.get('nav.bottom-bar a[href$="/photos"]').click();
    cy.location('pathname').should('eq', '/home/photos');

    cy.get('nav.bottom-bar a[href$="/map"]').click();
    cy.location('pathname').should('eq', '/home/map');
  });
});
