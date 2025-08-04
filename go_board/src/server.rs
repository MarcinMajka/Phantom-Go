use poem::listener::BoxIo;
use poem::{
    middleware::Cors,
    handler,
    listener::TcpListener,
    web::Json,
    EndpointExt, Route, Server, Result, Error,
    http::StatusCode, Response
};
use serde::{Serialize, Deserialize};
use crate::board::{Board, Move, Loc, Player, Color, StonesInAtari};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use lazy_static::lazy_static;
use rand::random;
use std::env;


#[derive(Serialize, Deserialize)]
struct JoinGameRequest {
    match_string: String,
    session_token: Option<String>,
    is_spectator: bool
}

#[derive(Serialize)]
struct JoinGameResponse {
    color: String,
    redirect_url: String,
    session_token: String
}

#[derive(Serialize)]
struct BoardDimensions {
    rows: usize,
    cols: usize,
}

#[derive(Deserialize, Debug)]
pub struct CellClick {
    pub frontend_board: String,
    pub row: usize,
    pub col: usize,
    match_string: String,
    session_token: String,
    board_interaction_number: usize,
}

#[derive(Serialize)]
struct PlayerGroupsInAtari {
    groups: HashSet<Vec<Loc>>,
}

impl PlayerGroupsInAtari {
    fn new() -> Self {
        Self {
            groups: HashSet::new(),
        }
    }
}

#[derive(Serialize)]
struct GameState {
    message: String,
    board: Vec<Vec<String>>,
    black_player_board: Vec<Vec<String>>,
    white_player_board: Vec<Vec<String>>,
    current_player: String,
    black_captures: isize,
    white_captures: isize,
    black_guess_stones: Vec<Vec<usize>>,
    white_guess_stones: Vec<Vec<usize>>,
    groups_in_atari: PlayerGroupsInAtari,
    stones_in_atari: StonesInAtari,
    counting: bool,
    winner: Option<String>,
    board_interaction_number: usize,
}

impl GameState {
    fn new(message: String, board_state: Vec<Vec<String>>, board: &Board, board_interaction_number: usize) -> Self {
        let mut game_state = Self {
            message,
            board: board_state.clone(),
            black_player_board: board_state.clone(),
            white_player_board: board_state,
            current_player: board.get_current_player().to_string(),
            black_captures: board.get_black_captures(),
            white_captures: board.get_white_captures(),
            black_guess_stones: vec![],
            white_guess_stones: vec![],
            groups_in_atari: PlayerGroupsInAtari::new(),
            stones_in_atari: StonesInAtari::new(),
            counting: board.last_two_moves_are_pass(),
            winner: None,
            board_interaction_number
        };

        if game_state.counting {
            game_state.current_player = "counting".to_string();
        }

        game_state
    }

    fn with_guess_stones(mut self, black_stones: Vec<Vec<usize>>, white_stones: Vec<Vec<usize>>) -> Self {
        self.black_guess_stones = black_stones;
        self.white_guess_stones = white_stones;
        self
    }

    fn with_stones_in_atari(mut self, stones: StonesInAtari) -> Self {
        self.stones_in_atari = stones;
        self
    }

    fn with_winner(mut self, winner: String) -> Self {
        self.winner = Some(winner);
        self
    }
}

#[derive(Deserialize, Debug)]
struct GuessStonesSync {
    color: String,
    stones: Vec<Vec<usize>>,
    match_string: String,
    board_interaction_number: usize,
}

#[derive(Clone)]
struct PlayerSession {
    // Keep color for move validation
    color: Player,
    session_token: String,
    board_interaction_number: usize,
}

#[derive(Clone)]
struct PlayersState {
    black: Option<PlayerSession>,
    white: Option<PlayerSession>,
}

impl PlayersState {
    fn new() -> Self {
        Self { black: None, white: None }
    }
}

#[derive(Clone)]
struct GameRoom {
    board: Board,
    players: PlayersState,
}

impl GameRoom {
    fn new() -> Self {
        GameRoom {
            board: Board::new(15, 15, 1.5),
            players: PlayersState::new(),
        }
    }
}

lazy_static! {
    static ref GAME_ROOMS: Mutex<HashMap<String, GameRoom>> = Mutex::new(HashMap::new());
    static ref GUESS_STONES: Mutex<HashMap<String, (Vec<Vec<usize>>, Vec<Vec<usize>>)>> =
        Mutex::new(HashMap::new());
}

fn color_to_string(color: Color) -> String {
    match color {
        Color::Empty => "empty".to_string(),
        Color::Black => "black".to_string(),
        Color::White => "white".to_string(),
        Color::Invalid => "invalid".to_string(),
    }
}

fn get_playable_dimensions(board: &Board) -> (usize, usize) {
    let total_rows = board.fields.len();
    let total_cols = board.fields[0].len();
    // Subtract 2 from each dimension to account for sentinels
    (total_rows - 2, total_cols - 2)
}

#[derive(Deserialize)]
struct MatchStringPayload {
    match_string: String,
}

fn lock_rooms() -> Result<std::sync::MutexGuard<'static, HashMap<String, GameRoom>>, Error> {
    GAME_ROOMS
        .lock()
        .map_err(|_| json_error("Failed to lock rooms", StatusCode::INTERNAL_SERVER_ERROR))
}

// Room will be mutable, so we can modify it if it exists
fn get_room<'a>(rooms: &'a mut std::sync::MutexGuard<'static, HashMap<String, GameRoom>>, match_string: &str) -> Result<&'a mut GameRoom, Error> {
    rooms
        .get_mut(match_string)
        .ok_or_else(|| json_error("Game room not found", StatusCode::NOT_FOUND))
}

fn lock_guess_stones() -> Result<std::sync::MutexGuard<'static, HashMap<String, (Vec<Vec<usize>>, Vec<Vec<usize>>)>>, Error> {
    GUESS_STONES
        .lock()
        .map_err(|_| json_error("Failed to lock guess stones", StatusCode::INTERNAL_SERVER_ERROR))
}

#[derive(Serialize)]
struct RootResponse {
    status: String,
}

#[handler]
async fn root_endpoint() -> Result<Json<RootResponse>, Error> {
    Ok(Json(RootResponse {
        status: "ok".to_string(),
    }))
}


#[handler]
async fn get_dimensions(payload: Json<MatchStringPayload>) -> Result<Json<BoardDimensions>, Error> {
    let mut rooms = lock_rooms()?;

    // Create room if it doesn't exist
    let room = rooms
        .entry(payload.match_string.clone())
        .or_insert_with(GameRoom::new);

    let (rows, cols) = get_playable_dimensions(&room.board);
    Ok(Json(BoardDimensions { rows, cols }))
}

// Convert board state to string format for frontend, excluding sentinel borders
fn get_board_state(board: &Board) -> Vec<Vec<String>> {
    let (rows, cols) = get_playable_dimensions(board);
    board.fields[1..=rows].iter()
        .map(|row| {
            row[1..=cols].iter()
                .map(|&color| color_to_string(color))
                .collect()
        })
        .collect()
}

// Core communication pattern:
// 1. Receive click coordinates
// 2. Validate move
// 3. Update game state
// 4. Return updated game state to frontend
#[handler]
async fn cell_click(payload: Json<CellClick>) -> Result<Json<GameState>, Error> {
    let mut rooms = lock_rooms()?;
    let mut room = get_room(&mut rooms, &payload.match_string)?;
    let board = &mut room.board;

    let current_player = board.get_current_player();
    // Check if the move was made on correct player's board
    let frontend_board = payload.frontend_board.clone();
    let board_state: Vec<Vec<String>> = get_board_state(&board);

    let correct_board = match current_player {
        Player::Black => "black",
        Player::White => "white",
    };

    println!("BEFORE MOVE VALIDATION:
    Player: {}, board_interaction_number: {}", frontend_board, payload.board_interaction_number);

    if correct_board != frontend_board && frontend_board != "main" {
        println!("NOT YOUR TURN!!!");
        return Ok(Json(GameState::new(
            format!("It's not your turn!"),
            board_state,
            board,
            payload.board_interaction_number
        )
        .with_stones_in_atari(board.stones_in_atari.clone())));
    }

    // Create move from payload
    let move_attempt = Move {
        player: current_player,
        loc: Loc {
            // Add 1 to skip sentinel border
            row: payload.row + 1,
            col: payload.col + 1,
        },
    };

    // Try to play the move - play() handles validation internally
    board.play(&move_attempt);

    if board_state == get_board_state(&board) {
        println!("ILLEGAL MOVE");
        return Ok(Json(GameState::new(
            format!("Move attempted at ({}, {})", payload.row, payload.col),
            board_state,
            board,
            payload.board_interaction_number
            )
            .with_stones_in_atari(board.stones_in_atari.clone())))
    }

    let board_state: Vec<Vec<String>> = get_board_state(&board);

    let board_int_num = payload.board_interaction_number + 1;
    println!("AFTER MOVE VALIDATION - LEGAL MOVE!!! Board interaction number: {}", board_int_num);

    match frontend_board.as_str() {
        "black" => {
            room.players.black.as_mut().unwrap().board_interaction_number = board_int_num;
        },
        _ => {
            room.players.white.as_mut().unwrap().board_interaction_number = board_int_num;
        }
    }

    Ok(Json(GameState::new(
        format!("Move attempted at ({}, {})", payload.row, payload.col),
        board_state,
        board,
        board_int_num
    )
    .with_stones_in_atari(board.stones_in_atari.clone())))
}

fn is_request_from_player(session_token: &str, room: &GameRoom) -> bool {
    let session_tokens = [
        room.players.black.as_ref().unwrap().session_token.as_str(),
        room.players.white.as_ref().unwrap().session_token.as_str(),
    ];
    
    session_token == "" || !session_tokens.contains(&session_token)
}

// Returns clicked group of stones during counting
#[handler]
async fn get_group(payload: Json<CellClick>) -> Result<Json<Vec<Loc>>, Error> {
    let mut rooms = lock_rooms()?;
    let mut room = get_room(&mut rooms, &payload.match_string)?;

    if is_request_from_player(&payload.session_token, room) {
        return Err(json_error("Not a player!", StatusCode::UNAUTHORIZED))
    }

    let board = &mut room.board;
    let group = board.group_stones(Loc { row: payload.row + 1, col: payload.col + 1 });
    Ok(Json(group))
}

#[derive(Deserialize)]
struct GetScorePayload {
    match_string: String,
    session_token: String,
    groups_to_remove: Vec<Vec<Loc>>,
}

#[handler]
async fn get_score(payload: Json<GetScorePayload>) -> Result<Json<String>, Error> {
    let mut rooms = lock_rooms()?;
    let room = get_room(&mut rooms, &payload.match_string)?;
    
    if is_request_from_player(&payload.session_token, room) {
        return Ok(Json(room.board.count_score().to_string()))
    }

    remove_dead_groups(&mut room.board, payload.groups_to_remove.clone());

    let score = room.board.count_score().to_string();

    Ok(Json(score))
}

#[derive(Deserialize)]
struct ResignPayload {
    match_string: String,
    player: String,
}

#[handler]
async fn handle_resignation(payload: Json<ResignPayload>) -> Result<Json<GameState>, Error> {
    let mut rooms = lock_rooms()?;
    let room = get_room(&mut rooms, &payload.match_string)?;

    let loser = match payload.player.as_str() {
        "black" => Player::Black,
        _ => Player::White,
    };

    room.board.set_winner(loser.opponent());

    let board_int_num = match payload.player.as_str() {
        "black" => room.players.black.as_ref().unwrap().board_interaction_number,
        _ => room.players.white.as_ref().unwrap().board_interaction_number
    };

    println!("Player: {}, board_interaction_number: {}", payload.player, board_int_num);

    Ok(Json(GameState::new(
        format!("Player {:?} resigned. Game over!", loser),
        get_board_state(&room.board),
        &room.board,
        board_int_num
    ).with_winner(loser.opponent().to_string())))
}

fn remove_dead_groups(board: &mut Board, groups: Vec<Vec<Loc>>) {
    for group in groups.iter() {
        let loc = group[0];
        board.remove_group(loc);
    }
}

#[derive(Deserialize)]
struct PassAndUndoPayload {
    match_string: String,
    player: String
}

#[handler]
async fn pass(payload: Json<PassAndUndoPayload>) -> Result<Json<GameState>, Error> {
    let mut rooms = lock_rooms()?;
    let room = get_room(&mut rooms, &payload.match_string)?;
    // Getting player here, because of ownership - coudn't borrow it immutably during board.play() (mutable borrow);
    let player = room.board.get_current_player();
    let frontend_player = &payload.player;

    let board_int_num = match frontend_player.as_str() {
        "black" => room.players.black.as_ref().unwrap().board_interaction_number,
        _ => room.players.white.as_ref().unwrap().board_interaction_number
    };

    println!("Player: {}, board_interaction_number: {}", frontend_player, board_int_num);

    if player.to_string() != frontend_player.to_string() && frontend_player != "spectator" {
        return Ok(Json(GameState::new(
            "It's not your turn to pass!".to_string(),
            vec![],
            &room.board,
            board_int_num
        )
        .with_stones_in_atari(StonesInAtari { black: 0, white: 0 })));
    }

    room.board.play(&Move {
        player,
        loc: Loc::pass(),
    });

    let game_is_over = room.board.last_two_moves_are_pass();

    if !game_is_over {
        Ok(Json(GameState::new(
            format!("Player {:?} passed", room.board.get_current_player().opponent()),
            vec![],
            &room.board,
            board_int_num
        )))
    } else {
        let mut game_state = GameState::new(
            format!("Both players passed. Game over!"),
            vec![],
            &room.board,
            board_int_num
        );
        game_state.current_player = "counting".to_string();
        game_state.counting = true;
        Ok(Json(game_state))
    }


}

#[handler]
async fn undo(payload: Json<PassAndUndoPayload>) -> Result<Json<GameState>, Error> {
    let mut rooms = lock_rooms()?;
    let room = get_room(&mut rooms, &payload.match_string)?;
    let player = room.board.get_current_player();
    let frontend_player = &payload.player;

    let board_int_num = match frontend_player.as_str() {
        "black" => room.players.black.as_ref().unwrap().board_interaction_number,
        _ => room.players.white.as_ref().unwrap().board_interaction_number
    };

    println!("UNDO BEFORE VALIDATION!! Player: {}, board_interaction_number: {}", frontend_player, board_int_num);

    if player.to_string() == frontend_player.to_string() && frontend_player != "spectator" {
        return Ok(Json(GameState::new(
            "It's not your turn to undo!".to_string(),
            vec![],
            &room.board,
            board_int_num
        )));
    }

    room.board.undo();

    let board_int_num = match frontend_player.as_str() {
        "black" => {
            room.players.black.as_mut().unwrap().board_interaction_number = board_int_num + 1;
            room.players.black.as_ref().unwrap().board_interaction_number
        }
        _ => {
            room.players.white.as_mut().unwrap().board_interaction_number = board_int_num + 1;
            room.players.white.as_ref().unwrap().board_interaction_number
        }
    };

    println!("UNDO AFTER VALIDATION!! Player: {}, board_interaction_number: {}", frontend_player, board_int_num);


    // Get the playable board dimensions
    let (rows, cols) = get_playable_dimensions(&room.board);

    // Convert board state to string format for frontend, excluding sentinel borders
    let board_state: Vec<Vec<String>> = room.board.fields[1..=rows].iter()
        .map(|row| {
            row[1..=cols].iter()
                .map(|&color| color_to_string(color))
                .collect()
        })
        .collect();

    Ok(Json(GameState::new(
        "Undo successful".to_string(),
        board_state,
        &room.board,
        board_int_num
    ).with_stones_in_atari(room.board.stones_in_atari.clone())))
}

#[derive(Deserialize)]
struct SyncBoardsPayload {
    match_string: String,
    player: String,
}

#[handler]
async fn sync_boards(payload: Json<SyncBoardsPayload>) -> Result<Json<GameState>, Error> {
    let mut rooms = lock_rooms()?;

    // Create room if it doesn't exist
    let room = rooms
        .entry(payload.match_string.clone())
        .or_insert_with(GameRoom::new);

    let mut guess_stones = lock_guess_stones()?;

    let (rows, cols) = get_playable_dimensions(&room.board);

    let board_state: Vec<Vec<String>> = room.board.fields[1..=rows].iter()
        .map(|row| {
            row[1..=cols].iter()
                .map(|&color| color_to_string(color))
                .collect()
        })
        .collect();

    let (black_stones, white_stones) = guess_stones
        .entry(payload.match_string.clone())
        .or_insert((Vec::new(), Vec::new()));

    let game_state = match room.board.get_winner() {
        Some(winner) => {
            GameState::new(
                format!("Game over! Winner: {}", winner.to_string()),
                board_state.clone(),
                &room.board,
                0
            ).with_winner(winner.to_string())
        },
        None => {
            let board_int_num = match payload.player.as_ref() {
                "black" => room.players.black.as_ref().unwrap().board_interaction_number,
                _ => room.players.white.as_ref().unwrap().board_interaction_number,
            };
                GameState::new(
                "Current board state sent".to_string(),
                board_state.clone(),
                &room.board,
                board_int_num
            ).with_guess_stones(black_stones.clone(), white_stones.clone())
            .with_stones_in_atari(room.board.stones_in_atari.clone())
        }
    };

    Ok(Json(game_state))
}

#[handler]
async fn join_game(payload: Json<JoinGameRequest>) -> Result<Json<JoinGameResponse>, Error> {
    let mut rooms = lock_rooms()?;

    let room = rooms.entry(payload.match_string.clone())
        .or_insert_with(GameRoom::new);

    if payload.is_spectator {
        return Ok(Json(JoinGameResponse {
            color: "spectator".to_string(),
            redirect_url: format!("{}?match={}&token=", "/frontend/main.html", payload.match_string),
            session_token: String::new(),
        }))
    }

    let (color, url, session_token) = match (&room.players.black, &room.players.white) {
        (None, None) => {
            // First player - random color
            let is_black = random::<bool>();
            let new_token = uuid::Uuid::new_v4().to_string();

            if is_black {
                room.players.black = Some(PlayerSession {
                    color: Player::Black,
                    session_token: new_token.clone(),
                    board_interaction_number: 0
                });
                ("black", "/frontend/black.html", new_token)
            } else {
                room.players.white = Some(PlayerSession {
                    color: Player::White,
                    session_token: new_token.clone(),
                    board_interaction_number: 0
                });
                ("white", "/frontend/white.html", new_token)
            }
        },
        (Some(_black), None) => {
            // Second player - gets opposite color
            let new_token = uuid::Uuid::new_v4().to_string();
            room.players.white = Some(PlayerSession {
                color: Player::White,
                session_token: new_token.clone(),
                board_interaction_number: 0
            });
            ("white", "/frontend/white.html", new_token)
        },
        (None, Some(_white)) => {
            // Second player - gets opposite color
            let new_token = uuid::Uuid::new_v4().to_string();
            room.players.black = Some(PlayerSession {
                color: Player::Black,
                session_token: new_token.clone(),
                board_interaction_number: 0
            });
            ("black", "/frontend/black.html", new_token)
        },
        (Some(black), Some(white)) => {
            // Both players exist - check session token
            if let Some(token) = &payload.session_token {
                if token == &black.session_token {
                    ("black", "/frontend/black.html", black.session_token.clone())
                } else if token == &white.session_token {
                    ("white", "/frontend/white.html", white.session_token.clone())
                } else {
                    ("spectator", "/frontend/main.html", String::new())
                }
            } else {
                ("spectator", "/frontend/main.html", String::new())
            }
        }
    };

    // Return the response with session token
    Ok(Json(JoinGameResponse {
        color: color.to_string(),
        redirect_url: format!("{}?match={}&token={}", url, payload.match_string, session_token),
        session_token
    }))
}

fn get_stones_mut<'a>(
    guess_stones: &'a mut HashMap<String, (Vec<Vec<usize>>, Vec<Vec<usize>>)>,
    match_string: &str,
    color: &str,
) -> &'a mut Vec<Vec<usize>> {
    let (black_stones, white_stones) = guess_stones
        .entry(match_string.to_string())
        .or_insert((Vec::new(), Vec::new()));

    match color {
        "black" => black_stones,
        _ => white_stones,
    }
}

#[handler]
async fn sync_guess_stones(payload: Json<GuessStonesSync>) -> Result<Json<String>, Error> {
    {
        let mut rooms = lock_rooms()?;
        let mut room = get_room(&mut rooms, &payload.match_string)?;

        match payload.color.as_str() {
            "black" => {
                room.players.white.as_mut().unwrap().board_interaction_number = payload.board_interaction_number + 1;
            }
            _ => {
                room.players.black.as_mut().unwrap().board_interaction_number = payload.board_interaction_number + 1;
            }
        };
    }
       
    {
        let mut guess_stones = lock_guess_stones()?;
        let stones = get_stones_mut(&mut guess_stones, &payload.match_string, &payload.color);
        *stones = payload.stones.clone();
    }
    
    Ok(Json("Stones synced".to_string()))
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn json_error(msg: &str, status: StatusCode) -> Error {
    Error::from_response(
        Response::builder()
            .status(status)
            .content_type("application/json")
            .body(serde_json::to_string(&ErrorResponse { error: msg.to_string() }).unwrap())
    )
}

#[handler]
async fn reset_memory() {
    let mut rooms = GAME_ROOMS.lock().unwrap();
    rooms.clear();
    
    let mut guess_stones = GUESS_STONES.lock().unwrap();
    guess_stones.clear();
}

pub async fn start_server() -> Result<(), std::io::Error> {
    // Load .env file if it exists
    let _ = dotenv::dotenv();

    // Get frontend origin from environment variable, fallback to default
    let frontend_origin = env::var("FRONTEND_ORIGIN")
        .unwrap_or_else(|_| "http://127.0.0.1:5501".to_string());

    let cors = Cors::new()
        .allow_origin(frontend_origin.clone()) // Allow the frontend origin
        .allow_methods(vec!["POST", "GET"])
        .allow_headers(vec!["Content-Type"]); // Allow Content-Type header

    let app = Route::new()
    .at("/", poem::get(root_endpoint))
    .at("/join-game", poem::post(join_game))
        .at("/cell-click", poem::post(cell_click))
        .at("/dimensions", poem::post(get_dimensions))
        .at("/undo", poem::post(undo))
        .at("/pass", poem::post(pass))
        .at("/get-group", poem::post(get_group))
        .at("/get-score", poem::post(get_score))
        .at("/sync-guess-stones", poem::post(sync_guess_stones))
        .at("/sync-boards", poem::post(sync_boards))
        .at("/resign", poem::post(handle_resignation))
        .at("/reset-memory", poem::post(reset_memory))
        .with(cors);

    println!("Server running at http://127.0.0.1:8000");
    println!("Allowed frontend origin: {}", frontend_origin);
    Server::new(TcpListener::bind("127.0.0.1:8000"))
        .run(app)
        .await
}