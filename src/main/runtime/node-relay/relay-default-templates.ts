import type { RelayTemplate } from '../../../shared/node-relay/node-relay-types'

const SEED_TS = 1_732_600_000_000

export const BUILTIN_RELAY_TEMPLATES: RelayTemplate[] = [
  {
    id: 'tpl-research-code-verify',
    name: '调研 → 编码 → 可信验收',
    description: '先由远端调研节点出方案，再由编码节点实现，最后可信验收（失败自动打回编码重做）。',
    builtin: true,
    maxHops: 6,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    stages: [
      {
        id: 'research',
        name: '1. 方案调研',
        executor: 'remote-mq',
        topic: 'research',
        instruction: '梳理实现背景、约束与可行方案，只交出清晰结论与关键文件路径。',
        leaseSeconds: 900,
        maxAttempts: 2,
        onFail: 'pause_for_human'
      },
      {
        id: 'code',
        name: '2. 编码实现',
        executor: 'remote-mq',
        topic: 'code',
        instruction: '结合上一步结论完成实现，并在 summary 中列出修改点与自检情况。',
        leaseSeconds: 1800,
        maxAttempts: 3,
        onFail: 'pause_for_human'
      },
      {
        id: 'verify',
        name: '3. 可信验收',
        executor: 'remote-mq',
        topic: 'verify',
        instruction: '在可信节点执行验收标准；失败则填写原因以便自动打回编码步重做。',
        leaseSeconds: 900,
        maxAttempts: 2,
        onFail: 'reject_to_step',
        rejectTargetStageId: 'code'
      }
    ]
  },
  {
    id: 'tpl-webbot-remote-verify',
    name: 'Web Bot 设计 → 远端编码 → 本机验收',
    description: '本机 Muse/Cue 网页 Bot 输出方案，交给远端云电脑/VPS 实现，再回到本机跑命令验收。',
    builtin: true,
    maxHops: 6,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    stages: [
      {
        id: 'design',
        name: '1. Web Bot 出方案',
        executor: 'local-web-bot',
        topic: '@muse',
        instruction: '针对目标给出明确拆分、边界条件与修改方案，直接交付执行清单。',
        leaseSeconds: 300,
        maxAttempts: 1,
        onFail: 'pause_for_human'
      },
      {
        id: 'implement',
        name: '2. 远端节点实现',
        executor: 'remote-mq',
        topic: 'code',
        instruction: '根据上一棒设计方案完成代码/配置修改，并交付简要改动总结。',
        leaseSeconds: 1800,
        maxAttempts: 3,
        onFail: 'pause_for_human'
      },
      {
        id: 'local-check',
        name: '3. 本机可信命令验收',
        executor: 'local-verify',
        topic: 'local-verify',
        instruction: '在本机可信工作区运行校验命令。',
        command: 'pnpm test --run',
        workdir: '.',
        shell: 'auto',
        leaseSeconds: 300,
        maxAttempts: 1,
        onFail: 'reject_to_step',
        rejectTargetStageId: 'implement'
      }
    ]
  },
  {
    id: 'tpl-single-custom',
    name: '单步定向外包',
    description: '单节点领走、完成即结束，适合简单独立的云端执行任务。',
    builtin: true,
    maxHops: 3,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    stages: [
      {
        id: 'single',
        name: '1. 单步执行',
        executor: 'remote-mq',
        topic: 'code',
        instruction: '按目标独立完成任务并交出最终结果摘要与产物。',
        leaseSeconds: 1800,
        maxAttempts: 3,
        onFail: 'pause_for_human'
      }
    ]
  }
]
