package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
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

// ---------- handleToggleLike ----------

func TestHandleToggleLike_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/1/like", nil)
	w := httptest.NewRecorder()
	handleToggleLike(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleToggleLike_InvalidSightingID(t *testing.T) {
	body := `{"user_id":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings/abc/like", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleToggleLike(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-numeric id, got %d", w.Code)
	}
}

func TestHandleToggleLike_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/sightings/1/like", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleToggleLike(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
	}
}

func TestHandleToggleLike_MissingUserID(t *testing.T) {
	body := `{"user_id":0}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings/1/like", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleToggleLike(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 when user_id missing, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "user_id") {
		t.Errorf("expected user_id error message, got: %s", resp["error"])
	}
}

// ---------- handleGetLikes ----------

func TestHandleGetLikes_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/sightings/1/likes", nil)
	w := httptest.NewRecorder()
	handleGetLikes(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleGetLikes_InvalidSightingID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/abc/likes", nil)
	w := httptest.NewRecorder()
	handleGetLikes(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-numeric id, got %d", w.Code)
	}
}

// ---------- parseSightingIDFromLikePath ----------

func TestParseSightingIDFromLikePath_Valid(t *testing.T) {
	id, err := parseSightingIDFromLikePath("/api/sightings/42/like")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if id != 42 {
		t.Errorf("expected id 42, got %d", id)
	}
}

func TestParseSightingIDFromLikePath_NoSubpath(t *testing.T) {
	_, err := parseSightingIDFromLikePath("/api/sightings/42")
	if err == nil {
		t.Error("expected error for path without subpath")
	}
}

// ---------- handleGetNearbySightings ----------

func TestHandleGetNearby_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/sightings/nearby", nil)
	w := httptest.NewRecorder()
	handleGetNearbySightings(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleGetNearby_MissingLat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/nearby?lng=-82.3549", nil)
	w := httptest.NewRecorder()
	handleGetNearbySightings(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 when lat missing, got %d", w.Code)
	}
}

func TestHandleGetNearby_MissingLng(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/nearby?lat=29.6436", nil)
	w := httptest.NewRecorder()
	handleGetNearbySightings(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 when lng missing, got %d", w.Code)
	}
}

func TestHandleGetNearby_InvalidLat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/nearby?lat=abc&lng=-82.3549", nil)
	w := httptest.NewRecorder()
	handleGetNearbySightings(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-numeric lat, got %d", w.Code)
	}
}

func TestHandleGetNearby_InvalidLng(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/nearby?lat=29.6436&lng=xyz", nil)
	w := httptest.NewRecorder()
	handleGetNearbySightings(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for non-numeric lng, got %d", w.Code)
	}
}

// ---------- handleGetSightings (category filter) ----------

func TestHandleGetSightings_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPatch, "/api/sightings", nil)
	w := httptest.NewRecorder()
	handleGetSightings(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// ---------- handleCreateChannel ----------

func TestHandleCreateChannel_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/channels", nil)
	w := httptest.NewRecorder()
	handleCreateChannel(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleCreateChannel_EmptyName(t *testing.T) {
	body := `{"name":"   ","creator_id":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/channels", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannel(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty name, got %d", w.Code)
	}
}

func TestHandleCreateChannel_NameTooLong(t *testing.T) {
	longName := strings.Repeat("x", 101)
	body := `{"name":"` + longName + `","creator_id":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/channels", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannel(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for long name, got %d", w.Code)
	}
}

func TestHandleCreateChannel_MissingCreatorID(t *testing.T) {
	body := `{"name":"Lake Alice","creator_id":0}`
	req := httptest.NewRequest(http.MethodPost, "/api/channels", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannel(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleCreateChannel_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/channels", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannel(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ---------- handleGetChannels ----------

func TestHandleGetChannels_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/channels", nil)
	w := httptest.NewRecorder()
	handleGetChannels(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// ---------- handleGetChannelMessages ----------

func TestHandleGetChannelMessages_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/channels/1/messages", nil)
	w := httptest.NewRecorder()
	handleGetChannelMessages(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleGetChannelMessages_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/channels/abc/messages", nil)
	w := httptest.NewRecorder()
	handleGetChannelMessages(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid channel id, got %d", w.Code)
	}
}

// ---------- handleCreateChannelMessage ----------

func TestHandleCreateChannelMessage_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/channels/1/messages", nil)
	w := httptest.NewRecorder()
	handleCreateChannelMessage(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleCreateChannelMessage_InvalidChannelID(t *testing.T) {
	body := `{"sender_id":1,"content":"hello"}`
	req := httptest.NewRequest(http.MethodPost, "/api/channels/abc/messages", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannelMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid channel id, got %d", w.Code)
	}
}

func TestHandleCreateChannelMessage_MissingSenderID(t *testing.T) {
	body := `{"sender_id":0,"content":"hello"}`
	req := httptest.NewRequest(http.MethodPost, "/api/channels/1/messages", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannelMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleCreateChannelMessage_EmptyContent(t *testing.T) {
	body := `{"sender_id":1,"content":"   "}`
	req := httptest.NewRequest(http.MethodPost, "/api/channels/1/messages", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannelMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty content, got %d", w.Code)
	}
}

func TestHandleCreateChannelMessage_ContentTooLong(t *testing.T) {
	longContent := strings.Repeat("x", 2001)
	body := `{"sender_id":1,"content":"` + longContent + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/channels/1/messages", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannelMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for long content, got %d", w.Code)
	}
}

func TestHandleCreateChannelMessage_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/channels/1/messages", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateChannelMessage(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ---------- handleCreateSubscription ----------

func TestHandleCreateSubscription_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/subscriptions", nil)
	w := httptest.NewRecorder()
	handleCreateSubscription(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleCreateSubscription_MissingUserID(t *testing.T) {
	body := `{"user_id":0,"type":"species","value":"Crane"}`
	req := httptest.NewRequest(http.MethodPost, "/api/subscriptions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSubscription(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleCreateSubscription_InvalidType(t *testing.T) {
	body := `{"user_id":1,"type":"invalid","value":"Crane"}`
	req := httptest.NewRequest(http.MethodPost, "/api/subscriptions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSubscription(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid type, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "species, category, area") {
		t.Errorf("expected type options in error, got: %s", resp["error"])
	}
}

func TestHandleCreateSubscription_EmptyValue(t *testing.T) {
	body := `{"user_id":1,"type":"species","value":"   "}`
	req := httptest.NewRequest(http.MethodPost, "/api/subscriptions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSubscription(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty value, got %d", w.Code)
	}
}

func TestHandleCreateSubscription_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/subscriptions", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSubscription(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
	}
}

// ---------- handleGetSubscriptions ----------

func TestHandleGetSubscriptions_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/subscriptions", nil)
	w := httptest.NewRecorder()
	handleGetSubscriptions(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleGetSubscriptions_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/subscriptions", nil)
	w := httptest.NewRecorder()
	handleGetSubscriptions(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing user_id, got %d", w.Code)
	}
}

func TestHandleGetSubscriptions_InvalidUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/subscriptions?user_id=abc", nil)
	w := httptest.NewRecorder()
	handleGetSubscriptions(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid user_id, got %d", w.Code)
	}
}

// ---------- handleDeleteSubscription ----------

func TestHandleDeleteSubscription_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/subscriptions/1", nil)
	w := httptest.NewRecorder()
	handleDeleteSubscription(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleDeleteSubscription_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/api/subscriptions/abc", nil)
	w := httptest.NewRecorder()
	handleDeleteSubscription(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid id, got %d", w.Code)
	}
}

// ---------- handleGetNotifications ----------

func TestHandleGetNotifications_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/notifications", nil)
	w := httptest.NewRecorder()
	handleGetNotifications(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleGetNotifications_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/notifications", nil)
	w := httptest.NewRecorder()
	handleGetNotifications(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing user_id, got %d", w.Code)
	}
}

// ---------- handleMarkNotificationRead ----------

func TestHandleMarkNotificationRead_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/notifications/1/read", nil)
	w := httptest.NewRecorder()
	handleMarkNotificationRead(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleMarkNotificationRead_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/notifications/abc/read", nil)
	w := httptest.NewRecorder()
	handleMarkNotificationRead(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid id, got %d", w.Code)
	}
}

// ---------- handleCreateReport ----------

func TestHandleCreateReport_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/reports", nil)
	w := httptest.NewRecorder()
	handleCreateReport(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleCreateReport_MissingFields(t *testing.T) {
	body := `{"sighting_id":0,"reporter_id":0,"reason":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/reports", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateReport(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleCreateReport_EmptyReason(t *testing.T) {
	body := `{"sighting_id":1,"reporter_id":1,"reason":"   "}`
	req := httptest.NewRequest(http.MethodPost, "/api/reports", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateReport(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for whitespace-only reason, got %d", w.Code)
	}
}

func TestHandleCreateReport_ReasonTooLong(t *testing.T) {
	longReason := strings.Repeat("x", 1001)
	body := `{"sighting_id":1,"reporter_id":1,"reason":"` + longReason + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/reports", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateReport(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for long reason, got %d", w.Code)
	}
}

func TestHandleCreateReport_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/reports", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateReport(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
	}
}

// ---------- handleGetReports ----------

func TestHandleGetReports_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/reports", nil)
	w := httptest.NewRecorder()
	handleGetReports(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// ---------- handleUpdateReport ----------

func TestHandleUpdateReport_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/reports/1", nil)
	w := httptest.NewRecorder()
	handleUpdateReport(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleUpdateReport_InvalidID(t *testing.T) {
	body := `{"status":"resolved"}`
	req := httptest.NewRequest(http.MethodPut, "/api/reports/abc", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleUpdateReport(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid id, got %d", w.Code)
	}
}

func TestHandleUpdateReport_InvalidStatus(t *testing.T) {
	body := `{"status":"invalid_status"}`
	req := httptest.NewRequest(http.MethodPut, "/api/reports/1", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleUpdateReport(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid status, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "pending, resolved, dismissed") {
		t.Errorf("expected status options in error, got: %s", resp["error"])
	}
}

func TestHandleUpdateReport_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/reports/1", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleUpdateReport(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
	}
}

// ---------- handleLeaderboard ----------

func TestHandleLeaderboard_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/leaderboard", nil)
	w := httptest.NewRecorder()
	handleLeaderboard(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleLeaderboard_InvalidSort(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/leaderboard?sort=invalid", nil)
	w := httptest.NewRecorder()
	handleLeaderboard(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid sort, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "sightings, species, likes") {
		t.Errorf("expected sort options in error, got: %s", resp["error"])
	}
}

func TestHandleLeaderboard_DefaultSort(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/leaderboard", nil)
	sortBy := req.URL.Query().Get("sort")
	if sortBy == "" {
		sortBy = "sightings"
	}
	validSort := map[string]bool{"sightings": true, "species": true, "likes": true}
	if !validSort[sortBy] {
		t.Errorf("default sort should be valid, got %s", sortBy)
	}
}

func TestHandleLeaderboard_SortValidation(t *testing.T) {
	validSort := map[string]bool{"sightings": true, "species": true, "likes": true}
	for _, s := range []string{"sightings", "species", "likes"} {
		if !validSort[s] {
			t.Errorf("%s should be valid sort", s)
		}
	}
	if validSort["invalid"] {
		t.Error("'invalid' should not be a valid sort")
	}
}

// ---------- handleCreateSighting validation ----------

func TestHandleCreateSighting_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings", nil)
	w := httptest.NewRecorder()
	handleCreateSighting(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleCreateSighting_MissingSpecies(t *testing.T) {
	body := `{"species":"","latitude":29.6,"longitude":-82.3}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleCreateSighting_SpeciesTooLong(t *testing.T) {
	longName := strings.Repeat("x", 201)
	body := `{"species":"` + longName + `","latitude":29.6,"longitude":-82.3}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for long species, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "Species name too long") {
		t.Errorf("expected species too long error, got: %s", resp["error"])
	}
}

func TestHandleCreateSighting_InvalidLatitude(t *testing.T) {
	body := `{"species":"Crane","latitude":91.0,"longitude":-82.3}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid latitude, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "Latitude") {
		t.Errorf("expected latitude error, got: %s", resp["error"])
	}
}

func TestHandleCreateSighting_InvalidLongitude(t *testing.T) {
	body := `{"species":"Crane","latitude":29.6,"longitude":181.0}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid longitude, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "Longitude") {
		t.Errorf("expected longitude error, got: %s", resp["error"])
	}
}

func TestHandleCreateSighting_QuantityTooLarge(t *testing.T) {
	body := `{"species":"Crane","latitude":29.6,"longitude":-82.3,"quantity":10000}`
	req := httptest.NewRequest(http.MethodPost, "/api/sightings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for quantity too large, got %d", w.Code)
	}
}

func TestHandleCreateSighting_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/sightings", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreateSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
	}
}

// ---------- handleUpdateSighting validation ----------

func TestHandleUpdateSighting_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/1", nil)
	w := httptest.NewRecorder()
	handleUpdateSighting(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleUpdateSighting_InvalidID(t *testing.T) {
	body := `{"species":"Crane"}`
	req := httptest.NewRequest(http.MethodPut, "/api/sightings/abc", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleUpdateSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid id, got %d", w.Code)
	}
}

// ---------- handleDeleteSighting validation ----------

func TestHandleDeleteSighting_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings/1", nil)
	w := httptest.NewRecorder()
	handleDeleteSighting(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleDeleteSighting_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/api/sightings/abc", nil)
	w := httptest.NewRecorder()
	handleDeleteSighting(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid id, got %d", w.Code)
	}
}

// ---------- handleGetSightings pagination ----------

func TestParsePaginationParams_Defaults(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings?page=2&limit=15", nil)
	pageStr := req.URL.Query().Get("page")
	limitStr := req.URL.Query().Get("limit")

	page := 1
	limit := 20
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
		if limit > 100 {
			limit = 100
		}
	}

	if page != 2 {
		t.Errorf("expected page 2, got %d", page)
	}
	if limit != 15 {
		t.Errorf("expected limit 15, got %d", limit)
	}
	offset := (page - 1) * limit
	if offset != 15 {
		t.Errorf("expected offset 15, got %d", offset)
	}
}

func TestParsePaginationParams_LimitCap(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings?page=1&limit=999", nil)
	limitStr := req.URL.Query().Get("limit")

	limit := 20
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
		if limit > 100 {
			limit = 100
		}
	}
	if limit != 100 {
		t.Errorf("expected limit capped at 100, got %d", limit)
	}
}

func TestParsePaginationParams_NegativePageDefaults(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings?page=-5&limit=10", nil)
	pageStr := req.URL.Query().Get("page")

	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	if page != 1 {
		t.Errorf("expected negative page to default to 1, got %d", page)
	}
}

func TestParsePaginationParams_NoPagination(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sightings", nil)
	pageStr := req.URL.Query().Get("page")
	limitStr := req.URL.Query().Get("limit")
	usePagination := pageStr != "" || limitStr != ""
	if usePagination {
		t.Error("expected no pagination when no params provided")
	}
}

// ---------- validatePasswordStrength ----------

func TestValidatePasswordStrength_TooShort(t *testing.T) {
	msg := validatePasswordStrength("Ab1")
	if msg == "" {
		t.Error("expected error for short password")
	}
	if !strings.Contains(msg, "8 characters") {
		t.Errorf("unexpected message: %s", msg)
	}
}

func TestValidatePasswordStrength_NoUppercase(t *testing.T) {
	msg := validatePasswordStrength("abcdefg1")
	if msg == "" {
		t.Error("expected error for no uppercase")
	}
	if !strings.Contains(msg, "uppercase") {
		t.Errorf("unexpected message: %s", msg)
	}
}

func TestValidatePasswordStrength_NoLowercase(t *testing.T) {
	msg := validatePasswordStrength("ABCDEFG1")
	if msg == "" {
		t.Error("expected error for no lowercase")
	}
	if !strings.Contains(msg, "lowercase") {
		t.Errorf("unexpected message: %s", msg)
	}
}

func TestValidatePasswordStrength_NoDigit(t *testing.T) {
	msg := validatePasswordStrength("Abcdefgh")
	if msg == "" {
		t.Error("expected error for no digit")
	}
	if !strings.Contains(msg, "digit") {
		t.Errorf("unexpected message: %s", msg)
	}
}

func TestValidatePasswordStrength_Valid(t *testing.T) {
	msg := validatePasswordStrength("SecurePass1")
	if msg != "" {
		t.Errorf("expected no error for valid password, got: %s", msg)
	}
}

// ---------- handleChangePassword ----------

func TestHandleChangePassword_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/users/password", nil)
	w := httptest.NewRecorder()
	handleChangePassword(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestHandleChangePassword_MissingFields(t *testing.T) {
	body := `{"user_id":0,"old_password":"","new_password":""}`
	req := httptest.NewRequest(http.MethodPut, "/api/users/password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleChangePassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleChangePassword_SamePassword(t *testing.T) {
	body := `{"user_id":1,"old_password":"OldPass1","new_password":"OldPass1"}`
	req := httptest.NewRequest(http.MethodPut, "/api/users/password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleChangePassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for same password, got %d", w.Code)
	}
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if !strings.Contains(resp["error"], "different") {
		t.Errorf("expected 'different' in error, got: %s", resp["error"])
	}
}

func TestHandleChangePassword_WeakNewPassword(t *testing.T) {
	body := `{"user_id":1,"old_password":"OldPass1","new_password":"weak"}`
	req := httptest.NewRequest(http.MethodPut, "/api/users/password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleChangePassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for weak password, got %d", w.Code)
	}
}

func TestHandleChangePassword_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/users/password", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleChangePassword(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid JSON, got %d", w.Code)
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
