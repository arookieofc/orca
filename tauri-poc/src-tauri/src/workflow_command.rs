use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::sync::watch;

const DEFAULT_TIMEOUT_SECS: u64 = 300;
const MAX_OUTPUT_CHARS: usize = 16_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunWorkflowCommandArgs {
    pub workdir: String,
    pub command: String,
    #[serde(default)]
    pub shell: Option<String>,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunWorkflowCommandResult {
    pub passed: bool,
    pub exit_code: i32,
    pub output: String,
}

fn build_tokio_shell_command(shell: Option<&str>, trimmed: &str) -> Command {
    let mut cmd = match shell.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("powershell") => {
            let mut c = Command::new("powershell");
            c.args(["-NoProfile", "-Command", trimmed]);
            c
        }
        Some("pwsh") => {
            let mut c = Command::new("pwsh");
            c.args(["-NoProfile", "-Command", trimmed]);
            c
        }
        Some("cmd") => {
            let mut c = Command::new("cmd");
            c.args(["/C", trimmed]);
            c
        }
        Some("bash") => {
            let mut c = Command::new("bash");
            c.args(["-lc", trimmed]);
            c
        }
        Some("zsh") => {
            let mut c = Command::new("zsh");
            c.args(["-lc", trimmed]);
            c
        }
        Some("sh") => {
            let mut c = Command::new("sh");
            c.args(["-c", trimmed]);
            c
        }
        Some("wsl") => {
            let mut c = Command::new("wsl");
            c.args(["sh", "-lc", trimmed]);
            c
        }
        _ if cfg!(windows) => {
            let mut c = Command::new("cmd");
            c.args(["/C", trimmed]);
            c
        }
        _ => {
            let mut c = Command::new("sh");
            c.args(["-c", trimmed]);
            c
        }
    };
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

async fn kill_process_tree(child: &mut tokio::process::Child) {
    #[cfg(windows)]
    if let Some(pid) = child.id() {
        let mut kill_cmd = Command::new("taskkill");
        kill_cmd
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(0x0800_0000);
        let _ = kill_cmd.status().await;
    }
    let _ = child.kill().await;
    let _ = child.wait().await;
}

pub fn truncate_command_output(raw: &str, max_chars: usize) -> String {
    let total = raw.chars().count();
    if total <= max_chars || max_chars < 64 {
        return raw.to_string();
    }
    let head_len = max_chars / 2;
    let tail_len = max_chars - head_len;
    let head: String = raw.chars().take(head_len).collect();
    let tail: String = raw.chars().skip(total - tail_len).collect();
    format!("{head}\n\n... [已省略 {} 字符] ...\n\n{tail}", total - max_chars)
}

async fn wait_for_cancel(cancel_rx: &mut Option<watch::Receiver<bool>>) {
    match cancel_rx {
        Some(rx) => {
            if *rx.borrow() {
                return;
            }
            while rx.changed().await.is_ok() {
                if *rx.borrow() {
                    return;
                }
            }
            std::future::pending::<()>().await;
        }
        None => std::future::pending::<()>().await,
    }
}

pub async fn run_workflow_command_with_cancel(
    workdir: &str,
    command: &str,
    shell: Option<&str>,
    timeout_secs: u64,
    mut cancel_rx: Option<watch::Receiver<bool>>,
) -> Result<RunWorkflowCommandResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Workflow CLI command is empty.".to_string());
    }
    let dir = Path::new(workdir);
    if !dir.exists() {
        return Err(format!("Working directory does not exist: {workdir}"));
    }
    if cancel_rx.as_ref().is_some_and(|rx| *rx.borrow()) {
        return Err("验收命令已中止".to_string());
    }

    let clamped_timeout = timeout_secs.clamp(5, 1800);
    let mut cmd = build_tokio_shell_command(shell, trimmed);
    cmd.current_dir(dir);
    let mut child = cmd
        .spawn()
        .map_err(|err| format!("Failed to execute '{trimmed}': {err}"))?;

    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();
    let out_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        if let Some(ref mut out) = stdout {
            let _ = out.read_to_end(&mut buf).await;
        }
        String::from_utf8_lossy(&buf).into_owned()
    });
    let err_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        if let Some(ref mut err) = stderr {
            let _ = err.read_to_end(&mut buf).await;
        }
        String::from_utf8_lossy(&buf).into_owned()
    });

    let sleep = tokio::time::sleep(Duration::from_secs(clamped_timeout));
    tokio::pin!(sleep);

    let status = tokio::select! {
        wait_res = child.wait() => {
            wait_res.map_err(|err| format!("Failed waiting for '{trimmed}': {err}"))?
        }
        _ = &mut sleep => {
            kill_process_tree(&mut child).await;
            out_task.abort();
            err_task.abort();
            return Err(format!("验收命令已超时（{clamped_timeout} 秒）"));
        }
        _ = wait_for_cancel(&mut cancel_rx) => {
            kill_process_tree(&mut child).await;
            out_task.abort();
            err_task.abort();
            return Err("验收命令已中止".to_string());
        }
    };

    let stdout_str = out_task.await.unwrap_or_default();
    let stderr_str = err_task.await.unwrap_or_default();
    let combined = match (stdout_str.trim().is_empty(), stderr_str.trim().is_empty()) {
        (false, false) => format!("{}\n{}", stdout_str.trim_end(), stderr_str.trim_end()),
        (false, true) => stdout_str.trim_end().to_string(),
        (true, false) => stderr_str.trim_end().to_string(),
        (true, true) => String::new(),
    };

    Ok(RunWorkflowCommandResult {
        passed: status.success(),
        exit_code: status.code().unwrap_or(-1),
        output: truncate_command_output(&combined, MAX_OUTPUT_CHARS),
    })
}

#[tauri::command]
pub async fn poc_run_workflow_command(
    args: RunWorkflowCommandArgs,
) -> Result<RunWorkflowCommandResult, String> {
    run_workflow_command_with_cancel(
        &args.workdir,
        &args.command,
        args.shell.as_deref(),
        args.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS),
        None,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn runs_simple_echo_command_in_temp_dir() {
        let dir = std::env::temp_dir();
        let res = run_workflow_command_with_cancel(
            dir.to_str().unwrap(),
            "echo orca-cli-ok",
            None,
            DEFAULT_TIMEOUT_SECS,
            None,
        )
        .await
        .unwrap();
        assert!(res.passed);
        assert_eq!(res.exit_code, 0);
        assert!(res.output.contains("orca-cli-ok"));
    }

    #[tokio::test]
    async fn aborts_running_command_when_cancel_fires() {
        let dir = std::env::temp_dir();
        let (tx, rx) = watch::channel(false);
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(80)).await;
            let _ = tx.send(true);
        });
        let long_cmd = if cfg!(windows) {
            "ping -n 10 127.0.0.1 >nul"
        } else {
            "sleep 10"
        };
        let err = run_workflow_command_with_cancel(dir.to_str().unwrap(), long_cmd, None, 60, Some(rx))
            .await
            .unwrap_err();
        assert_eq!(err, "验收命令已中止");
    }
}
