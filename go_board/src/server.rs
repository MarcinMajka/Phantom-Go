use poem::{
    middleware::Cors,
    handler,
    listener::TcpListener,
    web::Json,
    EndpointExt, Route, Server, Result
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

#[handler]
async fn get_dimensions() -> Json<BoardDimensions> {
    let board = GAME_BOARD.lock().unwrap();
    let (rows, cols) = get_playable_dimensions(&board);
    Json(BoardDimensions { rows, cols })
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
    let mut board = GAME_BOARD.lock().unwrap();
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
async fn get_group(payload: Json<CellClick>) -> Json<Vec<Loc>> {
    let board = GAME_BOARD.lock().unwrap();
    let group = board.group_stones(Loc { row: payload.row + 1, col: payload.col + 1 });
    Json(group)
}

#[handler]
async fn get_score(payload: Json<Vec<Vec<Loc>>>) -> Json<String> {
    let mut board = GAME_BOARD.lock().unwrap();
    
    remove_dead_groups(&mut board, payload);

    let score = board.count_score().to_string();

    Json(score)
}

fn remove_dead_groups(board: &mut Board, groups: Json<Vec<Vec<Loc>>>) {
    for group in groups.iter() {
        let loc = group[0];
        board.remove_group(loc);
    }
}

#[handler]
async fn pass() -> Json<GameState> {
    let mut board = GAME_BOARD.lock().unwrap();
    // Getting player here, because of ownership - coudn't borrow it immutably during board.play() (mutable borrow);
    let player = board.get_current_player();

    board.play(&Move {
        player,
        loc: Loc::pass(),
    });

    let game_is_over = board.last_two_moves_are_pass();

    if !game_is_over {
        Json(GameState {
            message: format!("Player {:?} passed", board.get_current_player().opponent()),
            board: vec![],
            black_player_board: vec![],
            white_player_board: vec![],
            current_player: player_to_string(board.get_current_player()),
            black_captures: board.get_black_captures(),
            white_captures: board.get_white_captures(),
            white_guess_stones: vec![],
            black_guess_stones: vec![],
        })
    } else {
        Json(GameState {
            message: format!("Both players passed. Game over!"),
            board: vec![],
            black_player_board: vec![],
            white_player_board: vec![],
            current_player: "counting".to_string(),
            black_captures: board.get_black_captures(),
            white_captures: board.get_white_captures(),
            white_guess_stones: vec![],
            black_guess_stones: vec![],
        })
    }

        
}

#[handler]
async fn undo() -> Json<GameState> {
    let mut board = GAME_BOARD.lock().unwrap();
    board.undo();
    
    // Get the playable board dimensions
    let (rows, cols) = get_playable_dimensions(&board);
    
    // Convert board state to string format for frontend, excluding sentinel borders
    let board_state: Vec<Vec<String>> = board.fields[1..=rows].iter()
        .map(|row| {
            row[1..=cols].iter()
                .map(|&color| color_to_string(color))
                .collect()
        })
        .collect();

    Json(GameState {
        message: "Undo successful".to_string(),
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

#[handler]
async fn sync_boards() -> Json<GameState> {
    let board = GAME_BOARD.lock().unwrap();
    // Needs to be mutable to use .entry() - .get() was troublesome
    let mut guess_stones = GUESS_STONES.lock().unwrap();

    let (rows, cols) = get_playable_dimensions(&board);

    let board_state: Vec<Vec<String>> = board.fields[1..=rows].iter()
        .map(|row| {
            row[1..=cols].iter()
                .map(|&color| color_to_string(color))
                .collect()
        })
        .collect();

    let (black_stones, white_stones) = guess_stones
    .entry(String::from(""))
    .or_insert((Vec::new(), Vec::new()));

    Json(GameState {
        message: "Current board state sent".to_string(),
        board: board_state.clone(),
        black_player_board: board_state.clone(),
        white_player_board: board_state,
        current_player: player_to_string(board.get_current_player()),
        black_captures: board.get_black_captures(),
        white_captures: board.get_white_captures(),
        black_guess_stones: black_stones.clone(),
        white_guess_stones: white_stones.clone(),
    })
}

#[handler]
async fn join_game(payload: Json<JoinGameRequest>) -> Json<JoinGameResponse> {
    let mut rooms = GAME_ROOMS.lock().unwrap();
    
    if !rooms.contains_key(&payload.match_string) {
        rooms.insert(payload.match_string.clone(), GameRoom::new());
    }
    
    let mut room = rooms.get_mut(&payload.match_string).unwrap();

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
async fn sync_guess_stones(payload: Json<GuessStonesSync>) -> Json<String> {
    println!("Received payload: {:?}", payload);
    let mut guess_stones = GUESS_STONES.lock().unwrap();
    let (black_stones, white_stones) = guess_stones.entry(payload.match_string.clone()).or_insert((Vec::new(), Vec::new()));

    if payload.color == "black" {
        *black_stones = payload.stones.clone();
    } else {
        *white_stones = payload.stones.clone();

    }

    println!("{:?}", guess_stones);

    Json("Stones synced".to_string())
}

pub async fn start_server() -> Result<(), std::io::Error> {
    let cors = Cors::new()
        .allow_origin("http://127.0.0.1:5501") // Allow the frontend origin
        .allow_methods(vec!["POST", "GET"])
        .allow_headers(vec!["Content-Type"]); // Allow Content-Type header

    let app = Route::new()
    .at("/join-game", poem::post(join_game))
        .at("/cell-click", poem::post(cell_click))
        .at("/dimensions", poem::get(get_dimensions))
        .at("/undo", poem::post(undo))
        .at("/pass", poem::post(pass))
        .at("/get-group", poem::post(get_group))
        .at("/get-score", poem::post(get_score))
        .at("/sync-guess-stones", poem::post(sync_guess_stones))
        .at("/sync-boards", poem::get(sync_boards))
        .with(cors);

    println!("Server running at http://127.0.0.1:8000");
    Server::new(TcpListener::bind("127.0.0.1:8000"))
        .run(app)
        .await
}