import { getGamesList } from "./handlers.js";

document.addEventListener("DOMContentLoaded", async () => {
  const games = await getGamesList();

  const gamesPanel = document.getElementById("games-panel");
  const ul = document.createElement("ul");
  gamesPanel.append(ul);

  for (const game of games) {
    const li = document.createElement("li");
    li.textContent = game;
    ul.appendChild(li);
  }
});
