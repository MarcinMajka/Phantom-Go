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

function createBoard(rows, cols) {
  // SVG configuration
  const cellSize = 40;
  const padding = cellSize;
  const lineWidth = 1;
  const starPointRadius = 3;

  // Calculate total dimensions
  const boardWidth = cols * cellSize;
  const boardHeight = rows * cellSize;
  const totalWidth = boardWidth + 2 * padding;
  const totalHeight = boardHeight + 2 * padding;

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

  // Helper function to convert board coordinates to SVG coordinates
  function toSvgCoords(x, y) {
    return {
      x: x * cellSize + padding,
      y: y * cellSize + padding,
    };
  }

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

        fetch("http://localhost:8000/cell-click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ row: parseInt(row), col: parseInt(col) }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            console.log("Server response:", data.message);
          })
          .catch((error) => {
            console.error("Error:", error);
          });
      });

      svg.appendChild(clickArea);
    }
  }

  // Function to calculate hoshi positions based on board size
  function getStarPoints(rows, cols) {
    if (rows !== cols) {
      // If board is not square, we might need different logic
      return [];
    }

    const size = rows; // since board is square, we can use either dimension

    if (size < 13) {
      // For small boards (7x7 and smaller), use 3-3 points and center
      const center = Math.floor(size / 2);
      return [
        { x: 2, y: 2 },
        { x: 2, y: size - 3 },
        { x: center, y: center },
        { x: size - 3, y: 2 },
        { x: size - 3, y: size - 3 },
      ];
    } else if (size >= 13) {
      // For larger boards (13x13 and up), use 4-4 points and center
      const center = Math.floor(size / 2);
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
    }
  }

  // Add the SVG to the page
  document.getElementById("board-container").appendChild(svg);
}
