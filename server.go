package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
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
	// Append the new score to thescore slice
	scores = append(scores, ScoreEntry{Name: name, Score: score, Time: time})

	// sort the scores in descending order
	sort.SliceStable(scores, func(i, j int) bool {
		return scores[i].Score > scores[j].Score
	})

	// Asign ranks to the scores
	lastScore := -1
	lastRank := 0
	currentRank := 0

	for i := range scores {
		if scores[i].Score != lastScore {
			lastRank = i + 1
		}
		scores[i].Rank = lastRank // Assigning the Rank
		lastScore = scores[i].Score

		// If the score added matches the current score give it a rank
		if scores[i].Name == name && scores[i].Score == score && scores[i].Time == time {
			currentRank = lastRank
		}

	}

	// Calculate the percentile
	totalScores := len(scores)
	percentile := (1.0 - float64(currentRank-1)/float64(totalScores)) * 100

	// Create a response writter
	responseMessage := fmt.Sprintf("Congrats %s, you are in the  top %.2f%%, on the %dth position.", name, percentile, currentRank)
	// Respond to the client
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

	//Calculate the start and end ndices of the scores slice
	startIndex := (page - 1) * scoresPerPage
	endIndex := startIndex + scoresPerPage
	if endIndex > len(scores) {
		endIndex = len(scores)
	}

	//Get the scores for the requested page
	pageScores := scores[startIndex:endIndex]

	//Convert the scores to JSON
	jsonData, err := json.Marshal(pageScores)
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
