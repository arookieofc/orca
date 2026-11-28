import { CLI_GLOBAL_FLAGS as GLOBAL_FLAGS } from '../../shared/cli/cli-argument-boundary'
import type { CommandSpec } from '../discovery/command-spec'

export const NODE_RELAY_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['relay', 'status'],
    summary: 'Show distributed relay broker status, nodes, templates, and active chains',
    usage: 'orca relay status [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['relay', 'templates'],
    summary: 'List customizable distributed relay templates',
    usage: 'orca relay templates [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['relay', 'start'],
    summary: 'Start a customizable multi-node relay chain',
    usage:
      'orca relay start (--template <id> | --stages-file <path>) --goal <text> [--name <text>] [--acceptance <text>] [--max-hops <n>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'template',
      'stages-file',
      'goal',
      'name',
      'acceptance',
      'max-hops'
    ]
  },
  {
    path: ['relay', 'show'],
    summary: 'Inspect one relay chain and all its hop history',
    usage: 'orca relay show --id <chainId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id']
  },
  {
    path: ['relay', 'cancel'],
    summary: 'Cancel an active relay chain',
    usage: 'orca relay cancel --id <chainId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id']
  },
  {
    path: ['relay', 'worker-pull'],
    summary: 'Pull the next available single-step task from the active broker',
    usage: 'orca relay worker-pull --node <nodeId> --topics <csv> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'node', 'topics']
  },
  {
    path: ['relay', 'worker-ack'],
    summary: 'Submit this stage output back to the relay broker (dumb worker handoff)',
    usage:
      'orca relay worker-ack --task-id <id> --node <nodeId> --attempt <n> --summary <text> [--output <text> | --output-file <path|->] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'task-id',
      'node',
      'attempt',
      'summary',
      'output',
      'output-file'
    ]
  },
  {
    path: ['relay', 'worker-nack'],
    summary: 'Report failure for a leased task so the orchestrator can retry, bounce, or pause',
    usage:
      'orca relay worker-nack --task-id <id> --node <nodeId> --attempt <n> --reason <text> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'task-id', 'node', 'attempt', 'reason']
  }
]
