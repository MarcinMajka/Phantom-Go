mod board;
mod server;

use board::{Board, Loc, Move};
use tokio::task;

#[tokio::main]
async fn main() {
    let mut board = Board::new(7, 7, 1.5);

    // Spawn the server in the background
    let server_task = task::spawn(server::start_server());

    // CLI game loop
    while !board.last_two_moves_are_pass() {
        println!(
            "Turn: {:?}\nInput coordinates to play, 'u' to undo, 'p' to pass or 'q' to quit",
            board.get_current_player()
        );
        let player_input = board::take_player_input();

        match player_input.as_str() {
            "q" => {
                println!("\nQuit game!\n");
                return;
            }
            "p" => board.play(&Move {
                player: board.get_current_player(),
                loc: Loc::pass(),
            }),
            "u" => {
                board = board.undo();
            }
            _ => match Loc::from_string(&player_input) {
                None => {
                    println!("\nInvalid move :c\nT R Y  A G A I N !\n");
                }
                Some(valid_loc_string) => {
                    board.play(&Move {
                        player: board.get_current_player(),
                        loc: valid_loc_string,
                    });
                }
            },
        }
        println!("{}", board.to_string());
    }

    println!("{}", board.count_score().to_string());

    // Wait for the server to stop (it won't unless you terminate the program)
    let _ = server_task.await;
}
