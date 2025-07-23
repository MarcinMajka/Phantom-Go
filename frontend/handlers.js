import { elements, createButton } from "./UI.js";
import { getAPIUrl, getMatchString, getPlayerColor } from "./utils.js";

const API_URL = getAPIUrl();
const playerColor = getPlayerColor();

export function resignButtonHandler() {
  if (elements.resign) {
    elements.resign.addEventListener("click", resignRequest);
  }
}

function resignRequest() {
  fetch(`${API_URL}/resign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: getMatchString(),
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
}
