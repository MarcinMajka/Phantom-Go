use leptos::*;

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}

#[component]
fn App() -> impl IntoView {
    let (x, set_x) = create_signal(0);
    let (p, set_p) = create_signal(0);

    // Create a derived signal to monitor the multiplied value of `p`.
    // Derived signals let you create reactive computed values that can be used in multiple places in your application with minimal overhead.
    // This ensures the reactivity system correctly tracks changes to `p` and updates the derived signal accordingly.
    let p_multiplied = move || p() * 3;

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
        <br />
        <button
            on:click=move |_| {
                set_p.update(|n| *n += 1);
            }
        >
            "Click to progress"
        </button>
        <br />
        // Display the raw `p` value for debugging
        <p>{move || format!("p value: {}", p())}</p>
        // Display the multiplied `p` value for debugging
        <p>{move || format!("p multiplied value: {}", p_multiplied())}</p>
        <progress
            max="50"
            // Use the derived signal `p_multiplied` for the `value` attribute
            // When move || p() * 3 was used, the progress bar filling speed didn't change,
            // regardless of however p() was multiplied
            value=move || p_multiplied()
        />
    }
}
