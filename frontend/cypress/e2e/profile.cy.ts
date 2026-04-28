/// <reference types="cypress" />

// These specs verify the unauthenticated profile experience.
// We clear localStorage in onBeforeLoad so the AuthService constructor's
// restoreUser() always returns null and the guest placeholder is rendered.
describe('Profile Page (guest)', () => {
  beforeEach(() => {
    cy.visit('/home/profile', {
      onBeforeLoad(win) {
        win.localStorage.clear();
      },
    });
  });

  it('shows the guest placeholder with a Log In link when no user is signed in', () => {
    cy.get('.placeholder', { timeout: 10000 }).should('be.visible');
    cy.get('.placeholder h2').should('contain', 'Profile');
    cy.get('.placeholder a.btn-login').should('contain', 'Log In');
  });

  it('navigates to /login when the Log In link is clicked from the guest view', () => {
    cy.get('.placeholder a.btn-login', { timeout: 10000 }).should('be.visible').click();
    cy.location('pathname', { timeout: 10000 }).should('eq', '/login');
  });
});
