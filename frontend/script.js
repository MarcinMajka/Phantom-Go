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
  const { cellSize, padding, totalWidth, totalHeight, toSvgCoords } =
    calculateBoardGeometry(rows, cols);

  // Create SVG element
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", totalWidth);
  svg.setAttribute("height", totalHeight);
  svg.style.margin = "auto";
  svg.style.display = "block";

  // Add wooden background
  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );
  background.setAttribute("width", totalWidth);
  background.setAttribute("height", totalHeight);
  background.setAttribute("fill", "#DEB887");
  svg.appendChild(background);

  // Draw vertical lines
  for (let i = 0; i < cols; i++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const { x } = toSvgCoords(i, 0);
    line.setAttribute("x1", x);
    line.setAttribute("y1", padding);
    line.setAttribute("x2", x);
    line.setAttribute("y2", totalHeight - padding);
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", lineWidth);
    svg.appendChild(line);
  }

  // Draw horizontal lines
  for (let i = 0; i < rows; i++) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const { y } = toSvgCoords(0, i);
    line.setAttribute("x1", padding);
    line.setAttribute("y1", y);
    line.setAttribute("x2", totalWidth - padding);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", lineWidth);
    svg.appendChild(line);
  }

  // Add star points (hoshi)
  const starPoints = getStarPoints(rows, cols);

  starPoints.forEach((point) => {
    const { x, y } = toSvgCoords(point.x, point.y);
    const starPoint = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    starPoint.setAttribute("cx", x);
    starPoint.setAttribute("cy", y);
    starPoint.setAttribute("r", starPointRadius);
    starPoint.setAttribute("fill", "black");
    svg.appendChild(starPoint);
  });

  // Add invisible click areas for placing stones
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = toSvgCoords(col, row);
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
        const row = clickArea.dataset.row;
        const col = clickArea.dataset.col;

        // Send cell click to server via POST request
        fetch("http://localhost:8000/cell-click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // Send clicked cell coordinates as JSON payload
          body: JSON.stringify({ row: parseInt(row), col: parseInt(col) }),
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
            console.log("Server response:", data.message);
            // Update UI board based on server's game state
            // This includes:
            // 1. Stone placements
            // 2. Current player
            updateBoard(data.board, data.current_player);
          })
          .catch((error) => {
            console.error("Error:", error);
          });
      });

      svg.appendChild(clickArea);
    }
  }

  function calculateBoardGeometry(rows, cols, cellSize = 40, padding = 40) {
    const boardWidth = (cols - 1) * cellSize;
    const boardHeight = (rows - 1) * cellSize;
    const totalWidth = boardWidth + 2 * padding;
    const totalHeight = boardHeight + 2 * padding;

    return {
      cellSize,
      padding,
      boardWidth,
      boardHeight,
      totalWidth,
      totalHeight,
      // Helper function to convert board coordinates to SVG coordinates
      toSvgCoords: (x, y) => ({
        x: x * cellSize + padding,
        y: y * cellSize + padding,
      }),
    };
  }

  function updateBoard(boardState, currentPlayer) {
    // Remove existing stones
    const stones = document.querySelectorAll(".stone");
    stones.forEach((stone) => stone.remove());

    // Add new stones based on board state
    boardState.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell !== "empty" && cell !== "invalid") {
          const { x, y } = toSvgCoords(colIndex, rowIndex);
          const stone = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          stone.setAttribute("cx", x);
          stone.setAttribute("cy", y);
          stone.setAttribute("r", cellSize * 0.4); // Stone radius
          stone.setAttribute("fill", cell === "black" ? "black" : "white");
          stone.setAttribute("stroke", "black");
          stone.setAttribute("stroke-width", "1");
          stone.classList.add("stone");
          svg.appendChild(stone);
        }
      });
    });

    // Update current player indicator if needed
    console.log("Current player:", currentPlayer);
  }

  const svgBlackPlayerBoard = svg.cloneNode(true);
  const svgWhitePlayerBoard = svg.cloneNode(true);

  // Add the SVG to the page
  document.getElementById("board-container").appendChild(svg);
  document
    .getElementById("black-player-board")
    .appendChild(svgBlackPlayerBoard);
  document
    .getElementById("white-player-board")
    .appendChild(svgWhitePlayerBoard);
}

// Function to calculate hoshi positions based on board size
function getStarPoints(rows, cols) {
  if (rows !== cols) {
    // If board is not square, we might need different logic
    return [];
  }

  const size = rows; // since board is square, we can use either dimension
  const center = Math.floor(size / 2);

  if (size > 15) {
    // For larger boards (17x17 and up), use all 9 star points
    return [
      { x: 3, y: 3 },
      { x: 3, y: center },
      { x: 3, y: size - 4 },
      { x: center, y: 3 },
      { x: center, y: center },
      { x: center, y: size - 4 },
      { x: size - 4, y: 3 },
      { x: size - 4, y: center },
      { x: size - 4, y: size - 4 },
    ];
  } else if (size <= 15 && size >= 13) {
    // For medium boards (13x13 and 15x15), use 4-4 points and center
    return [
      { x: 3, y: 3 },
      { x: 3, y: size - 4 },
      { x: center, y: center },
      { x: size - 4, y: 3 },
      { x: size - 4, y: size - 4 },
    ];
  } else if (size <= 11 && size > 7) {
    // For small boards (9x9 and 11x11), use 3-3 points and center
    return [
      { x: 2, y: 2 },
      { x: 2, y: size - 3 },
      { x: center, y: center },
      { x: size - 3, y: 2 },
      { x: size - 3, y: size - 3 },
    ];
  } else {
    // For even smaller, just the center
    return [{ x: center, y: center }];
  }
}
