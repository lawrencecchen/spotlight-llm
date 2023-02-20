#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod accessibility;
mod spotlight;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![spotlight::init_spotlight_window])
        .manage(accessibility::State::default())
        .setup(move |app| {
            // Set the app's activation poicy to Accessory does the following behaviours:
            // - Makes the windows of this app appear above full-screen windows of other apps.
            // - Prevents the app's icon from showing on the dock.
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // request accessibility permission
            accessibility::query_accessibility_permissions(true);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
