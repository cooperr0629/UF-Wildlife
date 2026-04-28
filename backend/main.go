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
	"unicode"

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
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	usePagination := pageStr != "" || limitStr != ""

	page := 1
	limit := 20
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
			if limit > 100 {
				limit = 100
			}
		}
	}
	offset := (page - 1) * limit

	baseWhere := ""
	var countArgs []interface{}
	var queryArgs []interface{}
	argIdx := 1

	if category != "" {
		baseWhere = fmt.Sprintf("WHERE a.category = $%d", argIdx)
		countArgs = append(countArgs, category)
		queryArgs = append(queryArgs, category)
		argIdx++
	}

	baseQuery := `
		SELECT a.id, a.species, COALESCE(a.image_url,''), a.latitude, a.longitude,
		       COALESCE(a.address,''), COALESCE(a.category,''), COALESCE(a.quantity,1),
		       COALESCE(a.behavior,''), COALESCE(a.description,''),
		       COALESCE(a.date,''), COALESCE(a.time,''),
		       COALESCE(a.user_id,0),
		       COALESCE(NULLIF(a.username,''), u.username, ''),
		       a.created_at,
		       COALESCE(lc.cnt, 0) AS like_count
		FROM animals a
		LEFT JOIN users u ON a.user_id = u.id
		LEFT JOIN (SELECT sighting_id, COUNT(*) AS cnt FROM sighting_likes GROUP BY sighting_id) lc
		       ON lc.sighting_id = a.id
		` + baseWhere + ` ORDER BY a.created_at DESC`

	if usePagination {
		baseQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
		queryArgs = append(queryArgs, limit, offset)
	}

	rows, err := database.DB.Query(baseQuery, queryArgs...)
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
			&a.Date, &a.Time, &a.UserID, &a.Username, &a.CreateTime, &a.LikeCount); err != nil {
			continue
		}
		sightings = append(sightings, a)
	}

	if usePagination {
		countQuery := "SELECT COUNT(*) FROM animals a " + baseWhere
		var total int
		if err := database.DB.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
			total = 0
		}
		totalPages := (total + limit - 1) / limit
		writeJSON(w, http.StatusOK, map[string]any{
			"data":        sightings,
			"total":       total,
			"page":        page,
			"limit":       limit,
			"total_pages": totalPages,
		})
		return
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
	if len(req.Species) > 200 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Species name too long (max 200 characters)"})
		return
	}
	if len(req.Description) > 2000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Description too long (max 2000 characters)"})
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Latitude must be between -90 and 90"})
		return
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Longitude must be between -180 and 180"})
		return
	}
	if req.Quantity <= 0 {
		req.Quantity = 1
	}
	if req.Quantity > 9999 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Quantity too large (max 9999)"})
		return
	}

	// Convert UserID string to nullable int for the FK column
	var userIDArg interface{}
	if uid, err := strconv.Atoi(req.UserID); err == nil && uid > 0 {
		userIDArg = uid
	}

	var id int
	err := database.DB.QueryRow(`
		INSERT INTO animals (species, image_url, latitude, longitude, address, category, quantity, behavior, description, date, time, username, user_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		RETURNING id`,
		req.Species, req.ImageURL, req.Latitude, req.Longitude,
		req.Address, req.Category, req.Quantity, req.Behavior,
		req.Description, req.Date, req.Time, req.Username, userIDArg,
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create sighting: " + err.Error()})
		return
	}

	go triggerNotifications(id, req.Species, req.Category, req.Latitude, req.Longitude)

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

// ---------- Likes ----------

// parseSightingIDFromLikePath extracts {id} from /api/sightings/{id}/like(s)
func parseSightingIDFromLikePath(path string) (int, error) {
	trimmed := strings.TrimPrefix(path, "/api/sightings/")
	parts := strings.Split(trimmed, "/")
	if len(parts) < 2 {
		return 0, strconv.ErrSyntax
	}
	return strconv.Atoi(parts[0])
}

func handleToggleLike(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	sightingID, err := parseSightingIDFromLikePath(r.URL.Path)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid sighting ID"})
		return
	}

	var req struct {
		UserID int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}
	if req.UserID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
		return
	}

	// Check existing like
	var exists int
	err = database.DB.QueryRow(
		"SELECT 1 FROM sighting_likes WHERE user_id=$1 AND sighting_id=$2",
		req.UserID, sightingID,
	).Scan(&exists)

	liked := false
	if err == sql.ErrNoRows {
		// Insert
		if _, err := database.DB.Exec(
			"INSERT INTO sighting_likes (user_id, sighting_id) VALUES ($1, $2)",
			req.UserID, sightingID,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to like sighting"})
			return
		}
		liked = true
	} else if err == nil {
		// Delete
		if _, err := database.DB.Exec(
			"DELETE FROM sighting_likes WHERE user_id=$1 AND sighting_id=$2",
			req.UserID, sightingID,
		); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to unlike sighting"})
			return
		}
		liked = false
	} else {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}

	var count int
	if err := database.DB.QueryRow(
		"SELECT COUNT(*) FROM sighting_likes WHERE sighting_id=$1", sightingID,
	).Scan(&count); err != nil {
		count = 0
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"liked": liked,
		"count": count,
	})
}

func handleGetLikes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	sightingID, err := parseSightingIDFromLikePath(r.URL.Path)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid sighting ID"})
		return
	}

	var count int
	if err := database.DB.QueryRow(
		"SELECT COUNT(*) FROM sighting_likes WHERE sighting_id=$1", sightingID,
	).Scan(&count); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query likes"})
		return
	}

	likedByMe := false
	if uidStr := r.URL.Query().Get("user_id"); uidStr != "" {
		if uid, err := strconv.Atoi(uidStr); err == nil && uid > 0 {
			var one int
			err := database.DB.QueryRow(
				"SELECT 1 FROM sighting_likes WHERE user_id=$1 AND sighting_id=$2",
				uid, sightingID,
			).Scan(&one)
			likedByMe = (err == nil)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"count":        count,
		"liked_by_me":  likedByMe,
	})
}

// ---------- Nearby search ----------

func handleGetNearbySightings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "lat and lng query parameters are required"})
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid lat value"})
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid lng value"})
		return
	}

	radius := 1000.0
	if radiusStr := r.URL.Query().Get("radius"); radiusStr != "" {
		if r2, err := strconv.ParseFloat(radiusStr, 64); err == nil && r2 > 0 {
			radius = r2
		}
	}
	if radius > 10000 {
		radius = 10000
	}

	rows, err := database.DB.Query(`
		SELECT a.id, a.species, COALESCE(a.image_url,''), a.latitude, a.longitude,
		       COALESCE(a.address,''), COALESCE(a.category,''), COALESCE(a.quantity,1),
		       COALESCE(a.behavior,''), COALESCE(a.description,''),
		       COALESCE(a.date,''), COALESCE(a.time,''),
		       COALESCE(a.user_id,0),
		       COALESCE(NULLIF(a.username,''), u.username, ''),
		       a.created_at,
		       COALESCE(lc.cnt, 0) AS like_count,
		       (6371000 * acos(
		           GREATEST(-1, LEAST(1,
		               cos(radians($1)) * cos(radians(a.latitude)) *
		               cos(radians(a.longitude) - radians($2)) +
		               sin(radians($1)) * sin(radians(a.latitude))
		           ))
		       )) AS distance_meters
		FROM animals a
		LEFT JOIN users u ON a.user_id = u.id
		LEFT JOIN (SELECT sighting_id, COUNT(*) AS cnt FROM sighting_likes GROUP BY sighting_id) lc
		       ON lc.sighting_id = a.id
		WHERE (6371000 * acos(
		           GREATEST(-1, LEAST(1,
		               cos(radians($1)) * cos(radians(a.latitude)) *
		               cos(radians(a.longitude) - radians($2)) +
		               sin(radians($1)) * sin(radians(a.latitude))
		           ))
		       )) <= $3
		ORDER BY distance_meters ASC`, lat, lng, radius)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query nearby sightings"})
		return
	}
	defer rows.Close()

	sightings := []models.Animals{}
	for rows.Next() {
		var a models.Animals
		if err := rows.Scan(&a.ID, &a.Species, &a.ImageURL, &a.Latitude, &a.Longitude,
			&a.Address, &a.Category, &a.Quantity, &a.Behavior, &a.Description,
			&a.Date, &a.Time, &a.UserID, &a.Username, &a.CreateTime, &a.LikeCount, &a.DistanceMeters); err != nil {
			continue
		}
		sightings = append(sightings, a)
	}

	writeJSON(w, http.StatusOK, sightings)
}

func handleSightings(w http.ResponseWriter, r *http.Request) {
	// Route /api/sightings, /api/sightings/nearby, /api/sightings/{id},
	// /api/sightings/{id}/messages, /api/sightings/{id}/like(s)
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

	// /api/sightings/nearby
	if path == "nearby" {
		handleGetNearbySightings(w, r)
		return
	}

	// Check sub-paths: {id}/messages, {id}/like, {id}/likes
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 2 {
		switch parts[1] {
		case "messages":
			switch r.Method {
			case http.MethodGet:
				handleGetComments(w, r)
			case http.MethodPost:
				handleCreateComment(w, r)
			default:
				writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
			}
			return
		case "like":
			handleToggleLike(w, r)
			return
		case "likes":
			handleGetLikes(w, r)
			return
		}
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

// ──────────────────────────────────────────────
// Friend system handlers
// ──────────────────────────────────────────────

// GET /api/users/search?username=X  — find a user by username
func handleUserSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	username := strings.TrimSpace(r.URL.Query().Get("username"))
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username query param required"})
		return
	}
	var id int
	var uname string
	err := database.DB.QueryRow("SELECT id, username FROM users WHERE username = $1", username).Scan(&id, &uname)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": id, "username": uname})
}

// POST /api/friends/request  body: {requester_id, receiver_username}
func handleFriendRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	var body struct {
		RequesterID      int    `json:"requester_id"`
		ReceiverUsername string `json:"receiver_username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RequesterID == 0 || body.ReceiverUsername == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "requester_id and receiver_username required"})
		return
	}
	var receiverID int
	err := database.DB.QueryRow("SELECT id FROM users WHERE username = $1", body.ReceiverUsername).Scan(&receiverID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	if receiverID == body.RequesterID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot add yourself"})
		return
	}
	// Check if friendship already exists in either direction
	var existing string
	err = database.DB.QueryRow(
		`SELECT status FROM friendships WHERE (requester_id=$1 AND receiver_id=$2) OR (requester_id=$2 AND receiver_id=$1)`,
		body.RequesterID, receiverID,
	).Scan(&existing)
	if err == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "friendship already exists", "status": existing})
		return
	}
	_, err = database.DB.Exec(
		`INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, 'pending')`,
		body.RequesterID, receiverID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "pending"})
}

// GET /api/friends?user_id=N  — list accepted friends
func handleFriendList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	userIDStr := r.URL.Query().Get("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid user_id required"})
		return
	}
	rows, err := database.DB.Query(
		`SELECT f.id,
			CASE WHEN f.requester_id=$1 THEN f.receiver_id ELSE f.requester_id END AS friend_id,
			CASE WHEN f.requester_id=$1 THEN u2.username ELSE u1.username END AS friend_username
		FROM friendships f
		JOIN users u1 ON u1.id = f.requester_id
		JOIN users u2 ON u2.id = f.receiver_id
		WHERE (f.requester_id=$1 OR f.receiver_id=$1) AND f.status='accepted'`,
		userID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	type Friend struct {
		FriendshipID int    `json:"friendship_id"`
		FriendID     int    `json:"friend_id"`
		Username     string `json:"username"`
	}
	friends := []Friend{}
	for rows.Next() {
		var f Friend
		if err := rows.Scan(&f.FriendshipID, &f.FriendID, &f.Username); err == nil {
			friends = append(friends, f)
		}
	}
	writeJSON(w, http.StatusOK, friends)
}

// GET /api/friends/requests?user_id=N  — pending requests received by user
func handleFriendRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	userIDStr := r.URL.Query().Get("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid user_id required"})
		return
	}
	rows, err := database.DB.Query(
		`SELECT f.id, f.requester_id, u.username, f.created_at
		FROM friendships f
		JOIN users u ON u.id = f.requester_id
		WHERE f.receiver_id=$1 AND f.status='pending'
		ORDER BY f.created_at DESC`,
		userID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	type Request struct {
		ID          int       `json:"id"`
		RequesterID int       `json:"requester_id"`
		Username    string    `json:"username"`
		CreatedAt   time.Time `json:"created_at"`
	}
	requests := []Request{}
	for rows.Next() {
		var req Request
		if err := rows.Scan(&req.ID, &req.RequesterID, &req.Username, &req.CreatedAt); err == nil {
			requests = append(requests, req)
		}
	}
	writeJSON(w, http.StatusOK, requests)
}

// POST /api/friends/accept  body: {friendship_id, user_id}
func handleFriendAccept(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	var body struct {
		FriendshipID int `json:"friendship_id"`
		UserID       int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.FriendshipID == 0 || body.UserID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "friendship_id and user_id required"})
		return
	}
	res, err := database.DB.Exec(
		`UPDATE friendships SET status='accepted' WHERE id=$1 AND receiver_id=$2 AND status='pending'`,
		body.FriendshipID, body.UserID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "request not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

// POST /api/friends/decline  body: {friendship_id, user_id}
func handleFriendDecline(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	var body struct {
		FriendshipID int `json:"friendship_id"`
		UserID       int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.FriendshipID == 0 || body.UserID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "friendship_id and user_id required"})
		return
	}
	res, err := database.DB.Exec(
		`DELETE FROM friendships WHERE id=$1 AND (receiver_id=$2 OR requester_id=$2)`,
		body.FriendshipID, body.UserID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "request not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "declined"})
}

// POST /api/friends/remove  body: {friendship_id, user_id}
func handleFriendRemove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}
	var body struct {
		FriendshipID int `json:"friendship_id"`
		UserID       int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == 0 || body.FriendshipID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "friendship_id and user_id required"})
		return
	}
	database.DB.Exec(
		`DELETE FROM friendships WHERE id=$1 AND (requester_id=$2 OR receiver_id=$2)`,
		body.FriendshipID, body.UserID,
	)
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// GET  /api/dm?user1=N&user2=N  — chat history
// POST /api/dm  body: {sender_id, receiver_id, content}
func handleDM(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		u1, err1 := strconv.Atoi(r.URL.Query().Get("user1"))
		u2, err2 := strconv.Atoi(r.URL.Query().Get("user2"))
		if err1 != nil || err2 != nil || u1 == 0 || u2 == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user1 and user2 required"})
			return
		}
		rows, err := database.DB.Query(
			`SELECT dm.id, dm.sender_id, u.username, dm.receiver_id, dm.content, dm.created_at
			FROM direct_messages dm
			JOIN users u ON u.id = dm.sender_id
			WHERE (dm.sender_id=$1 AND dm.receiver_id=$2) OR (dm.sender_id=$2 AND dm.receiver_id=$1)
			ORDER BY dm.created_at ASC`,
			u1, u2,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
			return
		}
		defer rows.Close()
		type DM struct {
			ID         int       `json:"id"`
			SenderID   int       `json:"sender_id"`
			SenderName string    `json:"sender_name"`
			ReceiverID int       `json:"receiver_id"`
			Content    string    `json:"content"`
			CreatedAt  time.Time `json:"created_at"`
		}
		msgs := []DM{}
		for rows.Next() {
			var m DM
			if err := rows.Scan(&m.ID, &m.SenderID, &m.SenderName, &m.ReceiverID, &m.Content, &m.CreatedAt); err == nil {
				msgs = append(msgs, m)
			}
		}
		writeJSON(w, http.StatusOK, msgs)

	case http.MethodPost:
		var body struct {
			SenderID   int    `json:"sender_id"`
			ReceiverID int    `json:"receiver_id"`
			Content    string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SenderID == 0 || body.ReceiverID == 0 || strings.TrimSpace(body.Content) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sender_id, receiver_id, content required"})
			return
		}
		var id int
		err := database.DB.QueryRow(
			`INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING id`,
			body.SenderID, body.ReceiverID, body.Content,
		).Scan(&id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]int{"id": id})

	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
	}
}

// ---------- Area Channels (Group Chat) ----------

func handleGetChannels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	rows, err := database.DB.Query(`
		SELECT c.id, c.name, COALESCE(c.description,''), c.creator_id, u.username, c.created_at,
		       (SELECT COUNT(*) FROM area_messages m WHERE m.channel_id = c.id) AS msg_count
		FROM area_channels c
		JOIN users u ON u.id = c.creator_id
		ORDER BY c.created_at DESC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query channels"})
		return
	}
	defer rows.Close()

	type Channel struct {
		ID           int       `json:"id"`
		Name         string    `json:"name"`
		Description  string    `json:"description"`
		CreatorID    int       `json:"creator_id"`
		CreatorName  string    `json:"creator_name"`
		CreatedAt    time.Time `json:"created_at"`
		MessageCount int       `json:"message_count"`
	}
	channels := []Channel{}
	for rows.Next() {
		var c Channel
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatorID, &c.CreatorName, &c.CreatedAt, &c.MessageCount); err == nil {
			channels = append(channels, c)
		}
	}

	writeJSON(w, http.StatusOK, channels)
}

func handleCreateChannel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		CreatorID   int    `json:"creator_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Channel name is required"})
		return
	}
	if len(req.Name) > 100 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Channel name too long (max 100 characters)"})
		return
	}
	if req.CreatorID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "creator_id is required"})
		return
	}

	var id int
	err := database.DB.QueryRow(
		"INSERT INTO area_channels (name, description, creator_id) VALUES ($1, $2, $3) RETURNING id",
		strings.TrimSpace(req.Name), strings.TrimSpace(req.Description), req.CreatorID,
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create channel"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func handleGetChannelMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/channels/"), "/")
	if len(parts) < 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid path"})
		return
	}
	channelID, err := strconv.Atoi(parts[0])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid channel ID"})
		return
	}

	rows, err := database.DB.Query(`
		SELECT m.id, m.channel_id, m.sender_id, u.username, m.content, m.created_at
		FROM area_messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.channel_id = $1
		ORDER BY m.created_at ASC`, channelID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query messages"})
		return
	}
	defer rows.Close()

	type Msg struct {
		ID        int       `json:"id"`
		ChannelID int       `json:"channel_id"`
		SenderID  int       `json:"sender_id"`
		Sender    string    `json:"sender"`
		Content   string    `json:"content"`
		CreatedAt time.Time `json:"created_at"`
	}
	msgs := []Msg{}
	for rows.Next() {
		var m Msg
		if err := rows.Scan(&m.ID, &m.ChannelID, &m.SenderID, &m.Sender, &m.Content, &m.CreatedAt); err == nil {
			msgs = append(msgs, m)
		}
	}

	writeJSON(w, http.StatusOK, msgs)
}

func handleCreateChannelMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/channels/"), "/")
	if len(parts) < 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid path"})
		return
	}
	channelID, err := strconv.Atoi(parts[0])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid channel ID"})
		return
	}

	var req struct {
		SenderID int    `json:"sender_id"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.SenderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sender_id is required"})
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Content is required"})
		return
	}
	if len(req.Content) > 2000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Message too long (max 2000 characters)"})
		return
	}

	var id int
	err = database.DB.QueryRow(
		"INSERT INTO area_messages (channel_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id",
		channelID, req.SenderID, strings.TrimSpace(req.Content),
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create message"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func handleChannelsRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/channels")
	path = strings.TrimSuffix(path, "/")

	if path == "" {
		switch r.Method {
		case http.MethodGet:
			handleGetChannels(w, r)
		case http.MethodPost:
			handleCreateChannel(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
		return
	}

	// /api/channels/{id}/messages
	if strings.Contains(path, "/messages") {
		switch r.Method {
		case http.MethodGet:
			handleGetChannelMessages(w, r)
		case http.MethodPost:
			handleCreateChannelMessage(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
}

// ---------- Subscriptions & Notifications ----------

func handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req struct {
		UserID int    `json:"user_id"`
		Type   string `json:"type"`
		Value  string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.UserID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
		return
	}

	validType := map[string]bool{"species": true, "category": true, "area": true}
	if !validType[req.Type] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "type must be one of: species, category, area"})
		return
	}

	if strings.TrimSpace(req.Value) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "value is required"})
		return
	}

	var existing int
	err := database.DB.QueryRow(
		"SELECT 1 FROM subscriptions WHERE user_id = $1 AND type = $2 AND value = $3",
		req.UserID, req.Type, req.Value,
	).Scan(&existing)
	if err == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "Already subscribed"})
		return
	}

	var id int
	err = database.DB.QueryRow(
		"INSERT INTO subscriptions (user_id, type, value) VALUES ($1, $2, $3) RETURNING id",
		req.UserID, req.Type, strings.TrimSpace(req.Value),
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create subscription"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func handleGetSubscriptions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid user_id is required"})
		return
	}

	rows, err := database.DB.Query(
		"SELECT id, user_id, type, value, created_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query subscriptions"})
		return
	}
	defer rows.Close()

	type Sub struct {
		ID        int       `json:"id"`
		UserID    int       `json:"user_id"`
		Type      string    `json:"type"`
		Value     string    `json:"value"`
		CreatedAt time.Time `json:"created_at"`
	}
	subs := []Sub{}
	for rows.Next() {
		var s Sub
		if err := rows.Scan(&s.ID, &s.UserID, &s.Type, &s.Value, &s.CreatedAt); err == nil {
			subs = append(subs, s)
		}
	}

	writeJSON(w, http.StatusOK, subs)
}

func handleDeleteSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/subscriptions/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid subscription ID"})
		return
	}

	result, err := database.DB.Exec("DELETE FROM subscriptions WHERE id = $1", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to delete subscription"})
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Subscription not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func handleGetNotifications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid user_id is required"})
		return
	}

	unreadOnly := r.URL.Query().Get("unread") == "true"

	var query string
	var args []interface{}
	if unreadOnly {
		query = `
			SELECT n.id, n.user_id, n.sighting_id, n.subscription_id, n.message, n.is_read, n.created_at
			FROM notifications n
			WHERE n.user_id = $1 AND n.is_read = FALSE
			ORDER BY n.created_at DESC LIMIT 50`
		args = []interface{}{userID}
	} else {
		query = `
			SELECT n.id, n.user_id, n.sighting_id, n.subscription_id, n.message, n.is_read, n.created_at
			FROM notifications n
			WHERE n.user_id = $1
			ORDER BY n.created_at DESC LIMIT 50`
		args = []interface{}{userID}
	}

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query notifications"})
		return
	}
	defer rows.Close()

	type Notif struct {
		ID             int       `json:"id"`
		UserID         int       `json:"user_id"`
		SightingID     int       `json:"sighting_id"`
		SubscriptionID int       `json:"subscription_id"`
		Message        string    `json:"message"`
		IsRead         bool      `json:"is_read"`
		CreatedAt      time.Time `json:"created_at"`
	}
	notifs := []Notif{}
	for rows.Next() {
		var n Notif
		if err := rows.Scan(&n.ID, &n.UserID, &n.SightingID, &n.SubscriptionID, &n.Message, &n.IsRead, &n.CreatedAt); err == nil {
			notifs = append(notifs, n)
		}
	}

	writeJSON(w, http.StatusOK, notifs)
}

func handleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/notifications/")
	idStr = strings.TrimSuffix(idStr, "/read")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid notification ID"})
		return
	}

	result, err := database.DB.Exec("UPDATE notifications SET is_read = TRUE WHERE id = $1", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update notification"})
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Notification not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "read"})
}

func triggerNotifications(sightingID int, species, category string, lat, lng float64) {
	rows, err := database.DB.Query(
		`SELECT id, user_id, type, value FROM subscriptions
		 WHERE (type = 'species' AND value = $1)
		    OR (type = 'category' AND value = $2)`,
		species, category,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var subID, userID int
		var subType, subValue string
		if err := rows.Scan(&subID, &userID, &subType, &subValue); err != nil {
			continue
		}
		msg := fmt.Sprintf("New %s sighting: %s spotted nearby!", category, species)
		database.DB.Exec(
			"INSERT INTO notifications (user_id, sighting_id, subscription_id, message) VALUES ($1, $2, $3, $4)",
			userID, sightingID, subID, msg,
		)
	}
}

func handleSubscriptionsRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/subscriptions")
	path = strings.TrimSuffix(path, "/")

	if path == "" {
		switch r.Method {
		case http.MethodGet:
			handleGetSubscriptions(w, r)
		case http.MethodPost:
			handleCreateSubscription(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
		return
	}

	handleDeleteSubscription(w, r)
}

func handleNotificationsRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/notifications")
	path = strings.TrimSuffix(path, "/")

	if path == "" {
		handleGetNotifications(w, r)
		return
	}

	if strings.HasSuffix(path, "/read") {
		handleMarkNotificationRead(w, r)
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
}

// ---------- Reports ----------

func handleCreateReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req struct {
		SightingID int    `json:"sighting_id"`
		ReporterID int    `json:"reporter_id"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.SightingID <= 0 || req.ReporterID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sighting_id and reporter_id are required"})
		return
	}
	if strings.TrimSpace(req.Reason) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Reason is required"})
		return
	}
	if len(req.Reason) > 1000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Reason too long (max 1000 characters)"})
		return
	}

	var existing int
	err := database.DB.QueryRow(
		"SELECT 1 FROM reports WHERE sighting_id = $1 AND reporter_id = $2 AND status = 'pending'",
		req.SightingID, req.ReporterID,
	).Scan(&existing)
	if err == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "You have already reported this sighting"})
		return
	}

	var id int
	err = database.DB.QueryRow(
		"INSERT INTO reports (sighting_id, reporter_id, reason) VALUES ($1, $2, $3) RETURNING id",
		req.SightingID, req.ReporterID, strings.TrimSpace(req.Reason),
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create report"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func handleGetReports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	status := r.URL.Query().Get("status")
	var query string
	var args []interface{}

	if status != "" {
		query = `
			SELECT r.id, r.sighting_id, r.reporter_id, u.username, r.reason, r.status,
			       COALESCE(r.admin_note,''), r.created_at, r.resolved_at
			FROM reports r
			JOIN users u ON u.id = r.reporter_id
			WHERE r.status = $1
			ORDER BY r.created_at DESC`
		args = append(args, status)
	} else {
		query = `
			SELECT r.id, r.sighting_id, r.reporter_id, u.username, r.reason, r.status,
			       COALESCE(r.admin_note,''), r.created_at, r.resolved_at
			FROM reports r
			JOIN users u ON u.id = r.reporter_id
			ORDER BY r.created_at DESC`
	}

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query reports"})
		return
	}
	defer rows.Close()

	type Report struct {
		ID         int        `json:"id"`
		SightingID int        `json:"sighting_id"`
		ReporterID int        `json:"reporter_id"`
		Reporter   string     `json:"reporter"`
		Reason     string     `json:"reason"`
		Status     string     `json:"status"`
		AdminNote  string     `json:"admin_note"`
		CreatedAt  time.Time  `json:"created_at"`
		ResolvedAt *time.Time `json:"resolved_at"`
	}
	reports := []Report{}
	for rows.Next() {
		var rpt Report
		if err := rows.Scan(&rpt.ID, &rpt.SightingID, &rpt.ReporterID, &rpt.Reporter,
			&rpt.Reason, &rpt.Status, &rpt.AdminNote, &rpt.CreatedAt, &rpt.ResolvedAt); err == nil {
			reports = append(reports, rpt)
		}
	}

	writeJSON(w, http.StatusOK, reports)
}

func handleUpdateReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/reports/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid report ID"})
		return
	}

	var req struct {
		Status    string `json:"status"`
		AdminNote string `json:"admin_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	validStatus := map[string]bool{"resolved": true, "dismissed": true, "pending": true}
	if !validStatus[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status must be one of: pending, resolved, dismissed"})
		return
	}

	var resolvedAt interface{}
	if req.Status == "resolved" || req.Status == "dismissed" {
		resolvedAt = time.Now()
	}

	result, err := database.DB.Exec(
		"UPDATE reports SET status = $1, admin_note = $2, resolved_at = $3 WHERE id = $4",
		req.Status, req.AdminNote, resolvedAt, id,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update report"})
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Report not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": req.Status})
}

func handleReportsRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/reports")
	path = strings.TrimSuffix(path, "/")

	if path == "" {
		switch r.Method {
		case http.MethodGet:
			handleGetReports(w, r)
		case http.MethodPost:
			handleCreateReport(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		}
		return
	}

	handleUpdateReport(w, r)
}

// ---------- Leaderboard ----------

func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	period := r.URL.Query().Get("period")
	sortBy := r.URL.Query().Get("sort")
	if sortBy == "" {
		sortBy = "sightings"
	}

	validSort := map[string]bool{"sightings": true, "species": true, "likes": true}
	if !validSort[sortBy] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "sort must be one of: sightings, species, likes"})
		return
	}

	var dateFilter string
	switch period {
	case "week":
		dateFilter = "AND a.created_at >= NOW() - INTERVAL '7 days'"
	case "month":
		dateFilter = "AND a.created_at >= NOW() - INTERVAL '30 days'"
	default:
		dateFilter = ""
	}

	var query string
	switch sortBy {
	case "sightings":
		query = fmt.Sprintf(`
			SELECT u.id, u.username, COUNT(a.id) AS score
			FROM users u
			LEFT JOIN animals a ON a.user_id = u.id %s
			GROUP BY u.id, u.username
			HAVING COUNT(a.id) > 0
			ORDER BY score DESC
			LIMIT 20`, dateFilter)
	case "species":
		query = fmt.Sprintf(`
			SELECT u.id, u.username, COUNT(DISTINCT a.species) AS score
			FROM users u
			LEFT JOIN animals a ON a.user_id = u.id %s
			GROUP BY u.id, u.username
			HAVING COUNT(DISTINCT a.species) > 0
			ORDER BY score DESC
			LIMIT 20`, dateFilter)
	case "likes":
		query = fmt.Sprintf(`
			SELECT u.id, u.username, COUNT(sl.sighting_id) AS score
			FROM users u
			JOIN animals a ON a.user_id = u.id %s
			JOIN sighting_likes sl ON sl.sighting_id = a.id
			GROUP BY u.id, u.username
			HAVING COUNT(sl.sighting_id) > 0
			ORDER BY score DESC
			LIMIT 20`, dateFilter)
	}

	rows, err := database.DB.Query(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to query leaderboard"})
		return
	}
	defer rows.Close()

	type Entry struct {
		Rank     int    `json:"rank"`
		UserID   int    `json:"user_id"`
		Username string `json:"username"`
		Score    int    `json:"score"`
	}
	entries := []Entry{}
	rank := 1
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.UserID, &e.Username, &e.Score); err == nil {
			e.Rank = rank
			entries = append(entries, e)
			rank++
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"period":  period,
		"sort_by": sortBy,
		"entries": entries,
	})
}

// ---------- Change Password ----------

func validatePasswordStrength(password string) string {
	if len(password) < 8 {
		return "Password must be at least 8 characters"
	}
	var hasUpper, hasLower, hasDigit bool
	for _, ch := range password {
		if unicode.IsUpper(ch) {
			hasUpper = true
		} else if unicode.IsLower(ch) {
			hasLower = true
		} else if unicode.IsDigit(ch) {
			hasDigit = true
		}
	}
	if !hasUpper {
		return "Password must contain at least one uppercase letter"
	}
	if !hasLower {
		return "Password must contain at least one lowercase letter"
	}
	if !hasDigit {
		return "Password must contain at least one digit"
	}
	return ""
}

func handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	var req struct {
		UserID      int    `json:"user_id"`
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.UserID <= 0 || req.OldPassword == "" || req.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id, old_password, and new_password are required"})
		return
	}

	if req.OldPassword == req.NewPassword {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "New password must be different from old password"})
		return
	}

	if msg := validatePasswordStrength(req.NewPassword); msg != "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
		return
	}

	var storedHash string
	err := database.DB.QueryRow("SELECT password FROM users WHERE id = $1", req.UserID).Scan(&storedHash)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "User not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.OldPassword)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Old password is incorrect"})
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
		return
	}

	if _, err := database.DB.Exec("UPDATE users SET password = $1 WHERE id = $2", string(newHash), req.UserID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update password"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "password changed"})
}

// Router for /api/friends and /api/friends/
func handleFriendsRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/friends")
	path = strings.TrimSuffix(path, "/")
	switch path {
	case "", "/list":
		handleFriendList(w, r)
	case "/request":
		handleFriendRequest(w, r)
	case "/requests":
		handleFriendRequests(w, r)
	case "/accept":
		handleFriendAccept(w, r)
	case "/decline":
		handleFriendDecline(w, r)
	case "/remove":
		handleFriendRemove(w, r)
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
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
	http.HandleFunc("/api/friends", corsMiddleware(handleFriendsRouter))
	http.HandleFunc("/api/friends/", corsMiddleware(handleFriendsRouter))
	http.HandleFunc("/api/dm", corsMiddleware(handleDM))
	http.HandleFunc("/api/users/search", corsMiddleware(handleUserSearch))
	http.HandleFunc("/api/users/password", corsMiddleware(handleChangePassword))
	http.HandleFunc("/api/leaderboard", corsMiddleware(handleLeaderboard))
	http.HandleFunc("/api/reports", corsMiddleware(handleReportsRouter))
	http.HandleFunc("/api/reports/", corsMiddleware(handleReportsRouter))
	http.HandleFunc("/api/subscriptions", corsMiddleware(handleSubscriptionsRouter))
	http.HandleFunc("/api/subscriptions/", corsMiddleware(handleSubscriptionsRouter))
	http.HandleFunc("/api/notifications", corsMiddleware(handleNotificationsRouter))
	http.HandleFunc("/api/notifications/", corsMiddleware(handleNotificationsRouter))
	http.HandleFunc("/api/channels", corsMiddleware(handleChannelsRouter))
	http.HandleFunc("/api/channels/", corsMiddleware(handleChannelsRouter))

	http.HandleFunc("/api/parking", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		fmt.Fprintln(w, `{"status":"success","data":"Hello UF Wildlife!"}`)
	})

	fmt.Println("Go backend running on http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}
