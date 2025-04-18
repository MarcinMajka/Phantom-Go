import { elements, updateTurn, updateCaptures } from "./UI.js";
import {
  getBoardSVG,
  addBackground,
  toSvgCoords,
  calculateBoardGeometry,
  getStarPoints,
  cellSize,
  padding,
} from "./utils.js";

const boards = {
  main: null,
  black: null,
  white: null,
};

let boardState;
let countingPhase = false;
let addingBlackStone = false;
let addingWhiteStone = false;
let removingStones = false;
const blackStonesAdded = [];
const whiteStonesAdded = [];

document.addEventListener("DOMContentLoaded", () => {
  // First fetch board dimensions
  fetch("http://localhost:8000/dimensions")
    .then((response) => response.json())
    .then((dimensions) => {
      createBoard(dimensions.rows, dimensions.cols);
    })
    .catch((error) => {
      console.error("Error fetching board dimensions:", error);
    });
});

function createBoard(rows, cols, lineWidth = 1, starPointRadius = 3) {
  const { totalWidth, totalHeight } = calculateBoardGeometry(rows, cols);

  boards.main = getBoardSVG(totalHeight, totalWidth);

  // Add wooden background
  addBackground(boards.main, totalWidth, totalHeight);

  // Draw vertical lines
  for (let i = 0; i < cols; i++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const [x, y] = toSvgCoords(i, 0);
    line.setAttribute("x1", x);
    line.setAttribute("y1", padding);
    line.setAttribute("x2", x);
    line.setAttribute("y2", totalHeight - padding);
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
    line.setAttribute("x2", totalWidth - padding);
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
  document.getElementById("board-container").appendChild(boards.main);
  document.getElementById("black-player-board").appendChild(boards.black);
  document.getElementById("white-player-board").appendChild(boards.white);
}

function addClickAreas(board, rows, cols, playerBoard) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [x, y] = toSvgCoords(col, row);
      const clickArea = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      clickArea.setAttribute("x", x - cellSize / 2);
      clickArea.setAttribute("y", y - cellSize / 2);
      clickArea.setAttribute("width", cellSize);
      clickArea.setAttribute("height", cellSize);
      clickArea.setAttribute("fill", "transparent");
      clickArea.dataset.row = row;
      clickArea.dataset.col = col;

      // Add hover effect
      clickArea.addEventListener("mouseover", () => {
        clickArea.setAttribute("fill", "rgba(0,0,0,0.1)");
      });
      clickArea.addEventListener("mouseout", () => {
        clickArea.setAttribute("fill", "transparent");
      });

      // Add click handler
      clickArea.addEventListener("click", () => {
        if (!countingPhase && !addingBlackStone && !addingWhiteStone) {
          const row = clickArea.dataset.row;
          const col = clickArea.dataset.col;

          // Send cell click to server via POST request
          fetch("http://localhost:8000/cell-click", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            // Send clicked cell coordinates as JSON payload
            body: JSON.stringify({
              frontend_board: playerBoard,
              row: parseInt(row),
              col: parseInt(col),
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

              boardState = data.board;

              // Update UI board based on server's game state
              updateBoard(boardState);
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

// Undo button handler
document.getElementById("undo-button").addEventListener("click", () => {
  fetch("http://localhost:8000/undo", {
    method: "POST",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Server response:", data.message);
      boardState = data.board;
      updateBoard(boardState);
      updateCaptures(data.black_captures, data.white_captures);
      updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
});

document.getElementById("pass-button").addEventListener("click", () => {
  fetch("http://localhost:8000/pass", {
    method: "POST",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Pass response:", data.message);
      updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error during pass:", error);
    });
});

elements.addStone.black.addEventListener("click", () => {
  console.log("Black stone button clicked");
  elements.addStone.black.classList.toggle("clicked");
  if (elements.addStone.black.classList.contains("clicked")) {
    addingBlackStone = true;
  } else {
    addingBlackStone = false;
  }
});

elements.addStone.white.addEventListener("click", () => {
  console.log("White stone button clicked");
  elements.addStone.white.classList.toggle("clicked");
  if (elements.addStone.white.classList.contains("clicked")) {
    addingWhiteStone = true;
  } else {
    addingWhiteStone = false;
  }
});

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

function getStone(color, row, col) {
  const [x, y] = toSvgCoords(col, row);
  const stone = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  stone.setAttribute("cx", x);
  stone.setAttribute("cy", y);
  stone.setAttribute("r", cellSize * 0.4); // Stone radius
  stone.setAttribute("fill", color);
  stone.setAttribute("stroke", "black");
  stone.setAttribute("stroke-width", "1");
  stone.classList.add("stone");
  return stone;
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
}

function removeStone(row, col) {
  for (let i = 0; i < blackStonesAdded.length; i++) {
    if (blackStonesAdded[i][0] === row && blackStonesAdded[i][1] === col) {
      blackStonesAdded.splice(i, 1);
      break;
    }
  }
  for (let i = 0; i < whiteStonesAdded.length; i++) {
    if (whiteStonesAdded[i][0] === row && whiteStonesAdded[i][1] === col) {
      whiteStonesAdded.splice(i, 1);
      break;
    }
  }
  updateBoard(boardState);
}

function placeStone(cell, row, col) {
  const stoneColor = cell === "black" ? "black" : "white";
  const stone = getStone(stoneColor, row, col);

  stone.addEventListener("click", () => {
    if (countingPhase) {
      console.log("Row: " + row + " Col: " + col);
      fetch("http://localhost:8000/group-remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frontend_board: "main",
          row: parseInt(row),
          col: parseInt(col),
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // data.group is an array of Locs to remove
          console.log("Server response:", data);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
  });

  boards.main.appendChild(stone);

  if (!addingBlackStone) {
    if (cell === "black") {
      boards.black.appendChild(stone.cloneNode(true));
    } else {
      boards.white.appendChild(stone.cloneNode(true));
    }
  }
}

function updateBoard(boardState) {
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
}
