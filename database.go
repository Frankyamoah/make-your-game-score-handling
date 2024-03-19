package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	_ "github.com/mattn/go-sqlite3"
)

//Global Database connection Variable

var db *sql.DB

func initDatabase() {
	var err error

	db, err = sql.Open("sqlite3", "./tetris.db")
	if err != nil {
		log.Fatal(err)
	}

	// Create the leaderboard table if it doesn't currenty exist
	statement, _ := db.Prepare(`
CREATE TABLE IF NOT EXISTS leaderboard (
	id INTEGER PRIMARY KEY,
	name TEXT,
	score INTEGER
	)`)
	statement.Exec()
}

// submitScore handles the submission of scores to the leaderboard database
func submitScore(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	score := r.URL.Query().Get("score")

	_, err := db.Exec("INSERT INTO leaderboard (name, score) VALUES (?, ?)", name, score)
	if err != nil {
		http.Error(w, "Failed to submit score", http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "Score Submitted!")
}

func getLeaderboard(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT name, score FROM leaderboard ORDER BY score DESC LIMIT 10")
	if err != nil {
		http.Error(w, "Failed to retrieve scores", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var leaderboard []string
	for rows.Next() {
		var name string
		var score int
		rows.Scan(&name, &score)
		entry := fmt.Sprintf("%s: %d", name, score)
		leaderboard = append(leaderboard, entry)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(leaderboard)
}
