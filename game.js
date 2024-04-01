// Game Constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const SQUARE_SIZE = 30;
const GAME_SPEED = 500; // milliseconds
const MAX_LIVES = 1;
let difficultyLevel = 1;
let scoreMultiplier = 1;
let lastFrameTime = performance.now();
let frameCount = 0;
let totalFrames = 0;
let lastUpdateTime = performance.now();
let musicBool = false;
let lastLogicUpdateTime = performance.now();
const MAX_FRAMES_FOR_FPS = 60;
const frameTimestamps = [];
let lastUpdateTimestamp = 0;
const TARGET_DELTA_TIME = 1000 / 60; // targeting 60 FPS
let check = false; // used for determining if music playing when paused
const API_BASE_URL = "http://localhost:3500";
let leaderboardInterval;
let currentPage = 1; // Initialize to the first page by default
let totalPages; // Will be updated based on the server's response

// Game Elements
const gameContainer = document.getElementById("game-container"); // Game container
const tetrisBoard = document.getElementById("tetris-board"); // Tetris board
const scoreElement = document.getElementById("score-value"); // Score
const timerElement = document.getElementById("timer-value"); // Timer
const livesElement = document.getElementById("lives-value"); // Number of Lives left
const pauseMenu = document.getElementById("pause-menu"); // Pause menu
const continueButton = document.getElementById("continue-btn"); // Continue button
const restartButton = document.getElementById("restart-btn"); // Restart Button
const pauseButton = document.getElementById("pause-btn"); // Pause button

const titleScreen = document.getElementById("titleScreen");
const startButton = document.getElementById("startButton");

// Event listener to start game with Enter key
document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    startGame();
  }
});
document.addEventListener("DOMContentLoaded", (event) => {
  const titleScreen = document.getElementById("titleScreen");
  const startButton = document.getElementById("startButton");

  startButton.addEventListener("click", startGame);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      startGame();
    }
  });
});

function startMusic() {
  gameMusic.play();
  musicBool = true;
}

function pauseMusic() {
  gameMusic.pause();
  musicBool = false;
}

let gameMusic = document.getElementById("gameMusic");

document.getElementById("playMusic").addEventListener("click", function () {
  gameMusic.play();
  musicBool = true;
});

document.getElementById("pauseMusic").addEventListener("click", function () {
  gameMusic.pause();
  musicBool = false;
});

// You can start the music when the game starts and pause when the game is paused.

pauseButton.addEventListener("click", pauseGame);
continueButton.addEventListener("click", continueGame);

const TETROMINOS = [
  { shape: [[1, 1, 1, 1]], color: 1 }, // I-shape
  {
    shape: [
      [2, 2],
      [2, 2],
    ],
    color: 2,
  }, // O-shape
  {
    shape: [
      [3, 3, 3],
      [0, 3, 0],
    ],
    color: 3,
  }, // T-shape
  {
    shape: [
      [4, 4, 0],
      [0, 4, 4],
    ],
    color: 4,
  }, // S-shape
  {
    shape: [
      [0, 5, 5],
      [5, 5, 0],
    ],
    color: 5,
  }, // Z-shape
  {
    shape: [
      [6, 6, 6],
      [0, 0, 6],
    ],
    color: 6,
  }, // J-shape
  {
    shape: [
      [7, 7, 7],
      [7, 0, 0],
    ],
    color: 7,
  }, // L-shape
];

let score = 0;
let timer = 0;
let isPaused = false;

let currentTetromino = null;

// Tetris Board
const board = [];
for (let row = 0; row < BOARD_HEIGHT; row++) {
  //each iteration fills board array with a 'row'
  //each row is then filled with an array the size of boardwidth
  board[row] = Array(BOARD_WIDTH).fill(0);
}

// Game Loop
let intervalId = null;

let lastRenderTime = 0;

function startGame() {
  titleScreen.style.display = "none"; // Hide title screen
  document.getElementById("game-container").style.display = "flex"; // Show game container
  document.getElementById('leaderboard-container').style.display = 'flex';
  console.log("game started");
  initializeGame();
  lastRenderTime = performance.now();
  requestAnimationFrame(updateGame);
  fetchAndDisplayLeaderboard(currentPage)
  leaderboardInterval = setInterval(fetchAndDisplayLeaderboard, 10000); // updates every 10 seconds 
}

function pauseGame() {
  isPaused = true;
  if (musicBool) {
    pauseMusic(); // pause the music
    check = true; // Remember that the music was playing
  }
  clearInterval(intervalId);
  pauseMenu.classList.remove("hidden");
  continueButton.classList.remove("hidden");
  restartButton.classList.remove("hidden");
}

function continueGame() {
  if (check === true) {
    startMusic(); // Resume the music if it was playing
    check = false; // Reset the check variable
  }

  lastFrameTime = performance.now();
  lastLogicUpdateTime = performance.now();
  console.log("Continue game function called!");
  isPaused = false;
  requestAnimationFrame(updateGame);
  pauseMenu.classList.add("hidden");
  renderBoard();
}

function restartGame() {
  clearInterval(intervalId);
  clearInterval(leaderboardInterval)
  initializeGame();
  intervalId = setInterval(updateGame, GAME_SPEED);
  leaderboardInterval = setInterval(fetchAndDisplayLeaderboard, 10000);
}

function updateGameSpeed() {
  // Increase speed of game
  const newSpeed = Math.max(100, GAME_SPEED - difficultyLevel * 50);
  clearInterval(intervalId);
  intervalId = setInterval(updateGame, newSpeed);
  lastFrameTime = performance.now(); // Reset FPS calculation after changing speed
  lastLogicUpdateTime = performance.now(); // Reset game logic update time after changing speed
}

function updateScoreMultiplier() {
  // increase scoremultiplier by 0.1 for every difficulty level
  scoreMultiplier = 1 + difficultyLevel * 0.1;
}
function updateDifficulty() {
  // Check if the score is greater than or equal to 1000 points
  const newDifficultyLevel = Math.floor(score / 500) + 1;

  if (newDifficultyLevel !== difficultyLevel) {
    difficultyLevel = newDifficultyLevel;
    // Update game speed and score multiplier based on the new difficulty level
    updateGameSpeed();
    updateScoreMultiplier();
  }
}

function updateGame(timestamp) {
  if (timestamp - lastUpdateTimestamp < TARGET_DELTA_TIME) {
    requestAnimationFrame(updateGame);
    return;
  }
  lastUpdateTimestamp = timestamp;
  frameTimestamps.push(timestamp);
  if (frameTimestamps.length > MAX_FRAMES_FOR_FPS) {
    frameTimestamps.shift();
  }

  if (frameTimestamps.length > 1) {
    const deltaTime =
      frameTimestamps[frameTimestamps.length - 1] - frameTimestamps[0];
    const averageDeltaTime = deltaTime / (frameTimestamps.length - 1);
    const fps = 1000 / averageDeltaTime;
    document.getElementById("fps-display").textContent =
      Math.round(fps) + " FPS";
  }
  if (!isPaused) {
    // Calculate the time elapsed since the last logic update
    const timeSinceLastLogicUpdate = timestamp - lastLogicUpdateTime;

    // Only update the game logic if enough time has passed (based on GAME_SPEED)
    if (timeSinceLastLogicUpdate >= GAME_SPEED) {
      // Update game logic
      timer++;
      moveTetrominoDown();
      checkLineClears();

      // Check for game over
      if (isGameOver()) {
        // handleGameOver();
        return;
      }

      lastLogicUpdateTime = timestamp;
    }
  }

  renderBoard();
  scoreElement.textContent = score;
  timerElement.textContent = timer;
  livesElement.textContent = lives;

  requestAnimationFrame(updateGame);
}

function moveTetrominoDown() {
  if (canMoveTetromino(0, 1)) {
    currentTetromino.y++;
  } else {
    console.log("Locking tetromino");
    lockTetromino();

    spawnNewTetromino();

    //Check for game over
    if (isGameOver()) {
      handleGameOver();
      return;
    }

    renderBoard();
  }
}
// sets random colour for line flash
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function playEffects(times) {
  if (times <= 0) return;

  // Visual feedback: Flash animation
  tetrisBoard.style.backgroundColor = getRandomColor(); // set a random background color
  tetrisBoard.classList.add("flash");
  setTimeout(() => {
    tetrisBoard.classList.remove("flash");
    tetrisBoard.style.backgroundColor = ""; // reset background color
  }, 500); // remove the class after the animation duration

  // Auditory feedback: Play sound
  const sound = document.getElementById("clearLineSound");
  sound.play();

  // Delay the next iteration to give time for effects to finish
  setTimeout(() => playEffects(times - 1), 600);
}

function checkLineClears() {
  let clearedLines = 0;

  for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
    if (board[row].every((cell) => cell !== 0)) {
      // Clear the line
      board.splice(row, 1);
      board.unshift(Array(BOARD_WIDTH).fill(0));
      clearedLines++;
    }
  }

  // Call the playEffects function with the number of cleared lines
  playEffects(clearedLines);

  // Update score based on cleared lines
  if (clearedLines > 0) {
    score += calculateScore(clearedLines);
    updateDifficulty(); // Call updateDifficulty every time the score changes
  }
}

function calculateScore(clearedLines) {
  // Calculate score based on the number of cleared lines
  switch (clearedLines) {
    case 1:
      return 100;
    case 2:
      return 300;
    case 3:
      return 500;
    case 4:
      return 800;
    default:
      return 0;
  }
}

function lockTetromino() {
  // Copy the current tetromino onto the game board
  const { shape, x, y } = currentTetromino;

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] !== 0) {
        const boardRow = y + row;
        const boardCol = x + col;
        board[boardRow][boardCol] = shape[row][col];
      }
    }
  }
}

function isGameOver() {
  // Check if any part of the new tetromino overlaps with the existing board
  const { shape, x, y } = currentTetromino;

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col] !== 0) {
        const boardRow = y + row;
        const boardCol = x + col;

        // Check if the cell is occupied by the existing board
        if (board[boardRow][boardCol] !== 0) {
          return true;
        }
      }
    }
  }

  return false;
}

// User Controls
function handleKeyPress(event) {
  if (isPaused) {
    return;
  }

  if (event.key === "ArrowLeft") {
    moveTetrominoLeft();
  } else if (event.key === "ArrowRight") {
    moveTetrominoRight();
  } else if (event.key === "ArrowDown") {
    moveTetrominoDown();
  } else if (event.key === "ArrowUp") {
    rotateTetromino();
  } else if (event.key === " ") {
    // Spacebar to hard drop the tetromino
    hardDropTetromino();
  } else if (event.key === "Escape") {
    pauseGame();
  }
  event.preventDefault();
}

function moveTetrominoLeft() {
  if (canMoveTetromino(-1, 0)) {
    currentTetromino.x--;
  }
}

function moveTetrominoRight() {
  if (canMoveTetromino(1, 0)) {
    currentTetromino.x++;
  }
}

function rotateTetromino() {
  const rotatedShape = rotateShape(currentTetromino.shape);

  if (canMoveTetromino(0, 0, rotatedShape)) {
    currentTetromino.shape = rotatedShape;
  }
}

function hardDropTetromino() {
  while (canMoveTetromino(0, 1)) {
    currentTetromino.y++;
  }

  moveTetrominoDown();
}

function canMoveTetromino(deltaX, deltaY, newShape) {
  const { shape, x, y } = currentTetromino;
  const tetrominoShape = newShape || shape;

  for (let row = 0; row < tetrominoShape.length; row++) {
    for (let col = 0; col < tetrominoShape[row].length; col++) {
      if (tetrominoShape[row][col] !== 0) {
        const boardRow = y + row + deltaY;
        const boardCol = x + col + deltaX;

        // Check if the cell is outside the board boundaries
        if (
          boardCol < 0 ||
          boardCol >= BOARD_WIDTH ||
          boardRow >= BOARD_HEIGHT
        ) {
          return false;
        }

        // Check if the cell is occupied by the existing board
        if (
          boardRow >= 0 &&
          board[boardRow][boardCol] !== 0 &&
          tetrominoShape[row][col] !== 0
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function rotateShape(shape) {
  // Rotate the shape clockwise
  const rows = shape.length;
  const cols = shape[0].length;
  const rotatedShape = Array(cols)
    .fill()
    .map(() => Array(rows).fill(0));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      rotatedShape[col][rows - 1 - row] = shape[row][col];
    }
  }

  return rotatedShape;
}

// Pause Menu Functionality

restartButton.addEventListener("click", restartGame);

async function handleGameOver() {
  clearInterval(intervalId);
  clearInterval(leaderboardInterval)
  isPaused = true;
  pauseMenu.classList.remove("hidden");

  if (lives > 1) {
    continueButton.classList.remove("hidden");
    restartButton.classList.add("hidden");
    console.log(lives, "remaining lives");
    resetBoard();
    lives--;
  } else {
    restartButton.classList.remove("hidden");
    continueButton.classList.add("hidden");
    console.log("Game Over");

    let playerName = prompt("Enter your name for the leaderboard:");

    if (playerName) {
      try {
        // Convert the timer value to a formatted time string
        let formattedTime = formatTime(timer);

        let response = await fetch(
          `${API_BASE_URL}/submit?name=${playerName}&score=${score}&time=${formattedTime}`,
          {
            method: "POST",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to submit score.");
        }

        let data = await response.text();
        console.log(data); // Logs the response to the server
        fetchAndDisplayLeaderboard();

        response = await fetch(`${API_BASE_URL}/leaderboard`);

        if (!response.ok) {
          throw new Error("Failed to fetch leaderboard.");
        }

        let leaderboard = await response.json();

        const leaderboardList = document.getElementById("leaderboard-list");
        leaderboardList.innerHTML = ""; // Clears previous entries

        leaderboard.forEach((entry) => {
          let listItem = document.createElement("li");
          listItem.textContent = `${entry.rank}. ${entry.name}: ${entry.score} - ${entry.time}`;
          leaderboardList.appendChild(listItem);
        });

        document.getElementById("leaderboard-container")
          .classList.remove("hidden");
      } catch (error) {
        console.error(error);
      }
    }
  }

  tetrisBoard.innerHTML = "";
  // Additional game over logic, e.g., resetting the game state or showing a replay button
  // Reset the timer for the next game
  timer = 0;
}

function resetBoard() {
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    board[row].fill(0);
  }
}

function initializeGame() {
  document.documentElement.style.setProperty("--board-width", BOARD_WIDTH);
  document.documentElement.style.setProperty("--board-height", BOARD_HEIGHT);
  tetrisBoard.innerHTML = "";
  // Initialize the game state
  score = 0;
  lives = MAX_LIVES;
  timer = 0;
  isPaused = false;
  pauseMenu.classList.add("hidden");
  continueButton.disabled = false;
  resetBoard(); // Use the global resetBoard function instead
  spawnNewTetromino();
  renderBoard();
  scoreElement.textContent = score;
  livesElement.textContent = lives;
  timerElement.textContent = timer;
  continueButton.classList.add("hidden");
}

function createEmptyBoard() {
  // Create an empty game board
  const board = [];

  for (let row = 0; row < BOARD_HEIGHT; row++) {
    board.push(Array(BOARD_WIDTH).fill(0));
  }

  return board;
}

function spawnNewTetromino() {
  // Spawn a new random tetromino at the top of the board
  const randomTetromino =
    TETROMINOS[Math.floor(Math.random() * TETROMINOS.length)];
  currentTetromino = {
    shape: randomTetromino.shape,
    x: Math.floor((BOARD_WIDTH - randomTetromino.shape[0].length) / 2),
    y: 0,
  };
}

function renderBoard() {
  // Clear the previous state of the board in the HTML.
  tetrisBoard.innerHTML = "";

  // Iterate over each row of the board.
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    // Iterate over each column in the current row.
    for (let col = 0; col < BOARD_WIDTH; col++) {
      // Get the value of the current cell.
      // This value corresponds to the type of block (or Tetromino).
      let cellValue = board[row][col];

      // If there's a currently active Tetromino, we check if
      // the current cell is part of that Tetromino.
      if (currentTetromino) {
        const { x, y, shape } = currentTetromino;

        // Check if the cell is within the bounds of the current Tetromino.
        if (
          row >= y &&
          row < y + shape.length &&
          col >= x &&
          col < x + shape[0].length
        ) {
          // Update the cell value if it's part of the Tetromino.
          cellValue =
            shape[row - y][col - x] !== 0 ? shape[row - y][col - x] : cellValue;
        }
      }

      // Determine the class for the cell based on its value.
      // Cells with a value of 0 are empty, others are filled.
      const cellClass = cellValue === 0 ? "empty" : "filled";
      // Create a class based on the cell's value to apply the appropriate color.
      const colorClass = `color-${cellValue}`;

      // Create a new div element to represent the cell.
      const cellElement = document.createElement("div");
      // Add the default "cell" class, as well as the determined class (either "empty" or "filled").
      cellElement.classList.add("cell", cellClass, colorClass);

      // Append the cell to the Tetris board in the HTML.
      tetrisBoard.appendChild(cellElement);
    }
  }
}

function formatTime(seconds) {
  let minutes = Math.floor(seconds / 60);

  seconds = seconds % 60;

  return (
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0")
  );
}

function populateLeaderboard(scores){
  console.log(scores) // Test
// variable to referto html leaderboard element
const leaderboardBody = document.getElementById('leaderboard-body');
// Ensure leaderboard is empty by clearing contents before adding
leaderboardBody.innerHTML = '';
// Loop through each element of the data in
scores.forEach(entry => {
// Create row element for to represent each leaderboard entry
const row = document.createElement('tr')
// Create a new cell to represent the rank and set its text content to 'rank'
  const rankCell = document.createElement('td');
  rankCell.textContent = entry.rank;
  row.appendChild(rankCell);

// Create new cell element for name and set its text content to 'name'
const nameCell = document.createElement('td');
nameCell.textContent = entry.name;
row.appendChild(nameCell);

// Create new cell for score and set text content to 'score'
const scoreCell = document.createElement('td');
scoreCell.textContent = entry.score;
row.appendChild(scoreCell)

// Create new cell for time and set text content to to 'time
const timeCell = document.createElement('td');
timeCell.textContent = entry.time;
row.appendChild(timeCell)

// Appened all cells to leaderboard body
leaderboardBody.appendChild(row)
  });
}

async function fetchAndDisplayLeaderboard(pageNumber = 1) {
  try {
      // Make the request to your leaderboard endpoint, including the page number
      console.log(`Fetching page ${pageNumber}`); // Debugging: Log the page number being requested
      const response = await fetch(`http://localhost:3500/leaderboard?page=${pageNumber}`);
      if (!response.ok) {
          throw new Error('Failed to fetch leaderboard data.');
      }
      // Parse the JSON response and log it for inspection
      const responseData = await response.json();
      console.log("Response data received from server:", responseData); // Debugging: Log the received response data

      // Destructure the JSON response to extract scores, currentPage, and totalPages
      const { scores, currentPage, totalPages } = responseData;

      if (!scores) {
          console.error("Scores data is undefined or not present in the response."); // Debugging: Check if scores data is undefined or not present
          return; // Exit the function early if scores data is not available
      }

      // Ensure 'scores' is an array as expected
      if (Array.isArray(scores)) {
          // Use the extracted scores to populate the leaderboard
          populateLeaderboard(scores);
      } else {
          console.error("'scores' is not an array:", scores); // Corrected to log 'scores' instead of 'Scores'
      }

      // Update the page number display
      document.getElementById('page-num').textContent = `Page ${currentPage}`; // Corrected to use lowercase 'currentPage'

      // Enable or disable pagination buttons based on the current page and total pages
      document.getElementById('prev-page').disabled = currentPage <= 1; // Corrected to use lowercase 'currentPage'
      document.getElementById('next-page').disabled = currentPage >= totalPages; // Corrected to use lowercase 'currentPage' and 'totalPages'
  } catch (error) {
      console.error("Error fetching leaderboard:", error);
  }
}



// Event Listeners
document.addEventListener("keydown", handleKeyPress);


function prevPage() {
  if (currentPage > 1) {
      currentPage =- 1;
      fetchAndDisplayLeaderboard(currentPage);
  }
}

function nextPage() {
  currentPage += 1;
  fetchAndDisplayLeaderboard(currentPage);
}