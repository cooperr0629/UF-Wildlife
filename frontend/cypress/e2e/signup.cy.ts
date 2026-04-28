/// <reference types="cypress" />

describe('Signup Page', () => {
  beforeEach(() => {
    cy.visit('/signup');
  });

  it('renders all required signup fields', () => {
    cy.get('#username').should('exist');
    cy.get('#email').should('exist');
    cy.get('#password').should('exist');
    cy.get('#confirmPassword').should('exist');
    cy.get('.signup-btn').should('contain', 'Create Account');
  });

  it('fills in the signup form and submits', () => {
    cy.get('#username').type('NewGator');
    cy.get('#email').type('new@ufl.edu');
    cy.get('#password').type('Password1');
    cy.get('#confirmPassword').type('Password1');

    cy.get('#username').should('have.value', 'NewGator');
    cy.get('#email').should('have.value', 'new@ufl.edu');

    cy.get('.signup-btn').click();
  });

  it('updates the password requirement indicators as the user types', () => {
    cy.get('.password-requirements li.met').should('have.length', 0);
    cy.get('#password').type('Password1');
    cy.get('.password-requirements li.met').should('have.length', 3);
  });

  it('toggles password visibility on the password field', () => {
    cy.get('#password').type('secret');
    cy.get('#password').should('have.attr', 'type', 'password');
    cy.get('#password').siblings('.toggle-password').click();
    cy.get('#password').should('have.attr', 'type', 'text');
  });

  it('toggles confirm-password visibility independently', () => {
    cy.get('#confirmPassword').type('secret');
    cy.get('#confirmPassword').should('have.attr', 'type', 'password');
    cy.get('#confirmPassword').siblings('.toggle-password').click();
    cy.get('#confirmPassword').should('have.attr', 'type', 'text');
  });

  it('shows an error when no username is provided', () => {
    // Username field is plain text, so HTML5 validation will not block submission.
    cy.get('.signup-btn').click();
    cy.get('.error-message').should('be.visible');
  });

  it('shows an error when passwords do not match', () => {
    cy.get('#username').type('NewGator');
    cy.get('#email').type('new@ufl.edu');
    cy.get('#password').type('Password1');
    cy.get('#confirmPassword').type('Password2');
    cy.get('.signup-btn').click();
    cy.get('.error-message').should('contain', 'do not match');
  });

  it('navigates back to /login via the "Sign In" link', () => {
    cy.get('a.login-link').click();
    cy.location('pathname').should('eq', '/login');
  });
});
