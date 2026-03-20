/// <reference types="cypress" />

describe('Login Page', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should fill in the login form and submit', () => {
    // Type email and password
    cy.get('#email').type('test@ufl.edu');
    cy.get('#password').type('Password1');

    // Verify the values were entered correctly
    cy.get('#email').should('have.value', 'test@ufl.edu');
    cy.get('#password').should('have.value', 'Password1');

    // Click the Sign In button
    cy.get('button[type="submit"]').click();
  });
});
