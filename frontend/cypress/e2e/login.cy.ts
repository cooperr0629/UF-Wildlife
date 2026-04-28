/// <reference types="cypress" />

describe('Login Page', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('renders the email and password fields and the Sign In button', () => {
    cy.get('#email').should('exist');
    cy.get('#password').should('exist');
    cy.get('.login-btn').should('contain', 'Sign In');
  });

  it('fills in the login form and submits', () => {
    cy.get('#email').type('test@ufl.edu');
    cy.get('#password').type('Password1');

    cy.get('#email').should('have.value', 'test@ufl.edu');
    cy.get('#password').should('have.value', 'Password1');

    cy.get('.login-btn').click();
  });

  it('toggles password visibility when clicking the eye button', () => {
    cy.get('#password').type('mypassword');
    cy.get('#password').should('have.attr', 'type', 'password');
    cy.get('.toggle-password').click();
    cy.get('#password').should('have.attr', 'type', 'text');
    cy.get('.toggle-password').click();
    cy.get('#password').should('have.attr', 'type', 'password');
  });

  it('navigates to the signup page via the "Create an Account" link', () => {
    cy.get('a.signup-link').click();
    cy.location('pathname').should('eq', '/signup');
  });

  it('navigates to /home when "Skip for now" is clicked', () => {
    cy.get('.skip-link').click();
    cy.location('pathname').should('include', '/home');
  });

  it('shows an error message when submitted with no input', () => {
    // Empty email field has no `required` attribute, so HTML5 validation
    // does not block submission — Angular's onSubmit() runs and shows the error.
    cy.get('.login-btn').click();
    cy.get('.error-message').should('be.visible');
  });
});
