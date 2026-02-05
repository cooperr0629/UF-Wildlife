package database

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	var err error
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Error opening database:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Cannot connect to database:", err)
	}

	log.Println("Connected to PostgreSQL database successfully")
	createTables()
}

func createTables() {
	usersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	animalsTable := `
	CREATE TABLE IF NOT EXISTS animals (
		id SERIAL PRIMARY KEY,
		species TEXT NOT NULL,
		image_url TEXT,
		latitude DOUBLE PRECISION NOT NULL,
		longitude DOUBLE PRECISION NOT NULL,
		user_id INTEGER,
		username TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);`

	messagesTable := `
	CREATE TABLE IF NOT EXISTS messages (
		id SERIAL PRIMARY KEY,
		sender_id TEXT NOT NULL,
		sender TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	_, err := DB.Exec(usersTable)
	if err != nil {
		log.Fatal("Error creating users table:", err)
	}

	_, err = DB.Exec(animalsTable)
	if err != nil {
		log.Fatal("Error creating animals table:", err)
	}

	_, err = DB.Exec(messagesTable)
	if err != nil {
		log.Fatal("Error creating messages table:", err)
	}

	log.Println("Database tables created successfully")
}
