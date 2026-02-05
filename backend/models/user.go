package models

type User struct {
	ID       int
	Username string
	Password string
	Email    string
}

type RegisterRequest struct {
	Username        string
	Email           string
	Password        string
	ConfirmPassword string
}

type Login struct {
	Email    string
	Username string
	Password string
}

type ForgetPassword struct {
	Email string
}
