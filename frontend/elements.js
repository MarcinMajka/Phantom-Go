export const boards = {
  main: null,
  black: null,
  white: null,
};

export const elements = {
  matchID: document.getElementById("match-id"),
  turn: document.getElementById("player-turn"),
  captures: {
    black: document.getElementById("black-captures"),
    white: document.getElementById("white-captures"),
  },
  // TODO: do we really need both add and remove separately?
  guessStone: document.getElementById("guess-stone-button"),
  countScore: document.getElementById("count-score-button"),
  downloadSGF: document.getElementById("download-sgf"),
  mainBoardLink: document.getElementById("go-to-main-board-button"),
  undo: document.getElementById("undo-button"),
  pass: document.getElementById("pass-button"),
  resign: document.getElementById("resign-button"),
  infoContainer: document.getElementById("info-container"),
  stonesInAtari: document.getElementById("stones-in-atari"),
  boards: {
    main: document.getElementById("main-board"),
    black: document.getElementById("black-player-board"),
    white: document.getElementById("white-player-board"),
  },
};
