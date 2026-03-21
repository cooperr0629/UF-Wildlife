package main

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"parkinGator-backend/database"
	"parkinGator-backend/models"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func loadEnv(filename string) {
	file, err := os.Open(filename)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			os.Setenv(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
		}
	}
}

// corsMiddleware wraps a handler with CORS headers for the Angular frontend.
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:4200")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func generateJWT(userID int, email string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default-secret"
	}

	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func handleSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Username, email, and password are required"})
		return
	}

	if !strings.HasSuffix(req.Email, "@ufl.edu") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Only @ufl.edu email addresses are allowed"})
		return
	}

	if req.Password != req.ConfirmPassword {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Passwords do not match"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
		return
	}

	var userID int
	err = database.DB.QueryRow(
		"INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id",
		req.Username, req.Email, string(hashedPassword),
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "Username or email already exists"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
		return
	}

	token, err := generateJWT(userID, req.Email)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"token": token,
		"user": map[string]any{
			"id":       userID,
			"username": req.Username,
			"email":    req.Email,
		},
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req models.Login
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Email and password are required"})
		return
	}

	if !strings.HasSuffix(req.Email, "@ufl.edu") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Only @ufl.edu email addresses are allowed"})
		return
	}

	var user models.User
	err := database.DB.QueryRow(
		"SELECT id, username, email, password FROM users WHERE email = $1",
		req.Email,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Password)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
		return
	}

	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user": map[string]any{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
		},
	})
}

// ---------- Sightings CRUD ----------

func handleGetSightings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	category := r.URL.Query().Get("category")
	var rows *sql.Rows
	var err error
	if category != "" {
		rows, err = database.DB.Query(`
			SELECT id, species, COALESCE(image_url,''), latitude, longitude,
			       COALESCE(address,''), COALESCE(category,''), COALESCE(quantity,1),
			       COALESCE(behavior,''), COALESCE(description,''),
			       COALESCE(date,''), COALESCE(time,''),
			       COALESCE(user_id,0), COALESCE(username,''), created_at
			FROM animals WHERE category = $1 ORDER BY created_at DESC`, category)
	} else {
		rows, err = database.DB.Query(`
			SELECT id, species, COALESCE(image_url,''), latitude, longitude,
			       COALESCE(address,''), COALESCE(category,''), COALESCE(quantity,1),
			       COALESCE(behavior,''), COALESCE(description,''),
			       COALESCE(date,''), COALESCE(time,''),
			       COALESCE(user_id,0), COALESCE(username,''), created_at
			FROM animals ORDER BY created_at DESC`)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query sightings"})
		return
	}
	defer rows.Close()

	sightings := []models.Animals{}
	for rows.Next() {
		var a models.Animals
		if err := rows.Scan(&a.ID, &a.Species, &a.ImageURL, &a.Latitude, &a.Longitude,
			&a.Address, &a.Category, &a.Quantity, &a.Behavior, &a.Description,
			&a.Date, &a.Time, &a.UserID, &a.Username, &a.CreateTime); err != nil {
			continue
		}
		sightings = append(sightings, a)
	}

	writeJSON(w, http.StatusOK, sightings)
}

func handleCreateSighting(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req models.CreateSightingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Species == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Species is required"})
		return
	}
	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	var id int
	err := database.DB.QueryRow(`
		INSERT INTO animals (species, image_url, latitude, longitude, address, category, quantity, behavior, description, date, time, username)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id`,
		req.Species, req.ImageURL, req.Latitude, req.Longitude,
		req.Address, req.Category, req.Quantity, req.Behavior,
		req.Description, req.Date, req.Time, req.Username,
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create sighting: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func handleUpdateSighting(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/sightings/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid sighting ID"})
		return
	}

	var req models.CreateSightingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	result, err := database.DB.Exec(`
		UPDATE animals SET species=$1, image_url=$2, latitude=$3, longitude=$4,
		       address=$5, category=$6, quantity=$7, behavior=$8,
		       description=$9, date=$10, time=$11
		WHERE id=$12`,
		req.Species, req.ImageURL, req.Latitude, req.Longitude,
		req.Address, req.Category, req.Quantity, req.Behavior,
		req.Description, req.Date, req.Time, id,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update sighting"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Sighting not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func handleDeleteSighting(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/sightings/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid sighting ID"})
		return
	}

	result, err := database.DB.Exec("DELETE FROM animals WHERE id=$1", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete sighting"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Sighting not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ---------- Stats ----------

func handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var totalSightings int
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM animals").Scan(&totalSightings); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query sightings count"})
		return
	}

	var totalUsers int
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&totalUsers); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query users count"})
		return
	}

	catRows, err := database.DB.Query("SELECT COALESCE(category,'Unknown'), COUNT(*) FROM animals GROUP BY category")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query category stats"})
		return
	}
	defer catRows.Close()

	byCategory := map[string]int{}
	for catRows.Next() {
		var cat string
		var count int
		if err := catRows.Scan(&cat, &count); err != nil {
			continue
		}
		byCategory[cat] = count
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total_sightings": totalSightings,
		"total_users":     totalUsers,
		"by_category":     byCategory,
	})
}

// ---------- Comments ----------

func handleGetComments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	sightingIDStr := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/sightings/"), "/")[0]
	sightingID, err := strconv.Atoi(sightingIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid sighting ID"})
		return
	}

	rows, err := database.DB.Query(
		"SELECT id, COALESCE(sighting_id,0), sender_id, sender, content, created_at FROM messages WHERE sighting_id = $1 ORDER BY created_at ASC",
		sightingID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query comments"})
		return
	}
	defer rows.Close()

	comments := []models.Message{}
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.SightingID, &m.SenderID, &m.Sender, &m.Content, &m.CreateTime); err != nil {
			continue
		}
		comments = append(comments, m)
	}

	writeJSON(w, http.StatusOK, comments)
}

func handleCreateComment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	sightingIDStr := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/sightings/"), "/")[0]
	sightingID, err := strconv.Atoi(sightingIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid sighting ID"})
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Content == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Content is required"})
		return
	}

	var id int
	err = database.DB.QueryRow(
		"INSERT INTO messages (sighting_id, sender_id, sender, content) VALUES ($1, $2, $3, $4) RETURNING id",
		sightingID, req.SenderID, req.Sender, req.Content,
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create comment"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func handleDeleteComment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/messages/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid comment ID"})
		return
	}

	result, err := database.DB.Exec("DELETE FROM messages WHERE id=$1", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete comment"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Comment not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func handleSightings(w http.ResponseWriter, r *http.Request) {
	// Route /api/sightings, /api/sightings/{id}, /api/sightings/{id}/messages
	path := strings.TrimPrefix(r.URL.Path, "/api/sightings")
	path = strings.TrimPrefix(path, "/")

	if path == "" {
		// Collection routes
		switch r.Method {
		case http.MethodGet:
			handleGetSightings(w, r)
		case http.MethodPost:
			handleCreateSighting(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
		return
	}

	// Check if path ends with /messages: {id}/messages
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 2 && parts[1] == "messages" {
		switch r.Method {
		case http.MethodGet:
			handleGetComments(w, r)
		case http.MethodPost:
			handleCreateComment(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
		return
	}

	// Individual resource routes: /api/sightings/{id}
	switch r.Method {
	case http.MethodPut:
		handleUpdateSighting(w, r)
	case http.MethodDelete:
		handleDeleteSighting(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
	}
}

func main() {
	loadEnv(".env")
	database.InitDB()

	http.HandleFunc("/api/signup", corsMiddleware(handleSignup))
	http.HandleFunc("/api/login", corsMiddleware(handleLogin))
	http.HandleFunc("/api/sightings", corsMiddleware(handleSightings))
	http.HandleFunc("/api/sightings/", corsMiddleware(handleSightings))
	http.HandleFunc("/api/stats", corsMiddleware(handleStats))
	http.HandleFunc("/api/messages/", corsMiddleware(handleDeleteComment))

	http.HandleFunc("/api/parking", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		fmt.Fprintln(w, `{"status":"success","data":"Hello UF Wildlife!"}`)
	})

	fmt.Println("Go backend running on http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}
