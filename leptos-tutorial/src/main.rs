use leptos::*;

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}

#[component]
fn App() -> impl IntoView {
    let (x, set_x) = create_signal(0);

    view! {
        <button
            on:click=move |_| {
                set_x.update(|n| *n += 10);
            }
            // Set the 'style' attribute
            style="position: absolute"
            // and toggle individual CSS properties with 'style:'
            style:left=move || format!("{}px", x() + 100)
            style:background-color=move || format!("rgb({}, {}, 100)", x(), 100)
            style:max-width="400px"
            // Set a CSS variable for stylesheet use
            style=("--columns", x)
        >
            "Click to move"
        </button>
    }
}
