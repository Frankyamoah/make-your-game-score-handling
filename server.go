package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
)

type ScoreEntry struct {
	Name  string `json:"name"`
	Rank  int    `json:"rank"`
	Score int    `json:"score"`
	Time  string `json:"time"`
}

var scores []ScoreEntry

func main() {
	initDatabase() // Initialize the database

	http.HandleFunc("/submit", corsMiddleware(submitHandler))
	http.HandleFunc("/leaderboard", corsMiddleware(leaderboardHandler))
	http.HandleFunc("/remove", corsMiddleware(removeHandler))

	port := "3500"
	if len(os.Args) > 1 {
		port = os.Args[1]
	}

	fmt.Printf("Server starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5500")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	}
}

func submitHandler(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	time := r.URL.Query().Get("time")
	scoreStr := r.URL.Query().Get("score")

	score, err := strconv.Atoi(scoreStr)
	if err != nil {
		http.Error(w, "Invalid score", http.StatusBadRequest)
		return
	}

	// Insert the new score into the database
	_, dbErr := db.Exec("INSERT INTO leaderboard (name, score, time) VALUES (?, ?, ?)", name, score, time)
	if dbErr != nil {
		log.Printf("Failed to insert score into database: %v", dbErr)
		http.Error(w, "Failed to submit score", http.StatusInternalServerError)
		return
	}

	// Respond to the client
	responseMessage := "Score submitted successfully."
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(responseMessage))
}

func leaderboardHandler(w http.ResponseWriter, r *http.Request) {
	// Get page number from query parameters (default to 1 if not provided)
	pageStr := r.URL.Query().Get("page")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	// Define number of scores per page
	scoresPerPage := 5
	offset := (page - 1) * scoresPerPage

	// Query the database for the total number of leaderboard entries
	var totalEntries int
	err = db.QueryRow("SELECT COUNT(*) FROM leaderboard").Scan(&totalEntries)
	if err != nil {
		http.Error(w, "Failed to retrieve score count", http.StatusInternalServerError)
		return
	}

	// Calculate total pages (assuming scoresPerPage is defined and > 0)
	totalPages := (totalEntries + scoresPerPage - 1) / scoresPerPage

	// Query the database for the scores page, already sorted by score in descending order
	rows, err := db.Query("SELECT name, score, time FROM leaderboard ORDER BY score DESC LIMIT ? OFFSET ?", scoresPerPage, offset)
	if err != nil {
		http.Error(w, "Failed to retrieve scores", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var pageScores []ScoreEntry
	rank := 1 + offset // Calculate starting rank based on page offset
	for rows.Next() {
		var entry ScoreEntry
		err := rows.Scan(&entry.Name, &entry.Score, &entry.Time)
		if err != nil {
			http.Error(w, "Failed to read score entry", http.StatusInternalServerError)
			return
		}
		entry.Rank = rank // Assign rank based on order in the database
		pageScores = append(pageScores, entry)
		rank++ // Increment rank for the next entry
	}

	// After fetching the pageScores, create a response struct that includes
	// the scores, current page, and total pages
	response := struct {
		Scores      []ScoreEntry `json:"scores"`
		CurrentPage int          `json:"currentPage"`
		TotalPages  int          `json:"totalPages"`
	}{
		Scores:      pageScores,
		CurrentPage: page,
		TotalPages:  totalPages,
	}

	//Convert the scores to JSON
	jsonData, err := json.Marshal(response)
	if err != nil {
		http.Error(w, "Failed to convert leaderboard to JSON", http.StatusInternalServerError)
	}

	// Return the JSON response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(jsonData)
}

func removeHandler(w http.ResponseWriter, r *http.Request) {
	// Extract the name parameter from the request query parameters
	nameToRemove := r.URL.Query().Get("name")

	// If no name is provided, return an error
	if nameToRemove == "" {
		http.Error(w, "Name parameter is required", http.StatusBadRequest)
		return
	}

	// Filter the scores slice to remove entries with the specified name
	var newScores []ScoreEntry
	for _, entry := range scores {
		if entry.Name != nameToRemove {
			newScores = append(newScores, entry)
		}
	}
	scores = newScores

	// Respond with a success message
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("All entries with name '%s' removed successfully", nameToRemove)))
}
