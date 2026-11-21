import type { GraphData, GraphLink, GraphNode } from 'loom-core'

export type Field = string | number | boolean | null | readonly Field[] | { readonly [key: string]: Field }

/** The Studio also accepts graphs with optional labels and application-specific fields. */
export type StudioGraph = GraphData<GraphNode & Record<string, unknown>, GraphLink & Record<string, unknown>>
  & Record<string, unknown>

export interface RecordNode extends GraphNode {
  label: string
  kind: string
  metadata?: Readonly<Record<string, Field>>
}

export interface RecordLink extends GraphLink {
  kind: string
  note?: string
  sourceURL?: string
}

export interface ImageRef {
  src: string
  alt: string
  credit?: string
  sourceURL?: string
}

export interface Notebook extends GraphData<RecordNode, RecordLink> {
  /** A node's optional art field names an entry here. Several nodes can share one image. */
  images: Readonly<Record<string, ImageRef>>
}
