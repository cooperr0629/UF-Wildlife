package models

import "time"

// Animals represents a wildlife sighting record in the database.
type Animals struct {
	ID          int       `json:"id"`
	Species     string    `json:"species"`
	ImageURL    string    `json:"image_url"`
	Latitude    float64   `json:"latitude"`
	Longitude   float64   `json:"longitude"`
	Address     string    `json:"address"`
	Category    string    `json:"category"`
	Quantity    int       `json:"quantity"`
	Behavior    string    `json:"behavior"`
	Description string    `json:"description"`
	Date        string    `json:"date"`
	Time        string    `json:"time"`
	UserID      int       `json:"user_id"`
	Username    string    `json:"username"`
	CreateTime  time.Time `json:"created_at"`
}

type CreateSightingRequest struct {
	Species     string  `json:"species"`
	ImageURL    string  `json:"image_url"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Address     string  `json:"address"`
	Category    string  `json:"category"`
	Quantity    int     `json:"quantity"`
	Behavior    string  `json:"behavior"`
	Description string  `json:"description"`
	Date        string  `json:"date"`
	Time        string  `json:"time"`
	UserID      string  `json:"userId"`
	Username    string  `json:"username"`
}

type CreateAnimalRequest struct {
	Species     string
	Description string
	ImageURL    string
	Latitude    float64
	Longitude   float64
}

type CreateAnimalSpeciesRequest struct {
	Species     string
	Description string
	Username    string
	UserID      string
}
