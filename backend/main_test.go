package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

// ---------- generateJWT ----------

func TestGenerateJWT_Success(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	tokenStr, err := generateJWT(1, "test@ufl.edu")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if tokenStr == "" {
		t.Fatal("expected non-empty token")
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (any, error) {
		return []byte("test-secret"), nil
	})
	if err != nil || !token.Valid {
		t.Fatalf("token is invalid: %v", err)
	}

	claims := token.Claims.(jwt.MapClaims)
	if claims["email"] != "test@ufl.edu" {
		t.Errorf("expected email claim 'test@ufl.edu', got %v", claims["email"])
	}
	if int(claims["user_id"].(float64)) != 1 {
		t.Errorf("expected user_id claim 1, got %v", claims["user_id"])
	}
}

func TestGenerateJWT_DefaultSecret(t *testing.T) {
	os.Unsetenv("JWT_SECRET")
	tokenStr, err := generateJWT(99, "admin@ufl.edu")
	if err != nil {
		t.Fatalf("expected no error with default secret, got %v", err)
	}
	if tokenStr == "" {
		t.Fatal("expected non-empty token")
	}
}

// ---------- handleSignup ----------

func TestHandleSignup_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/signup", nil)
	w := httptest.NewRecorder()
	handleSignup(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleSignup_MissingFields(t *testing.T) {
	body := `{"username":"","email":"","password":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/signup", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleSignup(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleSignup_InvalidEmailDomain(t *testing.T) {
	body := `{"username":"testuser","email":"test@gmail.com","password":"Pass123!","confirmPassword":"Pass123!"}`
	req := httptest.NewRequest(http.MethodPost, "/api/signup", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleSignup(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-ufl.edu email, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "@ufl.edu") {
		t.Errorf("expected @ufl.edu error message, got: %s", resp["error"])
	}
}

func TestHandleSignup_PasswordMismatch(t *testing.T) {
	body := `{"username":"testuser","email":"test@ufl.edu","password":"Pass123!","confirmPassword":"Different!"}`
	req := httptest.NewRequest(http.MethodPost, "/api/signup", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleSignup(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for password mismatch, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "Passwords do not match") {
		t.Errorf("unexpected error message: %s", resp["error"])
	}
}

func TestHandleSignup_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/signup", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleSignup(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
	}
}

// ---------- handleLogin ----------

func TestHandleLogin_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/login", nil)
	w := httptest.NewRecorder()
	handleLogin(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleLogin_MissingFields(t *testing.T) {
	body := `{"email":"","password":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleLogin(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleLogin_InvalidEmailDomain(t *testing.T) {
	body := `{"email":"user@yahoo.com","password":"somepassword"}`
	req := httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleLogin(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-ufl.edu email, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "@ufl.edu") {
		t.Errorf("expected @ufl.edu error message, got: %s", resp["error"])
	}
}

// ---------- handleStats ----------

func TestHandleStats_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// ---------- Comments ----------

func TestHandleGetComments_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/sightings/1/messages", nil)
	w := httptest.NewRecorder()
	handleGetComments(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleCreateComment_MissingContent(t *testing.T) {
	body := `{"content":"","sender":"gator","sender_id":"1"}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings/1/messages", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateComment(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty content, got %d", w.Code)
	}
}

func TestHandleDeleteComment_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/messages/1", nil)
	w := httptest.NewRecorder()
	handleDeleteComment(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// ---------- writeJSON ----------

func TestWriteJSON_SetsContentType(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, map[string]string{"key": "value"})
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", ct)
	}
}

func TestWriteJSON_EncodesBody(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
	var result map[string]string
	json.NewDecoder(w.Body).Decode(&result)
	if result["status"] != "ok" {
		t.Errorf("expected status 'ok', got %s", result["status"])
	}
}
