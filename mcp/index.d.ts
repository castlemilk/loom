import type { McpServer } from '@modelcontextprotocol/server'

export interface KnowledgeNode {
  id: string
  label?: string
  kind?: string
  section?: string
  summary?: string
}
export interface KnowledgeLink {
  source: string
  target: string
}
export interface KnowledgeGraph<N extends KnowledgeNode = KnowledgeNode, E extends KnowledgeLink = KnowledgeLink> {
  id: string
  name: string
  data: { nodes: readonly N[]; links: readonly E[] }
  source?: string
  attribution?: string
  licenseUrl?: string
  evidence?(from: N, to: N): Promise<Record<string, unknown> | null>
}
export function loadBuiltinGraphs(): Promise<KnowledgeGraph[]>
export function loadGraphFile(path: string): Promise<KnowledgeGraph>
export function createLoomMcpServer<N extends KnowledgeNode, E extends KnowledgeLink>(sources: readonly KnowledgeGraph<N, E>[]): McpServer
/** Share the read-only index across fresh MCP sessions and protocol negotiations. */
export function createLoomMcpServerFactory<N extends KnowledgeNode, E extends KnowledgeLink>(sources: readonly KnowledgeGraph<N, E>[]): () => McpServer
