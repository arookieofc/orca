import type { HandlerGroup } from '../dispatch/handler-group-manifest'

export const NODE_RELAY_HANDLER_GROUP: HandlerGroup = {
  name: 'relay',
  keys: [
    'relay status',
    'relay templates',
    'relay start',
    'relay show',
    'relay cancel',
    'relay worker-pull',
    'relay worker-ack',
    'relay worker-nack'
  ],
  load: async () => (await import('./node-relay-handlers.js')).NODE_RELAY_HANDLERS
}
