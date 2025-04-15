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
