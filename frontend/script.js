import {
  elements,
  updateTurn,
  updateCaptures,
  addHoverEffect,
  createButton,
  handleGameButtonsAfterGame,
  highlightStonesInAtari,
  showStonesInAtari,
  showElement,
  drawGridLines,
  drawStarPoints,
  displayMatchIdElement,
} from "./UI.js";
import {
  fetchWithErrorHandling,
  getBoardSVG,
  addBackground,
  toSvgCoords,
  getFillColor,
  calculateBoardGeometry,
  getStarPoints,
  getStone,
  cellSize,
  padding,
  SVG_SIZE,
  createCircleSVG,
  getMatchString,
  getAPIUrl,
  getPlayerColor,
} from "./utils.js";
import {
  resignButtonHandler,
  countScoreButtonHandler,
  guessStonesButtonsHandler,
  passButtonHandler,
  addingGuessStone,
  removingGuessStone,
  undoButtonHandler,
} from "./handlers.js";

const boards = {
  main: null,
  black: null,
  white: null,
};

let boardInteractionNumber = 0;
let countingPhase = false;
let isWinnerDecided = false;
let shouldSync = true;
export let boardState = [];
const guessStones = {
  black: [],
  white: [],
};
let stonesInAtari = {
  black: 0,
  white: 0,
};
export const groupsToRemove = {};

const API_URL = getAPIUrl();

const playerColor = getPlayerColor();

function createBoard(rows, cols) {
  boards.main = getBoardSVG();

  // Add wooden background
  addBackground(boards.main, SVG_SIZE, SVG_SIZE);

  drawGridLines(boards.main, rows, cols);

  // Add star points (hoshi)
  drawStarPoints(boards.main, rows, cols);

  boards.black = boards.main.cloneNode(true);
  boards.white = boards.main.cloneNode(true);

  // Add the SVG to the page
  if (playerColor === "spectator") {
    document.getElementById("main-board").appendChild(boards.main);
    document.getElementById("black-player-board").appendChild(boards.black);
    document.getElementById("white-player-board").appendChild(boards.white);
  } else if (playerColor === "black") {
    addClickAreas(boards.black, rows, cols, "black");
    document.getElementById("black-player-board").appendChild(boards.black);
  } else if (playerColor === "white") {
    addClickAreas(boards.white, rows, cols, "white");
    document.getElementById("white-player-board").appendChild(boards.white);
  }
}

function addClickAreas(board, rows, cols, playerBoard) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const clickArea = createCircleSVG(
        row,
        col,
        cellSize * 0.4,
        "transparent",
        "transparent"
      );
      clickArea.dataset.row = row;
      clickArea.dataset.col = col;

      addHoverEffect(clickArea, getFillColor(playerBoard));

      // Add click handler
      clickArea.addEventListener("click", () => {
        if (!countingPhase && !addingGuessStone) {
          const row = clickArea.dataset.row;
          const col = clickArea.dataset.col;

          // Send cell click to server via POST request
          fetch(`${API_URL}/cell-click`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            // Send clicked cell coordinates as JSON payload
            body: JSON.stringify({
              frontend_board: playerBoard,
              row: parseInt(row),
              col: parseInt(col),
              match_string: getMatchString(),
            }),
          })
            .then((response) => {
              // Validate server response
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              stonesInAtari = data.stones_in_atari;

              boardState = data.board;

              // Update UI board based on server's game state
              updateBoard(boardState, data.stones_in_atari);
              updateCaptures(data.black_captures, data.white_captures);
              updateTurn(data.current_player);
            })
            .catch((error) => {
              console.error("Error:", error);
            });
        } else if (addingGuessStone) {
          const row = Number(clickArea.dataset.row);
          const col = Number(clickArea.dataset.col);

          if (playerColor === "black") {
            guessStones.white.push([row, col]);
            addGuessStone("white", row, col);
            sendGuessStonesToBackend("white", guessStones.white);
          } else {
            guessStones.black.push([row, col]);
            addGuessStone("black", row, col);
            sendGuessStonesToBackend("black", guessStones.black);
          }
        }
      });

      board.appendChild(clickArea);
    }
  }
}

function sendGuessStonesToBackend(color, stones) {
  shouldSync = false; // Disable syncing while sending guess stones
  boardInteractionNumber++;
  fetch(`${API_URL}/sync-guess-stones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      color: color,
      stones: stones,
      match_string: getMatchString(),
    }),
  })
    .then((response) => {
      shouldSync = true; // Re-enable syncing after sending guess stones

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      shouldSync = true; // Re-enable syncing after sending guess stones

      console.error("Error syncing guess stones:", error);
    });
}

function addGuessStone(color, row, col) {
  const stone = getStone(color, row, col);

  stone.addEventListener("click", () => {
    if (!removingGuessStone) return;
    removeStone(row, col);
  });

  if (color === "black") {
    boards.white.appendChild(stone);
  }
  if (color === "white") {
    boards.black.appendChild(stone);
  }
}

// TODO: investigate why sometimes after removing one stone, all added stones are removed until syncBoards() happens
// It's because guess stones in the UI are rendered after click and there's a race condition, which sometimes results in added/removed stones not showing/disappearing, because board synced with previous guess stones state right after
function removeStone(row, col) {
  let colorRemoved = null;

  for (let i = 0; i < guessStones.black.length; i++) {
    if (guessStones.black[i][0] === row && guessStones.black[i][1] === col) {
      guessStones.black.splice(i, 1);
      colorRemoved = "black";
      break;
    }
  }
  for (let i = 0; i < guessStones.white.length; i++) {
    if (guessStones.white[i][0] === row && guessStones.white[i][1] === col) {
      guessStones.white.splice(i, 1);
      colorRemoved = "white";
      break;
    }
  }

  if (colorRemoved === "black") {
    sendGuessStonesToBackend("black", guessStones.black);
  } else if (colorRemoved === "white") {
    sendGuessStonesToBackend("white", guessStones.white);
  }

  updateBoard(boardState, stonesInAtari);
}

function toggleGroupSelection(group) {
  const groupKey = JSON.stringify(group);

  for (const loc of group) {
    const [row, col] = [loc.row - 1, loc.col - 1];
    console.log(`Changing color of: ${row} - ${col} stone`);

    const stoneToColor = boards.main.querySelector(
      `.stone[data-row="${row}"][data-col="${col}"]`
    );

    const color = stoneToColor.getAttribute("data-color");
    const currentFill = stoneToColor.getAttribute("fill");

    if (currentFill === "transparent") {
      delete groupsToRemove[groupKey];
      stoneToColor.setAttribute("fill", color);
    } else {
      groupsToRemove[groupKey] = group;
      stoneToColor.setAttribute("fill", "transparent");
    }
  }
}

function placeStone(stoneColor, row, col) {
  const stone = getStone(stoneColor, row, col);
  boards.main.appendChild(stone);

  stone.addEventListener("click", () => {
    if (countingPhase) {
      console.log("Row: " + row + " Col: " + col);
      fetch(`${API_URL}/get-group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frontend_board: "main",
          row: parseInt(row),
          col: parseInt(col),
          match_string: getMatchString(),
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Server response:", data);
          toggleGroupSelection(data);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
  });

  if (stoneColor === "black") {
    boards.black.appendChild(stone.cloneNode(true));
  } else {
    boards.white.appendChild(stone.cloneNode(true));
  }
}

export function updateBoard(boardState, atariStones = []) {
  // Remove existing stones
  const stones = document.querySelectorAll(".stone");
  stones.forEach((stone) => stone.remove());

  // Add new stones based on board state
  boardState.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell !== "empty" && cell !== "invalid") {
        placeStone(cell, rowIndex, colIndex);
      }
    });
  });

  for (const stone of guessStones.black) {
    addGuessStone("black", ...stone);
  }
  for (const stone of guessStones.white) {
    addGuessStone("white", ...stone);
  }

  showStonesInAtari(atariStones);
}

// Add retry logic for sync boards
function syncBoards() {
  const retryInterval = 1000; // 1 second
  let failedAttempts = 0;
  const maxRetries = 3;

  const syncIntervalId = setTimeout(sync, retryInterval);

  function sync() {
    fetchWithErrorHandling(`${API_URL}/sync-boards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match_string: getMatchString(),
        player: playerColor,
      }),
    })
      .catch((error) => {
        setTimeout(sync, retryInterval);
        failedAttempts++;
        console.error(
          `Error syncing boards (attempt ${failedAttempts}/${maxRetries}):`,
          error
        );
        if (failedAttempts >= maxRetries) {
          console.error("Max retry attempts reached. Please refresh the page.");
        }
      })
      .then((data) => {
        if (shouldSync) {
          console.log(
            "Board interaction number: " + data.board_interaction_number
          );

          console.log("Server response:", data.message);
          failedAttempts = 0; // Reset counter on success

          console.log("winner:", data.winner);
          if (data.winner) {
            isWinnerDecided = true;
            const res = createButton("resign-result", data.winner + " + R");
            elements.infoContainer.innerHTML = "";
            elements.infoContainer.appendChild(res);
            handleGameButtonsAfterGame(getMatchString(), isWinnerDecided);
            document.removeEventListener;
          }

          if (data.board_interaction_number > boardInteractionNumber) {
            console.log("Refreshing board...");

            guessStones.black = data.black_guess_stones;
            guessStones.white = data.white_guess_stones;

            updateBoard(data.board, data.stones_in_atari);
            boardInteractionNumber = data.board_interaction_number;
          } else {
            console.log(
              "Skipping board update, interaction number " +
                data.board_interaction_number +
                " is not newer than expected " +
                boardInteractionNumber
            );
          }

          updateCaptures(data.black_captures, data.white_captures);
          updateTurn(data.current_player);

          if (data.counting) {
            countingPhase = true;
            handleGameButtonsAfterGame(getMatchString(), isWinnerDecided);
            if (playerColor === "spectator") {
              showElement(document.getElementById(".main-board-buttons"));
            }
          }

          if (countingPhase || isWinnerDecided) {
            clearInterval(syncIntervalId);
            console.log(data.current_player);
            updateTurn(data.current_player);

            console.log("Counting or game finished, stopping sync.");
            return;
          }
        }
        setTimeout(sync, retryInterval); // Schedule next sync
      });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!getMatchString()) {
    console.error("No match string provided");
    return;
  }

  // First fetch board dimensions
  fetchWithErrorHandling(`${API_URL}/dimensions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ match_string: getMatchString() }),
  })
    .then((dimensions) => {
      createBoard(dimensions.rows, dimensions.cols);
    })
    .catch((error) => {
      console.error("Error fetching board dimensions:", error);
    });

  syncBoards();
  displayMatchIdElement();
});

undoButtonHandler();
passButtonHandler();
guessStonesButtonsHandler();
countScoreButtonHandler();
resignButtonHandler();
