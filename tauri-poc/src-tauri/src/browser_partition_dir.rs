use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub(crate) fn partition_dir_name(partition: &str) -> String {
    let trimmed = partition.trim();
    let effective = if trimmed.is_empty() {
        "orca-browser-default"
    } else {
        trimmed
    };
    let mut slug = String::new();
    let mut last_dash = false;
    for ch in effective.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash && !slug.is_empty() {
            slug.push('-');
            last_dash = true;
        }
        if slug.len() >= 24 {
            break;
        }
    }
    let slug = slug.trim_matches('-');
    let safe_slug = if slug.is_empty() { "partition" } else { slug };
    let digest = Sha256::digest(effective.as_bytes());
    let mut hex = String::with_capacity(16);
    for byte in &digest[..8] {
        hex.push_str(&format!("{byte:02x}"));
    }
    format!("{safe_slug}-{hex}")
}

/// Resolves an isolated WebView2 `data_directory` on Windows for each browser partition.
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn resolve_browser_partition_dir(
    app: &AppHandle,
    partition: &str,
) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let dir = base
        .join("browser-partitions")
        .join(partition_dir_name(partition));
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::partition_dir_name;

    #[test]
    fn distinct_partitions_derive_distinct_safe_dir_names() {
        let a = partition_dir_name("persist:env-a");
        let b = partition_dir_name("persist:env-b");
        assert_ne!(a, b);
        assert_eq!(a, partition_dir_name("persist:env-a"));
        assert!(!a.contains('/') && !a.contains('\\') && !a.contains(':'));
    }

    #[test]
    fn empty_and_traversal_partitions_stay_single_segment() {
        let empty = partition_dir_name("   ");
        assert!(empty.starts_with("orca-browser-default-"));
        let traversal = partition_dir_name("../../..\\Windows\\System32");
        assert!(!traversal.contains("..") && !traversal.contains('/') && !traversal.contains('\\'));
    }
}
