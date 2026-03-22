use tauri::Manager;

#[tauri::command]
fn get_network_interfaces() -> Vec<String> {
    // Stub: return placeholder network interfaces
    vec![
        "eth0".to_string(),
        "lo".to_string(),
        "wlan0".to_string(),
    ]
}

#[tauri::command]
fn read_scan_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn capture_pcap(_interface: String, _duration: u32) -> Result<String, String> {
    // Stub: PCAP capture will be implemented with the pcap crate
    Ok("PCAP capture not yet implemented".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_network_interfaces,
            read_scan_file,
            capture_pcap,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
