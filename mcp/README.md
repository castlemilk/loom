# Loom Graph MCP

Search a Loom knowledge graph, follow its directed links and read the source behind a connection from an MCP client. The server runs locally over stdio. The package includes the graph data, search index and component icon. [Try the graph explorer and copy a client configuration](https://castlemilk.github.io/loom/mcp/)

## Connect

Use Node.js 22.14 or later. The component page supplies a configuration with the exact downloadable package URL for that Studio release. Add it to your client's local MCP servers. Choose **My Studio export** to supply an absolute path to a graph JSON file. That process then exposes the file as a single graph named `local`.

In Studio, choose **Export graph → Graph MCP** to download the current scene and open client setup. From a repository checkout, run `task setup` followed by `task mcp:serve`, or `task mcp:serve GRAPH=/path/to/scene.json`. A Studio scene, a raw `{nodes, links}` graph and a console `{nodes, edges}` export are supported. Queries use the IDs in your file.

## Ask a graph question

Ask **“How does Music connect to Sound in Wikispeedia? Show me the source.”** A client can resolve the IDs with `search_nodes` before calling `get_connection`.

```json
{
  "name": "get_connection",
  "arguments": { "graph": "wikispeedia", "from": "article:74", "to": "article:2863" }
}
```

The result identifies the source and target, the edge records, the linked word and a passage from the introduction. An edge with no indexed passage has `evidence: null`. [Read the archived article](https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm)

| Tool | Result |
| --- | --- |
| `list_graphs` | IDs, graph sizes, sources and attribution. |
| `search_nodes` | Ranked references with stable node IDs and resource URIs. |
| `get_node` | The original node fields and directed edge counts. |
| `get_neighbors` | Incoming or outgoing neighbors, with parallel edge counts. |
| `get_connection` | Directed edges between two nodes and available source evidence. |
| `find_path` | A shortest directed path up to `maxHops` (0–8, default 4). |

Search, neighbors and edge results accept `offset` and `limit` (1–50, default 10). Continue from `nextOffset` until it is null. Each tool publishes input and output schemas, and returns structured content and equivalent JSON text. A client can also read `loom://graphs/catalog` and each node's returned resource URI.

## Use the server in code

```ts
import { createLoomMcpServerFactory, loadGraphFile } from 'loom-graph-mcp'
import { serveStdio } from '@modelcontextprotocol/server/stdio'

const graph = await loadGraphFile('/absolute/path/to/scene.json')
serveStdio(createLoomMcpServerFactory([graph]))
```

For an in-memory graph, pass `{id, name, data: {nodes, links}}` directly. The factory builds the graph index once and supplies a fresh server for each connection. For a transport that takes one server instance, call `createLoomMcpServer([graph])`. An optional `evidence(from, to)` function can attach source information to an existing edge. [Official MCP stdio transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio)

## Built-in data

- **wikispeedia** contains 4,604 articles and 119,882 directed links. The dataset is credited to Robert West, Jure Leskovec, Joelle Pineau and Doina Precup. Loom groups the recorded links by subject and indexes cross-topic anchors and excerpts from the 2007 Schools Wikipedia Selection. Those passages are credited to Wikipedia contributors under the GNU Free Documentation License. [Stanford SNAP dataset and papers](https://snap.stanford.edu/data/wikispeedia.html) · [Original edition and license](https://dlab.epfl.ch/wikispeedia/wpcd/wp/w/Wikipedia_Text_of_the_GNU_Free_Documentation_License.htm)
- **knowledge** contains 508 nodes and 746 relationships from the Loom knowledge-console demo. [Source console](https://benebsworth.com/)
- **bauhaus** and **outer-solar-system** contain curated English Wikipedia articles. Loom extracts links and records the revision used for each article. Node details include a permalink to that revision. The descriptions are credited to English Wikipedia contributors under CC BY-SA 4.0. [Bauhaus](https://castlemilk.github.io/loom/examples/bauhaus/) · [Outer Solar System](https://castlemilk.github.io/loom/examples/outer-solar-system/) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

The server code uses the MIT license. Data license texts ship under `data-licenses/`.
