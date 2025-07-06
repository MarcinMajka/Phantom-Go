// TODO: investigate the relation of viewPort to cellSize, so that the board size in the UI will be dynamic
export const cellSize = 28; // Size of each cell in pixels
export const padding = 20;

// Creates SVG element for the go board
export function getBoardSVG(height, width) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.style.margin = "auto";
  svg.style.display = "block";

  return svg;
}

export function addBackground(svg, width, height) {
  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );
  background.setAttribute("width", width);
  background.setAttribute("height", height);
  background.setAttribute("fill", "#DEB887");
  svg.appendChild(background);
}

// Helper function to convert board coordinates to SVG coordinates
export function toSvgCoords(x, y) {
  return [x * cellSize + padding, y * cellSize + padding];
}

export function getFillColor(color) {
  let fill;
  if (color === "black") {
    fill = "rgba(0, 0, 0, 0.3)";
  } else if (color === "white") {
    fill = "rgba(255, 255, 255, 0.35)";
  } else {
    fill = "rgba(150, 150, 150, 0.4)";
  }

  return fill;
}

export function calculateBoardGeometry(rows, cols) {
  const boardWidth = (cols - 1) * cellSize;
  const boardHeight = (rows - 1) * cellSize;
  const totalWidth = boardWidth + 2 * padding;
  const totalHeight = boardHeight + 2 * padding;

  return {
    totalWidth,
    totalHeight,
  };
}

export function getStarPoints(rows, cols) {
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

export function getStone(color, row, col) {
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
  stone.dataset.row = row;
  stone.dataset.col = col;
  stone.setAttribute("data-color", color);
  return stone;
}
