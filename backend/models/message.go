// To implement the chatting section, users could talk to each other on this APP.
package models

import "time"

type Message struct {
	ID         int
	SightingID int
	SenderID   string
	Sender     string
	Content    string
	CreateTime time.Time
}

type ChatMessage struct {
	Content  string
	SenderID int
	Sender   string
}

type CreateCommentRequest struct {
	Content  string `json:"content"`
	SenderID string `json:"sender_id"`
	Sender   string `json:"sender"`
}
