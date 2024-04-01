package main

import (
	"database/sql"
	"log"

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

	// Adjusted to include a 'time' column.
	statement, err := db.Prepare(`
CREATE TABLE IF NOT EXISTS leaderboard (
	id INTEGER PRIMARY KEY,
	name TEXT,
	score INTEGER,
	time TEXT  -- This is the new column
)`)
	if err != nil {
		log.Fatalf("Failed to prepare database table creation statement: %v", err)
	}
	_, err = statement.Exec()
	if err != nil {
		log.Fatalf("Failed to execute database table creation statement: %v", err)
	}
}
