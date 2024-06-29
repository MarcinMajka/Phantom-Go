use leptos::*;

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}

#[component]
fn ProgressBar(#[prop(optional)] max: u16, progress: ReadSignal<i32>) -> impl IntoView {
    view! {
        <progress
            max=max
            value=progress
        />
    }
}

#[component]
fn App() -> impl IntoView {
    let (p, set_p) = create_signal(0);

    view! {
        <button
            on:click=move |_| {
                set_p.update(|n| *n += 1);
            }
        >
            "Click to progress"
        </button>
        <br />

        <p>{format!("Progress bar without 'max' prop: ")}</p>
        <ProgressBar progress=p/>
        <p>{format!("Progress bar with 'max=10' prop: ")}</p>
        <ProgressBar max=10 progress=p/>
    }
}
