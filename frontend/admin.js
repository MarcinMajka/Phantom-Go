import { createButton } from "./UI.js";
import { getAPIUrl } from "./utils.js";

console.log("You opened the Admin Panel!");
// Detect if running locally and set API URL accordingly
const API_URL = getAPIUrl();

const resetButton = createButton("admin-button", "Reset backend memory", () => {
  fetch(`${API_URL}/reset-memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (response.ok) {
        alert("Backend memory reset successfully!");
      } else {
        alert("Failed to reset backend memory.");
      }
    })
    .catch((error) => {
      console.error("Error resetting backend memory:", error);
      alert("Error resetting backend memory.");
    });
});

document.getElementById("admin-panel").appendChild(resetButton);
