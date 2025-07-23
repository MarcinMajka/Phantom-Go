mod board;
mod server;

use tokio::task;

#[tokio::main]
async fn main() {
    // Spawn the server in the background
    let server_task = task::spawn(server::start_server());
    // Wait for the server to stop (it won't unless you terminate the program)
    let _ = server_task.await;
}
