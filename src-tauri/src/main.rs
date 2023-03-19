#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{
    api::process::{Command, CommandEvent},
    Manager,
};
mod spotlight;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            spotlight::init_spotlight_window,
            spotlight::hide_spotlight
        ])
        .manage(spotlight::State::default())
        .setup(move |app| {
            // Set the app's activation poicy to Accessory does the following behaviours:
            // - Makes the windows of this app appear above full-screen windows of other apps.
            // - Prevents the app's icon from showing on the dock.
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app.get_window("main").unwrap();
            tauri::async_runtime::spawn(async move {
                let (mut rx, mut child) = Command::new_sidecar("app")
                    .expect("failed to setup `app` sidecar")
                    .spawn()
                    .expect("Failed to spawn packaged node");

                let mut i = 0;
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line) = event {
                        window
                            .emit("message", Some(format!("'{}'", line)))
                            .expect("failed to emit event");
                        i += 1;
                        if i == 4 {
                            child.write("message from Rust\n".as_bytes()).unwrap();
                            i = 0;
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
