export const SVG_SIZE = 800;
export const padding = 40;
export const cellSize = (SVG_SIZE - 2 * padding) / (13 - 1);

// Creates SVG element for the go board
export function getBoardSVG() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", 800); // Hardcoded size
  svg.setAttribute("height", 800); // Hardcoded size
  svg.style.margin = "auto";
  svg.style.display = "block";
  svg.setAttribute("viewBox", "0 0 800 800"); // Add viewBox for scaling

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
  const stone = createCircleSVG(
    row,
    col,
    cellSize * 0.4,
    color,
    "black",
    "1",
    "stone"
  );
  stone.dataset.row = row;
  stone.dataset.col = col;
  stone.setAttribute("data-color", color);
  return stone;
}

export function createCircleSVG(
  row,
  col,
  radius,
  fillColor,
  strokeColor = "black",
  strokeWidth = "1",
  className
) {
  const [x, y] = toSvgCoords(col, row);
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y);
  circle.setAttribute("r", radius);
  circle.setAttribute("fill", fillColor);
  circle.setAttribute("stroke", strokeColor);
  circle.setAttribute("stroke-width", strokeWidth);
  if (className) {
    circle.classList.add(className);
  }
  circle.dataset.row = row;
  circle.dataset.col = col;
  return circle;
}

export function createLineSVG(isVertical, coord, strokeColor, strokeWidth) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("stroke", strokeColor);
  line.setAttribute("stroke-width", strokeWidth);

  if (isVertical) {
    const [x, _] = toSvgCoords(coord, 0);
    line.setAttribute("x1", x);
    line.setAttribute("x2", x);
    line.setAttribute("y1", padding);
    line.setAttribute("y2", SVG_SIZE - padding);
  } else {
    const [_, y] = toSvgCoords(0, coord);
    line.setAttribute("x1", padding);
    line.setAttribute("x2", SVG_SIZE - padding);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
  }

  return line;
}

export function getMatchString() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("match");
}

// Detect if running locally and set API URL accordingly
export function getAPIUrl() {
  return window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://phantom-go.kraftartz.space/api";
}

export function getPlayerColor() {
  const currentPage = window.location.pathname;
  return currentPage.includes("black.html")
    ? "black"
    : currentPage.includes("white.html")
    ? "white"
    : "spectator";
}
