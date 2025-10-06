import {
  updateTurn,
  updateCaptures,
  addHoverEffect,
  createButton,
  handleGameButtonsAfterGame,
  showStonesInAtari,
  showElement,
  drawGridLines,
  drawStarPoints,
  displayMatchIdElement,
  toggleGroupSelection,
} from "./UI.js";
import {
  fetchWithErrorHandling,
  getBoardSVG,
  addBackground,
  getFillColor,
  getStone,
  cellSize,
  SVG_SIZE,
  createCircleSVG,
  getMatchString,
  getAPIUrl,
  getPlayerColor,
  getPlayerSessionToken,
} from "./utils.js";
import {
  resignButtonHandler,
  countScoreButtonHandler,
  guessStonesButtonsHandler,
  passButtonHandler,
  addingGuessStone,
  removingGuessStone,
  getGroupRequest,
  downloadSGFButtonHandler,
  goToMainBoardButtonHandler,
} from "./handlers.js";
import { boards, elements } from "./elements.js";

let boardGenerationNumber = 0;
let countingPhase = false;
let isWinnerDecided = false;
let boardState = [];
const guessStones = {
  black: [],
  white: [],
};
let stonesInAtari = {
  black: 0,
  white: 0,
};
let deadGroupsDuringCounting = [];

export function getDeadGroups() {
  return deadGroupsDuringCounting.selected;
}

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
    elements.boards.main.appendChild(boards.main);
    elements.boards.black.appendChild(boards.black);
    elements.boards.white.appendChild(boards.white);
  } else if (playerColor === "black") {
    addClickAreas(boards.black, rows, cols, "black");
    elements.boards.black.appendChild(boards.black);
  } else if (playerColor === "white") {
    addClickAreas(boards.white, rows, cols, "white");
    elements.boards.white.appendChild(boards.white);
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
              session_token: getPlayerSessionToken(),
              board_generation_number: boardGenerationNumber,
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
              boardGenerationNumber = data.board_generation_number;
              console.log(
                "Successful move! Board interaction number: ",
                boardGenerationNumber
              );
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
  boardGenerationNumber++;
  fetch(`${API_URL}/sync-guess-stones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      color: color,
      stones: stones,
      match_string: getMatchString(),
      board_generation_number: boardGenerationNumber,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
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

  updateBoard(boardState, stonesInAtari);

  if (colorRemoved === "black") {
    sendGuessStonesToBackend("black", guessStones.black);
  } else if (colorRemoved === "white") {
    sendGuessStonesToBackend("white", guessStones.white);
  }
}

function placeStone(stoneColor, row, col) {
  const stone = getStone(stoneColor, row, col);
  boards.main.appendChild(stone);

  stone.addEventListener("click", () => {
    if (countingPhase) {
      console.log("Row: " + row + " Col: " + col);
      deadGroupsDuringCounting = getGroupRequest(row, col);
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

  function sync() {
    fetchWithErrorHandling(`${API_URL}/get-board-interaction-number`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match_string: getMatchString(),
        player: playerColor,
        frontend_board_generation_number: boardGenerationNumber,
      }),
    }).then((data) => {
      console.log("Winner: ", data.winner);
      console.log("Should sync: ", data.should_sync);

      // if (data.winner) {
      //   console.log("There's a winner! No board syncs from now on :)");
      //   return;
      // }

      if (!data.should_sync && !countingPhase) {
        console.log("Not syncing boards!");

        setTimeout(sync, retryInterval);
        return;
      }

      boardGenerationNumber = data.board_generation_number;

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
          failedAttempts++;
          console.error(
            `Error syncing boards (attempt ${failedAttempts}/${maxRetries}):`,
            error
          );

          if (failedAttempts < maxRetries) {
            setTimeout(sync, retryInterval);
          } else {
            console.error(
              "Max retry attempts reached. Please refresh the page."
            );
          }
        })
        .then((data) => {
          console.log("Server response:", data.message);

          // !BUG: since adding pre sync fetch, this part doesn't get triggered when it should
          if (data.rejoin_required) {
            alert("Game data lost. Please rejoin via login page :)");
            setTimeout(() => {
              window.location.href = `${getAPIUrl()}/frontend/index.html`;
            }, 2000);
            return; // stop syncing
          }

          failedAttempts = 0; // Reset counter on success

          console.log("DATA.WINNER = ", data.winner);

          if (data.winner) {
            isWinnerDecided = true;
            const res = createButton("resign-result", data.winner);
            elements.infoContainer.innerHTML = "";
            elements.infoContainer.appendChild(res);
            handleGameButtonsAfterGame(isWinnerDecided);
            document.removeEventListener;
            return;
          }

          guessStones.black = data.black_guess_stones;
          guessStones.white = data.white_guess_stones;

          updateBoard(data.board, data.stones_in_atari);
          updateCaptures(data.black_captures, data.white_captures);
          updateTurn(data.current_player);

          if (data.counting) {
            console.log("Current player: " + data.current_player);
            updateTurn(data.current_player);

            countingPhase = true;

            handleGameButtonsAfterGame(isWinnerDecided);
            deadGroupsDuringCounting = data.groups_selected_during_counting;
            toggleGroupSelection(deadGroupsDuringCounting);

            if (playerColor === "spectator") {
              showElement(document.getElementById(".main-board-buttons"));
            }
          }

          setTimeout(sync, retryInterval);
        });
    });
  }

  setTimeout(sync, retryInterval);
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

function undoButtonHandler() {
  if (elements.undo) {
    elements.undo.addEventListener("click", () => {
      undoRequest();
    });
  }
}

function undoRequest() {
  fetch(`${API_URL}/undo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: getMatchString(),
      player: playerColor,
      board_generation_number: boardGenerationNumber,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Server response:", data.message);
      if (data.message === "It's not your turn to undo!") {
        console.log("Board generation number: ", data.board_generation_number);
        return;
      }
      console.log("Board generation number: ", data.board_generation_number);
      boardGenerationNumber = data.board_generation_number;
      boardState = data.board;
      updateBoard(boardState, data.stones_in_atari);
      updateCaptures(data.black_captures, data.white_captures);
      updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

undoButtonHandler();
passButtonHandler();
guessStonesButtonsHandler();
countScoreButtonHandler();
downloadSGFButtonHandler();
resignButtonHandler();
goToMainBoardButtonHandler();
