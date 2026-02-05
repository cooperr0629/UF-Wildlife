package models

import "time"

// In map section, you could tag on any where in the map so that they will get the latitude and longitude on where you tagged.
// pictures will show on the map from ImageURL
// You could also check Username and UserID also time when it's created
type Animals struct {
	ID       int
	Species  string
	ImageURL string
	//纬度
	Latitude float64 //get the information when users tag on map
	//经度
	Longitude  float64   //get the information when users tag on map
	UserID     int       //get information from 'user' table
	Username   string    //get information from 'user' table
	CreateTime time.Time // generate automatically
}

type CreateAnimalRequest struct {
	Species     string
	Description string
	ImageURL    string
	Latitude    float64
	Longitude   float64
}

// So basically, if any user doesn't find a specific species that they want to add, they could send a request to administrator to apply for adding this species.
type CreateAnimalSpeciesRequest struct {
	Species     string
	Description string
	Username    string
	UserID      string
}
