/** Model-facing tools for setting up data sources. API keys are never accepted here: the panel takes them. */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { Hub } from './hub.ts'

const JSON_OUTPUT = { type: 'json' } as const
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as never

export function setupTools(hub: Hub): ToolDefinition[] {
  return [
    defineTool({
      name: 'silkroad_status',
      description: 'List every SilkRoad data source (TikTok market data, search vendors, the user\'s own TikTok Shop, the local knowledge base) and the role presets, with their state. Call it before a task that needs market data, and when the user asks what is connected. A source in state connected exposes tools named by its toolPrefix; a connected shop enables the silkroad_tts_* tools.',
      parameters: {},
      output: {
        schema: JSON_OUTPUT,
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute() { return asJson(await hub.status()) },
    }),
    defineTool({
      name: 'silkroad_connect',
      description: 'Start the browser login for an OAuth data source (for example fastmoss). It opens the user\'s browser on the provider\'s own login page; the user signs in with their own account and approves access. Call it only after the user agrees to connect. API-key sources cannot be connected here: tell the user to save the key in the 跨境电商 (SilkRoad) panel in the left sidebar, 数据源 tab,.',
      parameters: {
        source: { type: 'string', required: true, description: 'Data source id from silkroad_status, e.g. fastmoss' },
      },
      output: {
        schema: JSON_OUTPUT,
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute(args) {
        const result = await hub.connector(args.source).beginLogin()
        return asJson({
          ...result,
          next: result.state === 'connected'
            ? 'Already connected; the tools are available.'
            : 'The browser was opened on the login page. Ask the user to finish signing in there, then call silkroad_status to confirm the state is connected.',
        })
      },
    }),
  ]
}
