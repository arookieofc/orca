import { defineMethod } from '../../core'
import { getNodeRelayOrchestrator } from '../../../node-relay/relay-orchestrator'
import {
  completeLocalVerifyJob,
  pollLocalVerifyJobs
} from '../../../node-relay/relay-local-verify-queue'
import {
  NodeRelayChainIdParams,
  NodeRelayDeleteTemplateParams,
  NodeRelayGetStateParams,
  NodeRelayLocalVerifyCompleteParams,
  NodeRelayLocalVerifyPollParams,
  NodeRelayManualHandoffParams,
  NodeRelaySaveTemplateParams,
  NodeRelayStartChainParams,
  NodeRelayUpdateConfigParams,
  NodeRelayWorkerAckParams,
  NodeRelayWorkerHeartbeatParams,
  NodeRelayWorkerNackParams,
  NodeRelayWorkerPullParams
} from '../../../../../shared/rpc-contract/node-relay-params'

export const NODE_RELAY_METHODS = [
  defineMethod({
    name: 'nodeRelay.getState',
    permission: 'workspace',
    params: NodeRelayGetStateParams,
    handler: () => getNodeRelayOrchestrator().getState()
  }),

  defineMethod({
    name: 'nodeRelay.updateConfig',
    permission: 'workspace',
    params: NodeRelayUpdateConfigParams,
    handler: (params) => ({ config: getNodeRelayOrchestrator().updateConfig(params) })
  }),

  defineMethod({
    name: 'nodeRelay.saveTemplate',
    permission: 'workspace',
    params: NodeRelaySaveTemplateParams,
    handler: (params) => ({ template: getNodeRelayOrchestrator().saveTemplate(params) })
  }),

  defineMethod({
    name: 'nodeRelay.deleteTemplate',
    permission: 'workspace',
    params: NodeRelayDeleteTemplateParams,
    handler: (params) => ({ ok: getNodeRelayOrchestrator().deleteTemplate(params.id) })
  }),

  defineMethod({
    name: 'nodeRelay.startChain',
    permission: 'workspace',
    params: NodeRelayStartChainParams,
    handler: async (params) => ({ chain: await getNodeRelayOrchestrator().startChain(params) })
  }),

  defineMethod({
    name: 'nodeRelay.cancelChain',
    permission: 'workspace',
    params: NodeRelayChainIdParams,
    handler: async (params) => ({ chain: await getNodeRelayOrchestrator().cancelChain(params.id) })
  }),

  defineMethod({
    name: 'nodeRelay.retryStage',
    permission: 'workspace',
    params: NodeRelayChainIdParams,
    handler: async (params) => ({
      chain: await getNodeRelayOrchestrator().retryCurrentStage(params.id)
    })
  }),

  defineMethod({
    name: 'nodeRelay.manualHandoff',
    permission: 'workspace',
    params: NodeRelayManualHandoffParams,
    handler: async (params) => ({ chain: await getNodeRelayOrchestrator().manualHandoff(params) })
  }),

  defineMethod({
    name: 'nodeRelay.deleteChain',
    permission: 'workspace',
    params: NodeRelayChainIdParams,
    handler: (params) => ({ ok: getNodeRelayOrchestrator().deleteChain(params.id) })
  }),

  defineMethod({
    name: 'nodeRelay.workerPull',
    permission: 'workspace',
    params: NodeRelayWorkerPullParams,
    handler: async (params) => ({
      task: await getNodeRelayOrchestrator().getBroker().pullTask(params)
    })
  }),

  defineMethod({
    name: 'nodeRelay.workerHeartbeat',
    permission: 'workspace',
    params: NodeRelayWorkerHeartbeatParams,
    handler: async (params) => ({
      task: await getNodeRelayOrchestrator().getBroker().heartbeatTask(params)
    })
  }),

  defineMethod({
    name: 'nodeRelay.workerAck',
    permission: 'workspace',
    params: NodeRelayWorkerAckParams,
    handler: async (params) => {
      const orch = getNodeRelayOrchestrator()
      const task = await orch.getBroker().ackTask({
        ...params,
        artifacts: (params.artifacts ?? []).map((a) => ({
          ...a,
          createdAt: a.createdAt ?? Date.now()
        }))
      })
      await orch.tick()
      return { task }
    }
  }),

  defineMethod({
    name: 'nodeRelay.workerNack',
    permission: 'workspace',
    params: NodeRelayWorkerNackParams,
    handler: async (params) => {
      const orch = getNodeRelayOrchestrator()
      const task = await orch.getBroker().nackTask(params)
      await orch.tick()
      return { task }
    }
  }),

  defineMethod({
    name: 'nodeRelay.localVerifyPoll',
    permission: 'workspace',
    params: NodeRelayLocalVerifyPollParams,
    handler: () => ({ jobs: pollLocalVerifyJobs() })
  }),

  defineMethod({
    name: 'nodeRelay.localVerifyComplete',
    permission: 'workspace',
    params: NodeRelayLocalVerifyCompleteParams,
    handler: (params) => ({
      ok: completeLocalVerifyJob(params.jobId, {
        passed: params.passed,
        exitCode: params.exitCode,
        output: params.output,
        ...(params.error ? { error: params.error } : {})
      })
    })
  })
]
