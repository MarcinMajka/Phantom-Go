import {
  elements,
  updateTurn,
  updateCaptures,
  addHoverEffect,
  createButton,
  handleGameButtonsAfterGame,
  highlightStonesInAtari,
  showStonesInAtari,
} from "./UI.js";
import {
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
} from "./utils.js";

const boards = {
  main: null,
  black: null,
  white: null,
};

let boardState;
let addingBlackStone = false;
let addingWhiteStone = false;
let removingStones = false;
let countingPhase = false;
let isWinnerDecided = false;
let blackStonesAdded = [];
let whiteStonesAdded = [];
const groupsToRemove = {};

// Detect if running locally and set API URL accordingly
const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://phantom-go.kraftartz.space/api";

const urlParams = new URLSearchParams(window.location.search);
const matchString = urlParams.get("match");

const currentPage = window.location.pathname;
const playerColor = currentPage.includes("black.html")
  ? "black"
  : currentPage.includes("white.html")
  ? "white"
  : "spectator";

function createMatchIdElement() {
  const matchIdElement = document.createElement("p");
  matchIdElement.textContent = `Match ID: ${matchString}`;
  matchIdElement.classList.add("match-id");
  return matchIdElement;
}

function createBoard(rows, cols, lineWidth = 1, starPointRadius = 3) {
  boards.main = getBoardSVG();

  // Add wooden background
  addBackground(boards.main, SVG_SIZE, SVG_SIZE);

  // Draw vertical lines
  for (let i = 0; i < cols; i++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const [x, y] = toSvgCoords(i, 0);
    line.setAttribute("x1", x);
    line.setAttribute("y1", padding);
    line.setAttribute("x2", x);
    line.setAttribute("y2", SVG_SIZE - padding);
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", lineWidth);
    boards.main.appendChild(line);
  }

  // Draw horizontal lines
  for (let i = 0; i < rows; i++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const [x, y] = toSvgCoords(0, i);
    line.setAttribute("x1", padding);
    line.setAttribute("y1", y);
    line.setAttribute("x2", SVG_SIZE - padding);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", lineWidth);
    boards.main.appendChild(line);
  }

  // Add star points (hoshi)
  const starPoints = getStarPoints(rows, cols);

  starPoints.forEach((point) => {
    const [x, y] = toSvgCoords(point.x, point.y);
    const starPoint = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    starPoint.setAttribute("cx", x);
    starPoint.setAttribute("cy", y);
    starPoint.setAttribute("r", starPointRadius);
    starPoint.setAttribute("fill", "black");
    boards.main.appendChild(starPoint);
  });

  addClickAreas(boards.main, rows, cols, "main");

  boards.black = boards.main.cloneNode(true);
  addClickAreas(boards.black, rows, cols, "black");

  boards.white = boards.main.cloneNode(true);
  addClickAreas(boards.white, rows, cols, "white");

  // Add the SVG to the page
  if (playerColor === "spectator") {
    document.getElementById("main-board").appendChild(boards.main);
    document.getElementById("black-player-board").appendChild(boards.black);
    document.getElementById("white-player-board").appendChild(boards.white);
  } else if (playerColor === "black") {
    document.getElementById("black-player-board").appendChild(boards.black);
  } else if (playerColor === "white") {
    document.getElementById("white-player-board").appendChild(boards.white);
  }

  // add match ID to the page
  document
    .getElementById("player-title")
    .insertAdjacentElement("afterend", createMatchIdElement());
}

function addClickAreas(board, rows, cols, playerBoard) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [x, y] = toSvgCoords(col, row);
      const clickArea = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      clickArea.setAttribute("cx", x);
      clickArea.setAttribute("cy", y);
      clickArea.setAttribute("r", cellSize * 0.4);
      clickArea.setAttribute("fill", "transparent");
      clickArea.dataset.row = row;
      clickArea.dataset.col = col;

      addHoverEffect(clickArea, getFillColor(playerBoard));

      // Add click handler
      clickArea.addEventListener("click", () => {
        if (!countingPhase && !addingBlackStone && !addingWhiteStone) {
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
              match_string: matchString,
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
              // Log server response
              // This includes:
              // 1. Stone placements
              // 2. Current player
              console.log("Server response:", data.message);
              console.log("Player groups in atari:", data.groups_in_atari);
              console.log("Black stones in atari:", data.stones_in_atari.black);
              console.log("White stones in atari:", data.stones_in_atari.white);

              boardState = data.board;

              // Update UI board based on server's game state
              updateBoard(boardState, data.stones_in_atari);
              updateCaptures(data.black_captures, data.white_captures);
              updateTurn(data.current_player);
            })
            .catch((error) => {
              console.error("Error:", error);
            });
        } else if (addingBlackStone) {
          const row = clickArea.dataset.row;
          const col = clickArea.dataset.col;
          blackStonesAdded.push([row, col]);

          addGuessStone("black", row, col);
        } else if (addingWhiteStone) {
          const row = clickArea.dataset.row;
          const col = clickArea.dataset.col;
          whiteStonesAdded.push([row, col]);

          addGuessStone("white", row, col);
        }
      });

      board.appendChild(clickArea);
    }
  }
}

function sendGuessStonesToBackend(color, stones) {
  fetch(`${API_URL}/sync-guess-stones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      color: color,
      stones: stones,
      match_string: matchString,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => console.error("Error syncing guess stones:", error));
}

function addGuessStone(color, row, col) {
  const stone = getStone(color, row, col);

  stone.addEventListener("click", () => {
    if (!removingStones) return;
    removeStone(row, col);
  });

  if (color === "black") {
    boards.white.appendChild(stone);
  }
  if (color === "white") {
    boards.black.appendChild(stone);
  }

  let stonesToSync = color === "black" ? blackStonesAdded : whiteStonesAdded;
  // Making sure types are consistent
  stonesToSync = stonesToSync.map(([r, c]) => [Number(r), Number(c)]);
  sendGuessStonesToBackend(color, stonesToSync);
}

function removeStone(row, col) {
  let colorRemoved = null;

  for (let i = 0; i < blackStonesAdded.length; i++) {
    if (blackStonesAdded[i][0] === row && blackStonesAdded[i][1] === col) {
      blackStonesAdded.splice(i, 1);
      colorRemoved = "black";
      break;
    }
  }
  for (let i = 0; i < whiteStonesAdded.length; i++) {
    if (whiteStonesAdded[i][0] === row && whiteStonesAdded[i][1] === col) {
      whiteStonesAdded.splice(i, 1);
      colorRemoved = "white";
      break;
    }
  }

  if (colorRemoved === "black") {
    sendGuessStonesToBackend(
      "black",
      blackStonesAdded.map(([r, c]) => [Number(r), Number(c)])
    );
  } else if (colorRemoved === "white") {
    sendGuessStonesToBackend(
      "white",
      whiteStonesAdded.map(([r, c]) => [Number(r), Number(c)])
    );
  }

  updateBoard(boardState);
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

function placeStone(cell, row, col) {
  const stoneColor = cell === "black" ? "black" : "white";
  const stone = getStone(stoneColor, row, col);

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
          match_string: matchString,
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

  boards.main.appendChild(stone);

  if (playerColor !== "spectator") {
    if (playerColor === "black" && stoneColor === "black") {
      boards.black.appendChild(stone.cloneNode(true));
    } else if (playerColor === "white" && stoneColor === "white") {
      boards.white.appendChild(stone.cloneNode(true));
    }
  }

  if (!addingBlackStone) {
    if (cell === "black") {
      boards.black.appendChild(stone.cloneNode(true));
    } else {
      boards.white.appendChild(stone.cloneNode(true));
    }
  }
}

function updateBoard(boardState, atariStones = []) {
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

  for (const stone of blackStonesAdded) {
    addGuessStone("black", ...stone);
  }
  for (const stone of whiteStonesAdded) {
    addGuessStone("white", ...stone);
  }

  showStonesInAtari(atariStones);
}

function fetchWithErrorHandling(url, options) {
  return fetch(url, options)
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      return data;
    })
    .catch((error) => {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    });
}

// Add retry logic for sync boards
function syncBoards() {
  const retryInterval = 5000; // 5 seconds
  let failedAttempts = 0;
  const maxRetries = 3;

  const syncIntervalId = setInterval(() => {
    console.log("Refreshing board...");
    fetchWithErrorHandling(`${API_URL}/sync-boards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match_string: matchString,
        player: playerColor,
      }),
    })
      .then((data) => {
        console.log("Server response:", data.message);
        failedAttempts = 0; // Reset counter on success
        blackStonesAdded = data.black_guess_stones;
        whiteStonesAdded = data.white_guess_stones;
        console.log("winner:", data.winner);
        if (data.winner) {
          isWinnerDecided = true;
          const res = createButton("resign-result", data.winner + " + R");
          elements.infoContainer.innerHTML = "";
          elements.infoContainer.appendChild(res);
          handleGameButtonsAfterGame(matchString, isWinnerDecided);
          document.removeEventListener;
        }

        updateBoard(data.board, data.stones_in_atari);
        updateCaptures(data.black_captures, data.white_captures);
        updateTurn(data.current_player);

        if (data.counting) {
          countingPhase = true;
          handleGameButtonsAfterGame(matchString, isWinnerDecided);
        }

        if (countingPhase || isWinnerDecided) {
          clearInterval(syncIntervalId);
          console.log(data.current_player);
          updateTurn(data.current_player);

          console.log("Counting or game finished, stopping sync.");
          return;
        }
      })
      .catch((error) => {
        failedAttempts++;
        console.error(
          `Error syncing boards (attempt ${failedAttempts}/${maxRetries}):`,
          error
        );
        if (failedAttempts >= maxRetries) {
          console.error("Max retry attempts reached. Please refresh the page.");
        }
      });
  }, retryInterval);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!matchString) {
    console.error("No match string provided");
    return;
  }

  // First fetch board dimensions
  fetchWithErrorHandling(`${API_URL}/dimensions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ match_string: matchString }),
  })
    .then((dimensions) => {
      createBoard(dimensions.rows, dimensions.cols);
    })
    .catch((error) => {
      console.error("Error fetching board dimensions:", error);
    });

  syncBoards();
});

elements.undo.addEventListener("click", () => {
  fetch(`${API_URL}/undo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: matchString,
      player: playerColor,
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
        return;
      }
      boardState = data.board;
      updateBoard(boardState);
      updateCaptures(data.black_captures, data.white_captures);
      updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
});

elements.pass.addEventListener("click", () => {
  fetch(`${API_URL}/pass`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: matchString,
      player: playerColor,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Pass response:", data.message);
      if (data.message === "It's not your turn to pass!") {
        return;
      }
      showStonesInAtari({ black: 0, white: 0 });
      updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error during pass:", error);
    });
});

if (elements.addStone.black) {
  elements.addStone.black.addEventListener("click", () => {
    console.log("Black stone button clicked");
    elements.addStone.black.classList.toggle("clicked");
    if (elements.addStone.black.classList.contains("clicked")) {
      addingBlackStone = true;
    } else {
      addingBlackStone = false;
    }
  });
}

if (elements.addStone.white) {
  elements.addStone.white.addEventListener("click", () => {
    console.log("White stone button clicked");
    elements.addStone.white.classList.toggle("clicked");
    if (elements.addStone.white.classList.contains("clicked")) {
      addingWhiteStone = true;
    } else {
      addingWhiteStone = false;
    }
  });
}

elements.removeStone.addEventListener("click", () => {
  console.log("Remove stone button clicked");
  elements.removeStone.classList.toggle("clicked");
  if (elements.removeStone.classList.contains("clicked")) {
    removingStones = true;
    elements.addStone.black.classList.remove("clicked");
    elements.addStone.white.classList.remove("clicked");
    addingBlackStone = false;
    addingWhiteStone = false;
  } else {
    removingStones = false;
  }
});

elements.countScore.addEventListener("click", () => {
  fetch(`${API_URL}/get-score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: matchString,
      groups_to_remove: Object.values(groupsToRemove),
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Result:", data);
      const res = createButton("result", `Result: ${data}`);
      elements.infoContainer.innerHTML = "";
      elements.infoContainer.appendChild(res);

      // updateBoard(boardState);
      // updateCaptures(data.black_captures, data.white_captures);
      // updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error during count score:", error);
    });
});

if (elements.resign) {
  elements.resign.addEventListener("click", () => {
    fetch(`${API_URL}/resign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match_string: matchString,
        player: playerColor,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Resign response:", data);
        const res = createButton("resign-result", data.winner + " + R");
        elements.infoContainer.innerHTML = "";
        elements.infoContainer.appendChild(res);
      })
      .catch((error) => {
        console.error("Error during resign:", error);
      });
  });
}
