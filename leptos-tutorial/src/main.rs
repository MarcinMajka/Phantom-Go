use leptos::*;

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}

#[component]
fn App() -> impl IntoView {
    // Define the positions and starting points for the lines
    let y_positions: Vec<_> = (1..=260).step_by(20).collect();
    let x_positions = y_positions.clone();

    // Create the horizontal lines using a loop
    let horizontal_lines = y_positions.into_iter().map(|y| {
        view! {
            <line x1="0" y1={y.to_string()} x2="242" y2={y.to_string()} stroke="black" stroke-width="2" />
        }
    }).collect_view();
    let vertical_lines = x_positions.into_iter().map(|x| {
        view! {
            <line x1={x.to_string()} y1="0" x2={x.to_string()} y2="242" stroke="black" stroke-width="2" />
        }
    }).collect_view();

    // Render the SVG element with the lines
    view! {
        <svg width="260" height="260" xmlns="http://www.w3.org/2000/svg">
            {[horizontal_lines, vertical_lines]}
        </svg>
    }
}
