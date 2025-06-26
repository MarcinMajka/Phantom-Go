import { createButton } from "./UI.js";

console.log("You opened the Admin Panel!");

const resetButton = createButton("admin-button", "Reset backend memory", () => {
  fetch("http://localhost:8000/reset-memory", {
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

document.body.appendChild(resetButton);
