/**
 * Data sources reached through a remote MCP server with OAuth. The user logs
 * in with their own account; SilkRoad ships no shared credentials.
 */
export interface OAuthConnectorSpec {
  id: string
  title: string
  summary: string
  /** Namespace for model-facing tool names: `mcp__<serverName>__<tool>`. */
  serverName: string
  url: string
  docs: string
}

export const OAUTH_CONNECTORS: readonly OAuthConnectorSpec[] = [
  {
    id: 'fastmoss',
    title: 'FastMoss',
    summary: 'TikTok Shop 市场数据：商品、店铺、达人、视频、直播与广告',
    serverName: 'fastmoss',
    url: 'https://mcp.fastmoss.com/mcp',
    docs: 'https://developers.fastmoss.com/docs/mcp/setup',
  },
]
