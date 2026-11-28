import { describe, expect, it } from 'vitest'
import { LocalMockRelayBroker } from './local-mock-relay-broker'
import { NodeRelayOrchestrator } from './relay-orchestrator'

describe('relay-orchestrator', () => {
  it('runs a customizable multi-node relay with bounce-back rejection and passes cleanly', async () => {
    const broker = new LocalMockRelayBroker(null)
    let verifyCount = 0
    const orch = new NodeRelayOrchestrator({
      stateDir: null,
      broker,
      askWebBot: async ({ prompt }) => {
        expect(prompt).toContain('实现导出功能')
        return '设计方案：拆分 exporter 并加上单元测试'
      },
      runLocalVerify: async () => {
        verifyCount += 1
        if (verifyCount === 1) {
          return { passed: false, exitCode: 1, output: 'FAIL export.test.ts' }
        }
        return { passed: true, exitCode: 0, output: 'PASS export.test.ts' }
      }
    })

    const chain = await orch.startChain({
      templateId: 'tpl-webbot-remote-verify',
      goal: '实现导出功能'
    })

    // Stage 1 (local-web-bot) resolves async promise -> Stage 2 (remote-mq) published.
    await new Promise((r) => setTimeout(r, 20))
    const pulled1 = await broker.pullTask({ nodeId: 'vps-code', topics: ['code'] })
    expect(pulled1).not.toBeNull()
    expect((pulled1?.payload.handoff_from_previous as { summary?: string })?.summary).toContain(
      '设计方案'
    )
    await broker.ackTask({
      taskId: pulled1!.id,
      nodeId: 'vps-code',
      attempt: pulled1!.attempts,
      summary: '初版代码已提交',
      output: 'changed export.ts'
    })

    // Tick picks up done Stage 2 -> dispatches Stage 3 (local-verify), fails first -> rejects to Stage 2.
    await orch.tick()
    await new Promise((r) => setTimeout(r, 20))
    const pulled2 = await broker.pullTask({ nodeId: 'vps-code', topics: ['code'] })
    expect(pulled2).not.toBeNull()
    expect(String(pulled2?.payload.rejection_reason)).toContain('FAIL export.test.ts')
    await broker.ackTask({
      taskId: pulled2!.id,
      nodeId: 'vps-code',
      attempt: pulled2!.attempts,
      summary: '已修复测试边界',
      output: 'fixed export.ts'
    })

    // Second verify passes -> chain done.
    await orch.tick()
    await new Promise((r) => setTimeout(r, 20))
    const done = orch.getChain(chain.id)
    expect(done?.status).toBe('done')
    expect(done?.hopCount).toBe(5)
  })

  it('pauses the chain when maxHops budget is exceeded', async () => {
    const orch = new NodeRelayOrchestrator({
      stateDir: null,
      runLocalVerify: async () => ({ passed: false, exitCode: 1, output: 'always fails' })
    })

    const chain = await orch.startChain({
      goal: '测试跳数熔断',
      maxHops: 2,
      stages: [
        {
          id: 'check',
          name: '自检',
          executor: 'local-verify',
          topic: 'local-verify',
          instruction: 'run check',
          command: 'pnpm test',
          workdir: '.',
          leaseSeconds: 60,
          maxAttempts: 1,
          onFail: 'retry_self'
        }
      ]
    })

    await new Promise((r) => setTimeout(r, 20))
    const updated = orch.getChain(chain.id)
    expect(updated?.status).toBe('paused_human')
    expect(updated?.error).toContain('上限')
  })

  it('retains lastWorker on rejected remote-mq hops', async () => {
    const broker = new LocalMockRelayBroker(null)
    const orch = new NodeRelayOrchestrator({ stateDir: null, broker })
    const chain = await orch.startChain({
      goal: '保留打回节点名称',
      maxHops: 4,
      stages: [
        {
          id: 's1',
          name: '开发',
          executor: 'remote-mq',
          topic: 'dev',
          leaseSeconds: 60,
          maxAttempts: 1,
          instruction: 'do s1',
          onFail: 'pause_for_human'
        },
        {
          id: 's2',
          name: '审核',
          executor: 'remote-mq',
          topic: 'qa',
          leaseSeconds: 60,
          maxAttempts: 1,
          instruction: 'do s2',
          onFail: 'reject_to_step',
          rejectTargetStageId: 's1'
        }
      ]
    })

    const p1 = await broker.pullTask({ nodeId: 'bot-alpha', topics: ['dev'] })
    await broker.ackTask({
      taskId: p1!.id,
      nodeId: 'bot-alpha',
      attempt: p1!.attempts,
      summary: 'done s1',
      output: 'ok'
    })
    await orch.tick()

    const p2 = await broker.pullTask({ nodeId: 'bot-beta', topics: ['qa'] })
    await broker.nackTask({
      taskId: p2!.id,
      nodeId: 'bot-beta',
      attempt: p2!.attempts,
      reason: 'bad edge case'
    })
    await orch.tick()

    const latest = orch.getChain(chain.id)
    expect(latest?.history[1]?.status).toBe('rejected')
    expect(latest?.history[1]?.assignedNode).toBe('bot-beta')
  })
})
