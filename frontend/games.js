import { getGamesList } from "./handlers.js";
import { getAPIUrl } from "./utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  const games = await getGamesList();

  const gamesPanel = document.getElementById("games-panel");
  const ul = document.createElement("ul");
  gamesPanel.append(ul);

  for (const game of games) {
    const li = document.createElement("li");
    li.textContent = game;
    li.onclick = () => {
      window.location.href = `/frontend/main.html?match=${game}`;
    };
    ul.appendChild(li);
  }
});
