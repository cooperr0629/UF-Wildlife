package main

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"parkinGator-backend/database"
	"strings"
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

func main() {
	loadEnv(".env")
	database.InitDB()

	http.HandleFunc("/api/parking", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*") // CORS
		fmt.Fprintln(w, `{"status":"success","data":"Hello UF Wildlife!"}`)
	})

	fmt.Println("Go backend running on http://localhost:8080/api/UFWildlife")
	http.ListenAndServe(":8080", nil)
}
