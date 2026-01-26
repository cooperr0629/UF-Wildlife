package main

import (
	"fmt"
	"net/http"
)

func main() {
	// 允许跨域请求（开发阶段用）
	http.HandleFunc("/api/parking", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*") // CORS
		fmt.Fprintln(w, `{"status":"success","data":"Hello UF Parking!"}`)
	})

	fmt.Println("Go backend running on http://localhost:8080/api/parking")
	http.ListenAndServe(":8080", nil)
}
