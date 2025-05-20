use poem::{
    middleware::Cors,
    handler,
    listener::TcpListener,
    web::Json,
    EndpointExt, Route, Server, Result, Error,
    http::StatusCode, Response
};
use serde::{Serialize, Deserialize};
use crate::board::{Board, Move, Loc, Player, Color};
use std::collections::HashMap;
use std::sync::Mutex;
use lazy_static::lazy_static;

#[derive(Serialize, Deserialize)]
struct JoinGameRequest {
    match_string: String,
    password: String,
}

#[derive(Serialize)]
struct JoinGameResponse {
    color: String,
    redirect_url: String
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
}

#[derive(Deserialize, Debug)]
struct GuessStonesSync {
    color: String,
    stones: Vec<Vec<usize>>,
    match_string: String,
}

#[derive(Clone)]
struct GameRoom {
    board: Board,
    players: ((Option<Player>, Option<String>), (Option<Player>, Option<String>)),
}

impl GameRoom {
    fn new() -> Self {
        GameRoom {
            board: Board::new(9, 9, 1.5),
            players: ((None, None), (None, None)),
        }
    }
}

/*
    TODO: Bug fix: Not sure if this is the case, but I remember testing 2 separate games (2 differnt match_strings) and seeing it working. Maybe static mut is not the cause, but it should be avoided. - It was not the cause, but it's still a good practice to avoid static mut.
*/
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

fn player_to_string(player: Player) -> String {
    match player {
        Player::Black => "black".to_string(),
        Player::White => "white".to_string(),
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

#[handler]
async fn get_dimensions(payload: Json<MatchStringPayload>) -> Result<Json<BoardDimensions>, Error> {
    let mut rooms = GAME_ROOMS
        .lock()
        .map_err(|_| json_error("Failed to lock rooms", StatusCode::INTERNAL_SERVER_ERROR))?;
    
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
async fn cell_click(payload: Json<CellClick>) -> Json<GameState> {
    let mut rooms = GAME_ROOMS.lock().unwrap();
    let mut room = rooms.get_mut(&payload.match_string).unwrap();
    let board = &mut room.board;

    let current_player = board.get_current_player();
    // Check if the move was made on correct player's board
    let frontend_board = payload.frontend_board.clone();
    let board_state: Vec<Vec<String>> = get_board_state(&board);

    let correct_board = match current_player {
        Player::Black => "black",
        Player::White => "white",
    };

    if correct_board != frontend_board && frontend_board != "main" {
        return Json(GameState {
            message: format!("It's not your turn!"),
            board: board_state.clone(),
            black_player_board: board_state.clone(),
            white_player_board: board_state,
            current_player: player_to_string(board.get_current_player()),
            black_captures: board.get_black_captures(),
            white_captures: board.get_white_captures(),
            white_guess_stones: vec![],
            black_guess_stones: vec![],
        });
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
    
    let board_state: Vec<Vec<String>> = get_board_state(&board);
    
    Json(GameState {
        message: format!("Move attempted at ({}, {})", payload.row, payload.col),
        board: board_state.clone(),
        black_player_board: board_state.clone(),
        white_player_board: board_state,
        current_player: player_to_string(board.get_current_player()),
        black_captures: board.get_black_captures(),
        white_captures: board.get_white_captures(),
        white_guess_stones: vec![],
        black_guess_stones: vec![],
    })
}

// Returns clicked group of stones during counting
#[handler]
async fn get_group(payload: Json<CellClick>) -> Result<Json<Vec<Loc>>, Error> {
    let mut rooms = GAME_ROOMS
        .lock()
        .map_err(|_| json_error("Failed to lock rooms", StatusCode::INTERNAL_SERVER_ERROR))?;
    let mut room = rooms
        .get_mut(&payload.match_string)
        .ok_or_else(|| json_error("Game room not found", StatusCode::NOT_FOUND))?;
    let board = &mut room.board;
    let group = board.group_stones(Loc { row: payload.row + 1, col: payload.col + 1 });
    Ok(Json(group))
}

#[derive(Deserialize)]
struct GetScorePayload {
    match_string: String,
    groups: Vec<Vec<Loc>>,
}

#[handler]
async fn get_score(payload: Json<GetScorePayload>) -> Json<String> {
    let match_string = payload.match_string.clone();
    let groups = payload.groups.clone();
    let mut rooms = GAME_ROOMS.lock().unwrap();
    let room = rooms.get_mut(&match_string).unwrap();

    remove_dead_groups(&mut room.board, Json(groups));

    let score = room.board.count_score().to_string();

    Json(score)
}

fn remove_dead_groups(board: &mut Board, groups: Json<Vec<Vec<Loc>>>) {
    for group in groups.iter() {
        let loc = group[0];
        board.remove_group(loc);
    }
}

#[handler]
async fn pass(payload: Json<MatchStringPayload>) -> Result<Json<GameState>, Error> {
    let mut rooms = GAME_ROOMS
        .lock()
        .map_err(|_| json_error("Failed to lock rooms", StatusCode::INTERNAL_SERVER_ERROR))?;
    let room = rooms
        .get_mut(&payload.match_string.to_string())
        .ok_or_else(|| json_error("Game room not found", StatusCode::NOT_FOUND))?;
    // Getting player here, because of ownership - coudn't borrow it immutably during board.play() (mutable borrow);
    let player = room.board.get_current_player();

    room.board.play(&Move {
        player,
        loc: Loc::pass(),
    });

    let game_is_over = room.board.last_two_moves_are_pass();

    if !game_is_over {
        Ok(Json(GameState {
            message: format!("Player {:?} passed", room.board.get_current_player().opponent()),
            board: vec![],
            black_player_board: vec![],
            white_player_board: vec![],
            current_player: player_to_string(room.board.get_current_player()),
            black_captures: room.board.get_black_captures(),
            white_captures: room.board.get_white_captures(),
            white_guess_stones: vec![],
            black_guess_stones: vec![],
        }))
    } else {
        Ok(Json(GameState {
            message: format!("Both players passed. Game over!"),
            board: vec![],
            black_player_board: vec![],
            white_player_board: vec![],
            current_player: "counting".to_string(),
            black_captures: room.board.get_black_captures(),
            white_captures: room.board.get_white_captures(),
            white_guess_stones: vec![],
            black_guess_stones: vec![],
        }))
    }

        
}

#[handler]
async fn undo(payload: Json<MatchStringPayload>) -> Result<Json<GameState>, Error> {
    let mut rooms = GAME_ROOMS
        .lock()
        .map_err(|_| json_error("Failed to lock rooms", StatusCode::INTERNAL_SERVER_ERROR))?;
    let room = rooms
        .get_mut(&payload.match_string.to_string())
        .ok_or_else(|| json_error("Game room not found", StatusCode::NOT_FOUND))?;
    room.board.undo();
    
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

    Ok(Json(GameState {
        message: "Undo successful".to_string(),
        board: board_state.clone(),
        black_player_board: board_state.clone(),
        white_player_board: board_state,
        current_player: player_to_string(room.board.get_current_player()),
        black_captures: room.board.get_black_captures(),
        white_captures: room.board.get_white_captures(),
        white_guess_stones: vec![],
        black_guess_stones: vec![],
    }))
}

#[handler]
async fn sync_boards(payload: Json<MatchStringPayload>) -> Result<Json<GameState>, Error> {
    let mut rooms = GAME_ROOMS
        .lock()
        .map_err(|_| json_error("Failed to lock rooms", StatusCode::INTERNAL_SERVER_ERROR))?;
    
    // Create room if it doesn't exist
    let room = rooms
        .entry(payload.match_string.clone())
        .or_insert_with(GameRoom::new);
        
    let mut guess_stones = GUESS_STONES
        .lock()
        .map_err(|_| json_error("Failed to lock guess stones", StatusCode::INTERNAL_SERVER_ERROR))?;

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

    Ok(Json(GameState {
        message: "Current board state sent".to_string(),
        board: board_state.clone(),
        black_player_board: board_state.clone(),
        white_player_board: board_state,
        current_player: player_to_string(room.board.get_current_player()),
        black_captures: room.board.get_black_captures(),
        white_captures: room.board.get_white_captures(),
        black_guess_stones: black_stones.clone(),
        white_guess_stones: white_stones.clone(),
    }))
}

#[handler]
async fn join_game(payload: Json<JoinGameRequest>) -> Json<JoinGameResponse> {
    let mut rooms = GAME_ROOMS.lock().unwrap();
    
    let room = rooms.entry(payload.match_string.clone())
        .or_insert_with(GameRoom::new);

    let (color, url) = match (&room.players.0, &room.players.1) {
        ((None, _), _) => {
            room.players.0 = (Some(Player::Black), Some(payload.password.clone()));
            ("black", "/frontend/black.html")
        },
        ((Some(_), _), (None, _)) => {
            room.players.1 = (Some(Player::White), Some(payload.password.clone()));
            ("white", "/frontend/white.html")
        },
        _ => ("spectator", "/frontend/main.html")
    };

    // Add match_string as query parameter
    let redirect_url = format!("{}?match={}", url, payload.match_string);

    Json(JoinGameResponse {
        color: color.to_string(),
        redirect_url
    })
}

#[handler]
async fn sync_guess_stones(payload: Json<GuessStonesSync>) -> Result<Json<String>, Error> {
    println!("Received payload: {:?}", payload);
    let mut guess_stones = GUESS_STONES
        .lock()
        .map_err(|_| json_error("Failed to lock guess stones", StatusCode::INTERNAL_SERVER_ERROR))?;
    
    let (black_stones, white_stones) = guess_stones
        .entry(payload.match_string.clone())
        .or_insert((Vec::new(), Vec::new()));

    if payload.color == "black" {
        *black_stones = payload.stones.clone();
    } else {
        *white_stones = payload.stones.clone();
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

pub async fn start_server() -> Result<(), std::io::Error> {
    let cors = Cors::new()
        .allow_origin("http://127.0.0.1:5501") // Allow the frontend origin
        .allow_methods(vec!["POST", "GET"])
        .allow_headers(vec!["Content-Type"]); // Allow Content-Type header

    let app = Route::new()
    .at("/join-game", poem::post(join_game))
        .at("/cell-click", poem::post(cell_click))
        .at("/dimensions", poem::post(get_dimensions))
        .at("/undo", poem::post(undo))
        .at("/pass", poem::post(pass))
        .at("/get-group", poem::post(get_group))
        .at("/get-score", poem::post(get_score))
        .at("/sync-guess-stones", poem::post(sync_guess_stones))
        .at("/sync-boards", poem::post(sync_boards))
        .with(cors);

    println!("Server running at http://127.0.0.1:8000");
    Server::new(TcpListener::bind("127.0.0.1:8000"))
        .run(app)
        .await
}