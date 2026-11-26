use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{watch, Mutex};

use crate::web_bots::external_transport::{
    run_local_cli, run_openai_stream, ExternalTransportError,
};
use crate::web_bots::providers::{resolve_provider_spec, CustomWebProviderRecord};
use crate::web_bots::site_adapters::resolve_adapter_for_host;
use crate::web_bots::storage::{
    build_snapshot, new_uuid_v4, now_ms, save_state, AccountKey, AccountRecord, AuthState,
    ExternalAgentKind, ExternalAgentRecord, GroupAcceptanceConfig, GroupChatMessage,
    GroupChatRecord, GroupReplyStatus, GroupThreadBinding, GroupWorkflowMode,
    WebBotsPersistedState,
};
use crate::web_bots::webview_manager::{
    send_and_collect_web_bot_reply, WebBotReplyError, WebBotWebviewManager,
};
use crate::workflow_command::run_workflow_command_with_cancel;

pub const EVENT_WEB_BOTS_STATE: &str = "web-bots:state-changed";

pub struct WebBotsRuntimeInner {
    pub state_path: PathBuf,
    pub adapter_dir: PathBuf,
    pub persisted: WebBotsPersistedState,
    pub webviews: WebBotWebviewManager,
    pub account_errors: HashMap<String, String>,
    pub room_threads: HashMap<String, String>,
    pub group_cancels: HashMap<String, watch::Sender<bool>>,
    pub member_cancels: HashMap<String, watch::Sender<bool>>,
}

pub fn normalize_acceptance_config(
    config: Option<GroupAcceptanceConfig>,
) -> Result<Option<GroupAcceptanceConfig>, String> {
    let Some(mut cfg) = config else {
        return Ok(None);
    };
    cfg.command = cfg.command.trim().to_string();
    cfg.workdir = cfg.workdir.trim().to_string();
    if cfg.command.is_empty() {
        return Ok(None);
    }
    if cfg.workdir.is_empty() {
        return Err("请填写验收命令的工作目录".to_string());
    }
    cfg.shell = cfg
        .shell
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "auto")
        .map(ToOwned::to_owned);
    cfg.max_auto_fix_rounds = cfg.max_auto_fix_rounds.clamp(1, 5);
    cfg.timeout_secs = cfg.timeout_secs.clamp(5, 1800);
    Ok(Some(cfg))
}

async fn watch_member_or_group_cancel(
    mut group_rx: watch::Receiver<bool>,
    mut member_rx: watch::Receiver<bool>,
) -> watch::Receiver<bool> {
    let (tx, rx) = watch::channel(*group_rx.borrow() || *member_rx.borrow());
    if !*rx.borrow() {
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    res = group_rx.changed() => {
                        if *group_rx.borrow() {
                            let _ = tx.send(true);
                            break;
                        }
                        if res.is_err() {
                            break;
                        }
                    }
                    res = member_rx.changed() => {
                        if *member_rx.borrow() {
                            let _ = tx.send(true);
                            break;
                        }
                        if res.is_err() {
                            break;
                        }
                    }
                }
            }
        });
    }
    rx
}

pub fn register_group_cancel_channel(
    inner: &mut WebBotsRuntimeInner,
    group_id: &str,
) -> watch::Receiver<bool> {
    if let Some(prev) = inner.group_cancels.insert(group_id.to_string(), watch::channel(false).0) {
        let _ = prev.send(true);
    }
    let (tx, rx) = watch::channel(false);
    inner.group_cancels.insert(group_id.to_string(), tx);
    rx
}

pub fn register_member_cancel_channel(
    inner: &mut WebBotsRuntimeInner,
    composite_key: &str,
) -> watch::Receiver<bool> {
    if let Some(prev) = inner.member_cancels.remove(composite_key) {
        let _ = prev.send(true);
    }
    let (tx, rx) = watch::channel(false);
    inner.member_cancels.insert(composite_key.to_string(), tx);
    rx
}

impl WebBotsRuntimeInner {
    pub fn emit_snapshot(&self, app: &AppHandle) {
        let warm = self.webviews.warm_accounts();
        let snap = build_snapshot(&self.persisted, warm, &self.account_errors);
        let _ = app.emit(EVENT_WEB_BOTS_STATE, snap);
    }

    pub fn save_and_emit(&self, app: &AppHandle) {
        let _ = save_state(&self.state_path, &self.persisted);
        self.emit_snapshot(app);
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedRouting {
    pub targets: Vec<AccountKey>,
    pub channel_by_member: HashMap<AccountKey, String>,
}

pub fn member_display_name(
    key: &AccountKey,
    accounts: &[AccountRecord],
    external_agents: &[ExternalAgentRecord],
) -> String {
    if let Some(ext) = external_agents.iter().find(|e| e.account_key() == *key) {
        return ext.name.clone();
    }
    if let Some(acc) = accounts.iter().find(|a| a.key() == *key) {
        return acc.alias.clone();
    }
    format!("{}:{}", key.provider_id, &key.uuid[..key.uuid.len().min(6)])
}

pub fn select_best_account_for_provider(
    provider_id: &str,
    members: &[AccountKey],
    accounts: &[AccountRecord],
    now: u64,
) -> Option<AccountKey> {
    let mut candidates: Vec<&AccountRecord> = members
        .iter()
        .filter(|m| m.provider_id.eq_ignore_ascii_case(provider_id))
        .filter_map(|m| accounts.iter().find(|a| a.key() == *m))
        .collect();
    if candidates.is_empty() {
        return None;
    }
    let non_cooldown: Vec<&AccountRecord> = candidates
        .iter()
        .copied()
        .filter(|a| a.cooldown_until_ms.unwrap_or(0) <= now)
        .collect();
    if !non_cooldown.is_empty() {
        candidates = non_cooldown;
    }
    candidates.sort_by(|a, b| {
        let qa = a.quota_percent.unwrap_or(0.0);
        let qb = b.quota_percent.unwrap_or(0.0);
        qa.partial_cmp(&qb)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.last_used_at_ms.unwrap_or(0).cmp(&b.last_used_at_ms.unwrap_or(0)))
    });
    candidates.first().map(|a| a.key())
}

pub fn parse_mentions(
    content: &str,
    members: &[AccountKey],
    accounts: &[AccountRecord],
    external_agents: &[ExternalAgentRecord],
    custom_providers: &[CustomWebProviderRecord],
    now: u64,
) -> ResolvedRouting {
    let mut targets = Vec::new();
    let mut seen = HashSet::new();
    let mut channel_by_member = HashMap::new();

    let mut mention_all = false;
    for token in content.split_whitespace() {
        let clean = token
            .trim_start_matches('@')
            .trim_end_matches(|c: char| !c.is_alphanumeric() && c != '_' && c != '-');
        if !token.starts_with('@') || clean.is_empty() {
            continue;
        }
        if clean.eq_ignore_ascii_case("all") || clean == "全体" {
            mention_all = true;
            break;
        }
        // 1. Exact member display name match
        if let Some(member) = members.iter().find(|m| {
            member_display_name(m, accounts, external_agents).eq_ignore_ascii_case(clean)
        }) {
            if seen.insert(member.clone()) {
                targets.push(member.clone());
            }
            continue;
        }
        // 2. Provider / channel match (e.g. @muse, @hark, @api, @cli, @custom_cue)
        let lower = clean.to_ascii_lowercase();
        let is_provider = lower == "api"
            || lower == "cli"
            || resolve_provider_spec(&lower, custom_providers).is_some()
            || members
                .iter()
                .any(|m| m.provider_id.eq_ignore_ascii_case(&lower));
        if is_provider {
            if lower == "api" || lower == "cli" {
                if let Some(member) = members.iter().find(|m| m.provider_id == lower) {
                    if seen.insert(member.clone()) {
                        targets.push(member.clone());
                        channel_by_member.insert(member.clone(), lower);
                    }
                }
            } else if let Some(best) =
                select_best_account_for_provider(&lower, members, accounts, now)
            {
                if seen.insert(best.clone()) {
                    targets.push(best.clone());
                    channel_by_member.insert(best, lower);
                }
            }
        }
    }

    if mention_all || targets.is_empty() {
        targets = members.to_vec();
    }

    ResolvedRouting {
        targets,
        channel_by_member,
    }
}

pub fn compose_member_prompt(
    group: &GroupChatRecord,
    member: &AccountKey,
    user_content: &str,
    prior_stage_outputs: &[(String, String)],
    accounts: &[AccountRecord],
    external_agents: &[ExternalAgentRecord],
) -> String {
    let mut parts = Vec::new();
    let display_name = member_display_name(member, accounts, external_agents);
    parts.push(format!(
        "你是群聊「{}」的成员「{}」。请直接给出清晰、可执行的回复。",
        group.name, display_name
    ));

    if let Some(role) = group
        .member_roles
        .iter()
        .find(|r| r.member == *member && !r.role.trim().is_empty())
    {
        parts.push(format!("【你的角色设定】\n{}", role.role.trim()));
    }
    if !group.shared_context.trim().is_empty() {
        parts.push(format!("【共享上下文】\n{}", group.shared_context.trim()));
    }
    let enabled_skills: Vec<&crate::web_bots::storage::GroupSharedSkill> = group
        .shared_skills
        .iter()
        .filter(|s| s.enabled && !s.content.trim().is_empty())
        .collect();
    if !enabled_skills.is_empty() {
        let skill_text: Vec<String> = enabled_skills
            .into_iter()
            .map(|s| format!("- {}: {}", s.name, s.content.trim()))
            .collect();
        parts.push(format!("【共享技能规范】\n{}", skill_text.join("\n")));
    }

    // Include last 6 completed messages as brief context.
    let history: Vec<String> = group
        .messages
        .iter()
        .filter(|m| m.status == GroupReplyStatus::Done && !m.content.trim().is_empty())
        .rev()
        .take(6)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(|m| format!("{}: {}", m.sender_name, m.content.trim()))
        .collect();
    if !history.is_empty() {
        parts.push(format!("【最近对话】\n{}", history.join("\n\n")));
    }

    if !prior_stage_outputs.is_empty() {
        let stage_lines: Vec<String> = prior_stage_outputs
            .iter()
            .map(|(who, text)| format!("[{who} 的输出]\n{text}"))
            .collect();
        parts.push(format!("【上一环节输出】\n{}", stage_lines.join("\n\n")));
    }

    parts.push(format!("【当前请求】\n{}", user_content.trim()));
    parts.join("\n\n")
}

async fn execute_single_reply(
    app: AppHandle,
    runtime: Arc<Mutex<WebBotsRuntimeInner>>,
    group_id: String,
    reply_msg_id: String,
    member: AccountKey,
    prompt: String,
    group_cancel_rx: watch::Receiver<bool>,
) -> Result<String, String> {
    if *group_cancel_rx.borrow() {
        return Err("已手动中止".to_string());
    }
    let member_rx = {
        let mut guard = runtime.lock().await;
        if let Some(group) = guard
            .persisted
            .group_chats
            .iter_mut()
            .find(|g| g.id == group_id)
        {
            if let Some(msg) = group.messages.iter_mut().find(|m| m.id == reply_msg_id) {
                msg.status = GroupReplyStatus::Sending;
                msg.error = None;
            }
        }
        guard.save_and_emit(&app);
        register_member_cancel_channel(&mut guard, &member.composite_key())
    };
    let cancel_rx = watch_member_or_group_cancel(group_cancel_rx, member_rx).await;

    // Decide whether this is an external agent or a Web Bot account.
    enum TargetKind {
        External(ExternalAgentRecord),
        Web {
            account: AccountRecord,
            entry_url: String,
            thread_url: Option<String>,
            adapter_dir: PathBuf,
        },
    }

    let target = {
        let mut guard = runtime.lock().await;
        if let Some(ext) = guard
            .persisted
            .external_agents
            .iter()
            .find(|e| e.account_key() == member)
            .cloned()
        {
            TargetKind::External(ext)
        } else {
            let acc = guard
                .persisted
                .accounts
                .iter()
                .find(|a| a.key() == member)
                .cloned()
                .ok_or_else(|| "未找到目标成员账号".to_string())?;
            let spec = resolve_provider_spec(&acc.provider_id, &guard.persisted.custom_providers)
                .ok_or_else(|| format!("未知服务提供商: {}", acc.provider_id))?;
            let thread_url = guard
                .persisted
                .group_chats
                .iter()
                .find(|g| g.id == group_id)
                .and_then(|g| {
                    g.thread_bindings
                        .iter()
                        .find(|b| b.member == member)
                        .map(|b| b.thread_url.clone())
                });
            let adapter_dir = guard.adapter_dir.clone();
            // Ensure WebView exists without showing it if hidden.
            let _ = guard
                .webviews
                .ensure_webview(&app, &acc, &spec.info.entry_url, false)?;
            TargetKind::Web {
                account: acc,
                entry_url: spec.info.entry_url,
                thread_url,
                adapter_dir,
            }
        }
    };

    let app_for_prog = app.clone();
    let rt_for_prog = Arc::clone(&runtime);
    let gid_for_prog = group_id.clone();
    let mid_for_prog = reply_msg_id.clone();

    let update_streaming = move |partial: String| {
        let app_c = app_for_prog.clone();
        let rt_c = Arc::clone(&rt_for_prog);
        let gid = gid_for_prog.clone();
        let mid = mid_for_prog.clone();
        tokio::spawn(async move {
            let mut guard = rt_c.lock().await;
            if let Some(group) = guard.persisted.group_chats.iter_mut().find(|g| g.id == gid) {
                if let Some(msg) = group.messages.iter_mut().find(|m| m.id == mid) {
                    msg.status = GroupReplyStatus::Streaming;
                    msg.content = partial;
                }
            }
            guard.emit_snapshot(&app_c);
        });
    };

    let outcome: Result<(String, Option<String>), (GroupReplyStatus, String)> = match target {
        TargetKind::External(ext) => {
            let res = match ext.kind {
                ExternalAgentKind::OpenaiApi => {
                    run_openai_stream(&ext, &prompt, cancel_rx.clone(), update_streaming).await
                }
                ExternalAgentKind::LocalCli => {
                    run_local_cli(&ext, &prompt, cancel_rx.clone(), update_streaming).await
                }
            };
            res.map(|text| (text, None)).map_err(|err| match err {
                ExternalTransportError::Cancelled => {
                    (GroupReplyStatus::Cancelled, "已手动中止".to_string())
                }
                ExternalTransportError::Other(msg) => (GroupReplyStatus::Error, msg),
            })
        }
        TargetKind::Web {
            account,
            entry_url,
            thread_url,
            adapter_dir,
        } => {
            let webview_res = {
                let guard = runtime.lock().await;
                guard
                    .webviews
                    .get_webview(&app, &account.key())
                    .ok_or_else(|| "目标 WebView 已关闭".to_string())
            };
            match webview_res {
                Err(e) => Err((GroupReplyStatus::Error, e)),
                Ok(webview) => {
                    let host = url::Url::parse(&entry_url)
                        .ok()
                        .and_then(|u| u.host_str().map(ToOwned::to_owned))
                        .unwrap_or_default();
                    let adapter = resolve_adapter_for_host(&adapter_dir, &host);

                    match send_and_collect_web_bot_reply(
                        &webview,
                        &adapter,
                        &prompt,
                        thread_url.as_deref(),
                        cancel_rx,
                        update_streaming,
                    )
                    .await
                    {
                        Ok(ok) => Ok(ok),
                        Err(WebBotReplyError::NeedsAuth(msg)) => {
                            Err((GroupReplyStatus::NeedsAuth, msg))
                        }
                        Err(WebBotReplyError::Cancelled) => {
                            Err((GroupReplyStatus::Cancelled, "已手动中止".to_string()))
                        }
                        Err(WebBotReplyError::Other(msg)) => Err((GroupReplyStatus::Error, msg)),
                    }
                }
            }
        }
    };

    let now = now_ms();
    let mut guard = runtime.lock().await;
    match outcome {
        Ok((reply_text, new_thread_url)) => {
            if let Some(acc) = guard
                .persisted
                .accounts
                .iter_mut()
                .find(|a| a.key() == member)
            {
                acc.last_used_at_ms = Some(now);
                acc.cooldown_until_ms = None;
                acc.auth_state = AuthState::Authenticated;
            }
            if let Some(group) = guard
                .persisted
                .group_chats
                .iter_mut()
                .find(|g| g.id == group_id)
            {
                if let Some(msg) = group.messages.iter_mut().find(|m| m.id == reply_msg_id) {
                    msg.status = GroupReplyStatus::Done;
                    msg.content = reply_text.clone();
                    msg.error = None;
                }
                if let Some(url) = new_thread_url {
                    if let Some(binding) = group
                        .thread_bindings
                        .iter_mut()
                        .find(|b| b.member == member)
                    {
                        binding.thread_url = url;
                        binding.updated_at_ms = now;
                    } else {
                        group.thread_bindings.push(GroupThreadBinding {
                            member: member.clone(),
                            thread_url: url,
                            updated_at_ms: now,
                        });
                    }
                }
            }
            guard.save_and_emit(&app);
            Ok(reply_text)
        }
        Err((status, err_msg)) => {
            if status != GroupReplyStatus::Cancelled {
                if let Some(acc) = guard
                    .persisted
                    .accounts
                    .iter_mut()
                    .find(|a| a.key() == member)
                {
                    acc.cooldown_until_ms = Some(now + 60_000);
                    if status == GroupReplyStatus::NeedsAuth {
                        acc.auth_state = AuthState::LoggedOut;
                    }
                }
            }
            if let Some(group) = guard
                .persisted
                .group_chats
                .iter_mut()
                .find(|g| g.id == group_id)
            {
                if let Some(msg) = group.messages.iter_mut().find(|m| m.id == reply_msg_id) {
                    msg.status = status;
                    msg.error = Some(err_msg.clone());
                }
            }
            guard.save_and_emit(&app);
            Err(err_msg)
        }
    }
}

pub async fn dispatch_group_message(
    app: AppHandle,
    runtime: Arc<Mutex<WebBotsRuntimeInner>>,
    group_id: String,
    user_content: String,
) -> Result<(), String> {
    let trimmed = user_content.trim().to_string();
    if trimmed.is_empty() {
        return Err("消息内容不能为空".to_string());
    }
    let now = now_ms();

    let (group_snapshot, routing, reply_ids, accounts, external_agents, custom_providers, cancel_rx) = {
        let mut guard = runtime.lock().await;
        let group = guard
            .persisted
            .group_chats
            .iter()
            .find(|g| g.id == group_id)
            .cloned()
            .ok_or_else(|| "未找到目标群聊".to_string())?;
        if group.members.is_empty() {
            return Err("群聊尚未添加成员".to_string());
        }
        let routing = parse_mentions(
            &trimmed,
            &group.members,
            &guard.persisted.accounts,
            &guard.persisted.external_agents,
            &guard.persisted.custom_providers,
            now,
        );
        let user_msg = GroupChatMessage {
            id: new_uuid_v4(),
            role: "user".to_string(),
            sender: None,
            sender_name: "你".to_string(),
            content: trimmed.clone(),
            created_at_ms: now,
            status: GroupReplyStatus::Done,
            targets: routing.targets.clone(),
            error: None,
            stage_label: None,
            hop_depth: None,
            auto_routed_channel: None,
        };

        let mut reply_ids = Vec::with_capacity(routing.targets.len());
        let mut placeholders = Vec::with_capacity(routing.targets.len());
        for (idx, target) in routing.targets.iter().enumerate() {
            let reply_id = new_uuid_v4();
            let sender_name = member_display_name(
                target,
                &guard.persisted.accounts,
                &guard.persisted.external_agents,
            );
            let stage_label = match group.workflow_mode {
                GroupWorkflowMode::Parallel => None,
                GroupWorkflowMode::Review => Some(if idx == 0 {
                    "初稿".to_string()
                } else {
                    format!("评审第 {} 轮", idx)
                }),
                GroupWorkflowMode::A2aRelay => Some("接力起点".to_string()),
            };
            placeholders.push(GroupChatMessage {
                id: reply_id.clone(),
                role: "assistant".to_string(),
                sender: Some(target.clone()),
                sender_name,
                content: String::new(),
                created_at_ms: now + (idx as u64) + 1,
                status: GroupReplyStatus::Queued,
                targets: Vec::new(),
                error: None,
                stage_label,
                hop_depth: Some(0),
                auto_routed_channel: routing.channel_by_member.get(target).cloned(),
            });
            reply_ids.push(reply_id);
        }

        if let Some(g_mut) = guard
            .persisted
            .group_chats
            .iter_mut()
            .find(|g| g.id == group_id)
        {
            g_mut.messages.push(user_msg);
            g_mut.messages.extend(placeholders);
        }
        let cancel_rx = register_group_cancel_channel(&mut guard, &group_id);
        guard.save_and_emit(&app);
        (
            group,
            routing,
            reply_ids,
            guard.persisted.accounts.clone(),
            guard.persisted.external_agents.clone(),
            guard.persisted.custom_providers.clone(),
            cancel_rx,
        )
    };

    tokio::spawn(async move {
        let mut had_success = false;
        match group_snapshot.workflow_mode {
            GroupWorkflowMode::Parallel => {
                let mut handles = Vec::new();
                for (target, reply_id) in routing.targets.into_iter().zip(reply_ids.into_iter()) {
                    let prompt = compose_member_prompt(
                        &group_snapshot,
                        &target,
                        &trimmed,
                        &[],
                        &accounts,
                        &external_agents,
                    );
                    let app_c = app.clone();
                    let rt_c = Arc::clone(&runtime);
                    let gid = group_id.clone();
                    let rx = cancel_rx.clone();
                    handles.push(tokio::spawn(async move {
                        execute_single_reply(app_c, rt_c, gid, reply_id, target, prompt, rx)
                            .await
                            .is_ok()
                    }));
                }
                for h in handles {
                    if h.await.unwrap_or(false) {
                        had_success = true;
                    }
                }
            }
            GroupWorkflowMode::Review => {
                let mut prior: Vec<(String, String)> = Vec::new();
                for (target, reply_id) in routing.targets.into_iter().zip(reply_ids.into_iter()) {
                    if *cancel_rx.borrow() {
                        break;
                    }
                    let prompt = compose_member_prompt(
                        &group_snapshot,
                        &target,
                        &trimmed,
                        &prior,
                        &accounts,
                        &external_agents,
                    );
                    let name = member_display_name(&target, &accounts, &external_agents);
                    if let Ok(output) = execute_single_reply(
                        app.clone(),
                        Arc::clone(&runtime),
                        group_id.clone(),
                        reply_id,
                        target,
                        prompt,
                        cancel_rx.clone(),
                    )
                    .await
                    {
                        had_success = true;
                        prior.push((name, output));
                    }
                }
            }
            GroupWorkflowMode::A2aRelay => {
                let max_hops = group_snapshot.max_relay_hops.clamp(1, 6);
                let mut prior: Vec<(String, String)> = Vec::new();
                let mut current_targets = routing.targets;
                let mut current_reply_ids = reply_ids;
                let mut hop = 0u32;

                loop {
                    if *cancel_rx.borrow() {
                        break;
                    }
                    let mut last_sender: Option<AccountKey> = None;
                    let mut last_output = String::new();
                    for (target, reply_id) in
                        current_targets.into_iter().zip(current_reply_ids.into_iter())
                    {
                        if *cancel_rx.borrow() {
                            break;
                        }
                        let prompt = compose_member_prompt(
                            &group_snapshot,
                            &target,
                            &trimmed,
                            &prior,
                            &accounts,
                            &external_agents,
                        );
                        let name = member_display_name(&target, &accounts, &external_agents);
                        if let Ok(output) = execute_single_reply(
                            app.clone(),
                            Arc::clone(&runtime),
                            group_id.clone(),
                            reply_id,
                            target.clone(),
                            prompt,
                            cancel_rx.clone(),
                        )
                        .await
                        {
                            had_success = true;
                            prior.push((name, output.clone()));
                            last_sender = Some(target);
                            last_output = output;
                        }
                    }

                    hop += 1;
                    if *cancel_rx.borrow() || hop >= max_hops || last_output.trim().is_empty() {
                        break;
                    }
                    let next_routing = parse_mentions(
                        &last_output,
                        &group_snapshot.members,
                        &accounts,
                        &external_agents,
                        &custom_providers,
                        now_ms(),
                    );
                    if !last_output.contains('@') {
                        break;
                    }
                    let next_targets: Vec<AccountKey> = next_routing
                        .targets
                        .into_iter()
                        .filter(|t| Some(t) != last_sender.as_ref())
                        .collect();
                    if next_targets.is_empty() {
                        break;
                    }

                    let mut next_ids = Vec::with_capacity(next_targets.len());
                    {
                        let mut guard = runtime.lock().await;
                        let ts = now_ms();
                        if let Some(g_mut) = guard
                            .persisted
                            .group_chats
                            .iter_mut()
                            .find(|g| g.id == group_id)
                        {
                            for (idx, t) in next_targets.iter().enumerate() {
                                let rid = new_uuid_v4();
                                g_mut.messages.push(GroupChatMessage {
                                    id: rid.clone(),
                                    role: "assistant".to_string(),
                                    sender: Some(t.clone()),
                                    sender_name: member_display_name(
                                        t,
                                        &accounts,
                                        &external_agents,
                                    ),
                                    content: String::new(),
                                    created_at_ms: ts + (idx as u64),
                                    status: GroupReplyStatus::Queued,
                                    targets: Vec::new(),
                                    error: None,
                                    stage_label: Some(format!("接力第 {hop} 跳")),
                                    hop_depth: Some(hop),
                                    auto_routed_channel: next_routing
                                        .channel_by_member
                                        .get(t)
                                        .cloned(),
                                });
                                next_ids.push(rid);
                            }
                        }
                        guard.save_and_emit(&app);
                    }
                    current_targets = next_targets;
                    current_reply_ids = next_ids;
                }
            }
        }

        if had_success
            && !*cancel_rx.borrow()
            && group_snapshot
                .acceptance
                .as_ref()
                .is_some_and(|a| a.auto_run_on_reply && !a.command.trim().is_empty())
        {
            let _ = run_group_acceptance_with_rx(app, runtime, group_id, true, 0, cancel_rx).await;
        }
    });

    Ok(())
}

pub async fn retry_single_group_message(
    app: AppHandle,
    runtime: Arc<Mutex<WebBotsRuntimeInner>>,
    group_id: String,
    message_id: String,
) -> Result<(), String> {
    let (group_snapshot, target, prompt, cancel_rx) = {
        let mut guard = runtime.lock().await;
        let group = guard
            .persisted
            .group_chats
            .iter()
            .find(|g| g.id == group_id)
            .cloned()
            .ok_or_else(|| "未找到目标群聊".to_string())?;
        let msg_idx = group
            .messages
            .iter()
            .position(|m| m.id == message_id)
            .ok_or_else(|| "未找到需要重试的消息".to_string())?;
        let target = group.messages[msg_idx]
            .sender
            .clone()
            .ok_or_else(|| "仅支持重试助手回复消息".to_string())?;
        let user_prompt = group.messages[..msg_idx]
            .iter()
            .rev()
            .find(|m| m.role == "user")
            .map(|m| m.content.clone())
            .unwrap_or_default();

        if let Some(g_mut) = guard
            .persisted
            .group_chats
            .iter_mut()
            .find(|g| g.id == group_id)
        {
            if let Some(m_mut) = g_mut.messages.iter_mut().find(|m| m.id == message_id) {
                m_mut.status = GroupReplyStatus::Queued;
                m_mut.error = None;
                m_mut.content.clear();
            }
        }
        let cancel_rx = register_group_cancel_channel(&mut guard, &group_id);
        guard.save_and_emit(&app);

        let prompt = compose_member_prompt(
            &group,
            &target,
            &user_prompt,
            &[],
            &guard.persisted.accounts,
            &guard.persisted.external_agents,
        );
        (group, target, prompt, cancel_rx)
    };
    let _ = group_snapshot;

    tokio::spawn(async move {
        let _ =
            execute_single_reply(app, runtime, group_id, message_id, target, prompt, cancel_rx)
                .await;
    });
    Ok(())
}

pub async fn cancel_group_execution(
    app: &AppHandle,
    runtime: &Arc<Mutex<WebBotsRuntimeInner>>,
    group_id: &str,
) -> Result<(), String> {
    let mut guard = runtime.lock().await;
    if let Some(tx) = guard.group_cancels.remove(group_id) {
        let _ = tx.send(true);
    }
    let group = guard
        .persisted
        .group_chats
        .iter_mut()
        .find(|g| g.id == group_id)
        .ok_or_else(|| "未找到目标群聊".to_string())?;
    for msg in &mut group.messages {
        if matches!(
            msg.status,
            GroupReplyStatus::Queued | GroupReplyStatus::Sending | GroupReplyStatus::Streaming
        ) {
            msg.status = GroupReplyStatus::Cancelled;
            if msg.error.is_none() {
                msg.error = Some("已手动中止".to_string());
            }
        }
    }
    guard.save_and_emit(app);
    Ok(())
}

pub async fn cancel_member_execution(
    runtime: &Arc<Mutex<WebBotsRuntimeInner>>,
    provider_id: &str,
    uuid: &str,
) {
    let composite = format!("{provider_id}:{uuid}");
    let mut guard = runtime.lock().await;
    if let Some(tx) = guard.member_cancels.remove(&composite) {
        let _ = tx.send(true);
    }
}

pub async fn run_group_acceptance_with_rx(
    app: AppHandle,
    runtime: Arc<Mutex<WebBotsRuntimeInner>>,
    group_id: String,
    trigger_auto_fix: bool,
    initial_fix_round: u32,
    cancel_rx: watch::Receiver<bool>,
) -> Result<(), String> {
    let mut fix_round = initial_fix_round;
    loop {
        if *cancel_rx.borrow() {
            return Ok(());
        }
        let (cfg, msg_id, last_speaker, group_snapshot, accounts, external_agents) = {
            let mut guard = runtime.lock().await;
            let group = guard
                .persisted
                .group_chats
                .iter()
                .find(|g| g.id == group_id)
                .cloned()
                .ok_or_else(|| "未找到目标群聊".to_string())?;
            let cfg = group
                .acceptance
                .clone()
                .filter(|a| !a.command.trim().is_empty())
                .ok_or_else(|| "当前群聊未配置本机验收命令".to_string())?;
            let msg_id = new_uuid_v4();
            let last_speaker = group
                .messages
                .iter()
                .rev()
                .find(|m| m.role == "assistant" && m.status == GroupReplyStatus::Done)
                .and_then(|m| m.sender.clone())
                .or_else(|| group.members.first().cloned());
            let verification_msg = GroupChatMessage {
                id: msg_id.clone(),
                role: "verification".to_string(),
                sender: None,
                sender_name: "本机验收".to_string(),
                content: format!("工作目录: {}\n执行命令: {}", cfg.workdir, cfg.command),
                created_at_ms: now_ms(),
                status: GroupReplyStatus::Sending,
                targets: Vec::new(),
                error: None,
                stage_label: Some(if fix_round > 0 {
                    format!("第 {fix_round} 次复验中")
                } else {
                    "验收中".to_string()
                }),
                hop_depth: None,
                auto_routed_channel: None,
            };
            if let Some(g_mut) = guard
                .persisted
                .group_chats
                .iter_mut()
                .find(|g| g.id == group_id)
            {
                g_mut.messages.push(verification_msg);
            }
            guard.save_and_emit(&app);
            (
                cfg,
                msg_id,
                last_speaker,
                group,
                guard.persisted.accounts.clone(),
                guard.persisted.external_agents.clone(),
            )
        };

        let outcome = run_workflow_command_with_cancel(
            &cfg.workdir,
            &cfg.command,
            cfg.shell.as_deref(),
            cfg.timeout_secs,
            Some(cancel_rx.clone()),
        )
        .await;

        let (passed, output_text) = {
            let mut guard = runtime.lock().await;
            let mut did_pass = false;
            let mut body_text = String::new();
            if let Some(g_mut) = guard
                .persisted
                .group_chats
                .iter_mut()
                .find(|g| g.id == group_id)
            {
                if let Some(m_mut) = g_mut.messages.iter_mut().find(|m| m.id == msg_id) {
                    match &outcome {
                        Ok(res) if res.passed => {
                            did_pass = true;
                            m_mut.status = GroupReplyStatus::Done;
                            m_mut.stage_label = Some("验收通过".to_string());
                            m_mut.error = None;
                            body_text = if res.output.trim().is_empty() {
                                format!("命令 `{}` 通过（退出码 0）。", cfg.command)
                            } else {
                                format!("命令 `{}` 通过（退出码 0）：\n\n{}", cfg.command, res.output)
                            };
                            m_mut.content = body_text.clone();
                        }
                        Ok(res) => {
                            m_mut.status = GroupReplyStatus::Error;
                            m_mut.stage_label = Some("验收失败".to_string());
                            m_mut.error = Some(format!("退出码 {}", res.exit_code));
                            body_text = if res.output.trim().is_empty() {
                                format!("命令 `{}` 未通过（退出码 {}）。", cfg.command, res.exit_code)
                            } else {
                                format!(
                                    "命令 `{}` 未通过（退出码 {}）：\n\n{}",
                                    cfg.command, res.exit_code, res.output
                                )
                            };
                            m_mut.content = body_text.clone();
                        }
                        Err(err) => {
                            m_mut.status = if *cancel_rx.borrow() {
                                GroupReplyStatus::Cancelled
                            } else {
                                GroupReplyStatus::Error
                            };
                            m_mut.stage_label = Some(if *cancel_rx.borrow() {
                                "验收已中止".to_string()
                            } else {
                                "验收异常".to_string()
                            });
                            m_mut.error = Some(err.clone());
                            body_text = err.clone();
                        }
                    }
                }
            }
            guard.save_and_emit(&app);
            (did_pass, body_text)
        };

        if passed
            || !trigger_auto_fix
            || *cancel_rx.borrow()
            || fix_round >= cfg.max_auto_fix_rounds.clamp(1, 5)
        {
            return Ok(());
        }
        let Some(target) = last_speaker else {
            return Ok(());
        };

        fix_round += 1;
        let reply_id = new_uuid_v4();
        let fix_instruction = format!(
            "本机可信验收未通过，请根据以下检查输出修复并给出修改说明：\n\n{}",
            output_text
        );
        let prompt = compose_member_prompt(
            &group_snapshot,
            &target,
            &fix_instruction,
            &[],
            &accounts,
            &external_agents,
        );
        let sender_name = member_display_name(&target, &accounts, &external_agents);
        {
            let mut guard = runtime.lock().await;
            if let Some(g_mut) = guard
                .persisted
                .group_chats
                .iter_mut()
                .find(|g| g.id == group_id)
            {
                g_mut.messages.push(GroupChatMessage {
                    id: reply_id.clone(),
                    role: "assistant".to_string(),
                    sender: Some(target.clone()),
                    sender_name,
                    content: String::new(),
                    created_at_ms: now_ms(),
                    status: GroupReplyStatus::Queued,
                    targets: Vec::new(),
                    error: None,
                    stage_label: Some(format!("自动修复第 {fix_round} 轮")),
                    hop_depth: None,
                    auto_routed_channel: None,
                });
            }
            guard.save_and_emit(&app);
        }

        if execute_single_reply(
            app.clone(),
            Arc::clone(&runtime),
            group_id.clone(),
            reply_id,
            target,
            prompt,
            cancel_rx.clone(),
        )
        .await
        .is_err()
        {
            return Ok(());
        }
    }
}

pub async fn start_group_acceptance(
    app: AppHandle,
    runtime: Arc<Mutex<WebBotsRuntimeInner>>,
    group_id: String,
) -> Result<(), String> {
    let cancel_rx = {
        let mut guard = runtime.lock().await;
        let group = guard
            .persisted
            .group_chats
            .iter()
            .find(|g| g.id == group_id)
            .ok_or_else(|| "未找到目标群聊".to_string())?;
        if !group
            .acceptance
            .as_ref()
            .is_some_and(|a| !a.command.trim().is_empty())
        {
            return Err("当前群聊尚未配置验收命令".to_string());
        }
        register_group_cancel_channel(&mut guard, &group_id)
    };
    tokio::spawn(async move {
        let _ = run_group_acceptance_with_rx(app, runtime, group_id, false, 0, cancel_rx).await;
    });
    Ok(())
}

pub async fn reject_group_for_fix(
    app: AppHandle,
    runtime: Arc<Mutex<WebBotsRuntimeInner>>,
    group_id: String,
    target_member: Option<AccountKey>,
    note: Option<String>,
) -> Result<(), String> {
    let (prompt, target, reply_id, cancel_rx) = {
        let mut guard = runtime.lock().await;
        let group = guard
            .persisted
            .group_chats
            .iter()
            .find(|g| g.id == group_id)
            .cloned()
            .ok_or_else(|| "未找到目标群聊".to_string())?;
        let target = target_member
            .or_else(|| {
                group
                    .messages
                    .iter()
                    .rev()
                    .find(|m| m.role == "assistant")
                    .and_then(|m| m.sender.clone())
            })
            .or_else(|| group.members.first().cloned())
            .ok_or_else(|| "群聊尚未添加成员".to_string())?;
        let latest_verify = group
            .messages
            .iter()
            .rev()
            .find(|m| m.role == "verification")
            .map(|m| m.content.clone())
            .unwrap_or_else(|| "验收未通过".to_string());
        let clean_note = note
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| format!("\n\n补充要求：{s}"))
            .unwrap_or_default();
        let fix_text = format!("请根据本机验收结果打回重做：{clean_note}\n\n{latest_verify}");
        let prompt = compose_member_prompt(
            &group,
            &target,
            &fix_text,
            &[],
            &guard.persisted.accounts,
            &guard.persisted.external_agents,
        );
        let reply_id = new_uuid_v4();
        let sender_name = member_display_name(
            &target,
            &guard.persisted.accounts,
            &guard.persisted.external_agents,
        );
        if let Some(g_mut) = guard
            .persisted
            .group_chats
            .iter_mut()
            .find(|g| g.id == group_id)
        {
            g_mut.messages.push(GroupChatMessage {
                id: reply_id.clone(),
                role: "assistant".to_string(),
                sender: Some(target.clone()),
                sender_name,
                content: String::new(),
                created_at_ms: now_ms(),
                status: GroupReplyStatus::Queued,
                targets: Vec::new(),
                error: None,
                stage_label: Some("打回重做".to_string()),
                hop_depth: None,
                auto_routed_channel: None,
            });
        }
        let cancel_rx = register_group_cancel_channel(&mut guard, &group_id);
        guard.save_and_emit(&app);
        (prompt, target, reply_id, cancel_rx)
    };

    tokio::spawn(async move {
        let _ =
            execute_single_reply(app, runtime, group_id, reply_id, target, prompt, cancel_rx)
                .await;
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        compose_member_prompt, normalize_acceptance_config, parse_mentions,
        select_best_account_for_provider,
    };
    use crate::web_bots::storage::{
        AccountKey, AccountRecord, AuthState, ExternalAgentKind, ExternalAgentRecord,
        GroupAcceptanceConfig, GroupChatRecord, GroupMemberRole, GroupSharedSkill,
        GroupWorkflowMode,
    };

    fn sample_account(provider: &str, uuid: &str, alias: &str, quota: Option<f64>) -> AccountRecord {
        AccountRecord {
            provider_id: provider.to_string(),
            uuid: uuid.to_string(),
            alias: alias.to_string(),
            auto_alias: false,
            email: None,
            created_at_ms: 1,
            proxy_url: None,
            timezone: None,
            avatar_url: None,
            quota_text: None,
            quota_percent: quota,
            quota_detail: None,
            auth_state: AuthState::Authenticated,
            cookie_expires_at_ms: None,
            cookie_session_only: false,
            cooldown_until_ms: None,
            last_used_at_ms: None,
            ssh_host: None,
        }
    }

    #[test]
    fn account_and_acceptance_serde_defaults_preserve_legacy_records() {
        let legacy_acc: AccountRecord = serde_json::from_str(
            r#"{"providerId":"muse","uuid":"u1","alias":"Muse #1","createdAtMs":10}"#,
        )
        .expect("legacy account parses without sshHost");
        assert_eq!(legacy_acc.ssh_host, None);

        let acc = normalize_acceptance_config(Some(GroupAcceptanceConfig {
            command: "  pnpm test  ".to_string(),
            workdir: " D:/repo ".to_string(),
            shell: Some("auto".to_string()),
            auto_run_on_reply: true,
            max_auto_fix_rounds: 99,
            timeout_secs: 2,
        }))
        .expect("normalizes cleanly")
        .expect("some config");
        assert_eq!(acc.command, "pnpm test");
        assert_eq!(acc.workdir, "D:/repo");
        assert_eq!(acc.shell, None);
        assert_eq!(acc.max_auto_fix_rounds, 5);
        assert_eq!(acc.timeout_secs, 5);
    }

    #[test]
    fn mention_routing_and_channel_selection_pick_lowest_quota_non_cooldown() {
        let mut a1 = sample_account("muse", "u1", "MuseA", Some(85.0));
        a1.cooldown_until_ms = Some(999_999);
        let a2 = sample_account("muse", "u2", "MuseB", Some(40.0));
        let ext = ExternalAgentRecord {
            id: "e1".to_string(),
            kind: ExternalAgentKind::OpenaiApi,
            name: "DeepSeek".to_string(),
            base_url: "https://api.deepseek.com/v1".to_string(),
            api_key: String::new(),
            model: "deepseek-chat".to_string(),
            command: String::new(),
            args: vec![],
            workdir: None,
            created_at_ms: 1,
        };
        let members = vec![a1.key(), a2.key(), ext.account_key()];
        let accounts = vec![a1, a2.clone()];

        let best = select_best_account_for_provider("muse", &members, &accounts, 1000).expect("best");
        assert_eq!(best.uuid, "u2");

        let routed = parse_mentions(
            "@muse @DeepSeek 请协作审查",
            &members,
            &accounts,
            &[ext],
            &[],
            1000,
        );
        assert_eq!(routed.targets.len(), 2);
        assert_eq!(routed.targets[0].uuid, "u2");
        assert_eq!(routed.targets[1].uuid, "e1");
    }

    #[test]
    fn prompt_composition_includes_role_context_and_skills() {
        let member = AccountKey {
            provider_id: "muse".to_string(),
            uuid: "u1".to_string(),
        };
        let group = GroupChatRecord {
            id: "g1".to_string(),
            name: "核心评审组".to_string(),
            members: vec![member.clone()],
            created_at_ms: 1,
            messages: vec![],
            shared_context: "这是 Rust Tauri 项目".to_string(),
            shared_skills: vec![GroupSharedSkill {
                id: "s1".to_string(),
                name: "简洁输出".to_string(),
                description: String::new(),
                content: "控制在 200 字以内".to_string(),
                enabled: true,
            }],
            member_roles: vec![GroupMemberRole {
                member: member.clone(),
                role: "架构审查官".to_string(),
            }],
            workflow_mode: GroupWorkflowMode::Review,
            max_relay_hops: 3,
            thread_bindings: vec![],
            acceptance: None,
        };

        let prompt = compose_member_prompt(
            &group,
            &member,
            "检查模块边界",
            &[("初稿".to_string(), "方案 A".to_string())],
            &[sample_account("muse", "u1", "MuseA", None)],
            &[],
        );
        assert!(prompt.contains("架构审查官"));
        assert!(prompt.contains("这是 Rust Tauri 项目"));
        assert!(prompt.contains("控制在 200 字以内"));
        assert!(prompt.contains("方案 A"));
        assert!(prompt.contains("检查模块边界"));
    }
}
