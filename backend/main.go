package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/api/parking", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*") // CORS
		fmt.Fprintln(w, `{"status":"success","data":"Hello UF Wildlife!"}`)
	})

	fmt.Println("Go backend running on http://localhost:8080/api/UFWildlife")
	http.ListenAndServe(":8080", nil)
}
