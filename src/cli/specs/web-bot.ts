import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli/cli-argument-boundary'
import type { CommandSpec } from '../discovery/command-spec'

export const WEB_BOT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['web-bot', 'list'],
    summary: 'List Web Bot accounts and external agents bridged by Orca Tauri',
    usage: 'orca web-bot list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Requires the Orca Tauri desktop window to be running with Web Bots enabled.',
      'Shows alias, provider:uuid, kind (web/api/cli), auth state, quota, and optional linked SSH host.'
    ]
  },
  {
    path: ['web-bot', 'ask'],
    summary: 'Send a prompt to a Web Bot account or external API/CLI agent and wait for its reply',
    usage:
      'orca web-bot ask --target <provider:uuid|alias|@provider> (--prompt <text> | --prompt-file <path|->) [--timeout <seconds>] [--new-chat] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'target', 'prompt', 'prompt-file', 'timeout', 'new-chat'],
    notes: [
      'Pass --target as provider:uuid, account alias, or @provider (for example @muse) to pick the lowest-quota non-cooldown account.',
      'Use --prompt-file - to pipe stdin (e.g. git diff | orca web-bot ask --target @muse --prompt-file -).'
    ]
  },
  {
    path: ['web-bot', 'cancel'],
    summary: 'Cancel a pending CLI request or active Web Bot member request',
    usage:
      'orca web-bot cancel [--request-id <id>] [--target <provider:uuid|alias|@provider>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'request-id', 'target']
  }
]
