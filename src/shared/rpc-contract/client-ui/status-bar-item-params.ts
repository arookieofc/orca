import * as z from 'zod'

export const StatusBarItem = z.enum([
  'claude',
  'codex',
  'gemini',
  'antigravity',
  'opencode-go',
  'kimi',
  'minimax',
  'grok',
  'cursor',
  'zcode',
  'muse',
  'ssh',
  'resource-usage',
  'ports',
  'git-blame'
])
