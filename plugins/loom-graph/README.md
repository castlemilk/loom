# Loom Graph MCP

Give an assistant read-only access to your knowledge graph. Loom reads a JSON file and provides six MCP tools to search nodes, inspect relationships and trace paths. Your node IDs, link direction and custom fields carry through to the results. [Connect your graph](https://castlemilk.github.io/loom/mcp/#connect)

## Bring your graph

1. Export your graph as JSON with a `nodes` array and a `links` array. Each node needs a unique string `id`. Each link’s `source` and `target` refer to those IDs. Loom also accepts `edges` in place of `links` and Studio scenes with a `data` object. [Download a working sample](https://castlemilk.github.io/loom/examples/team-graph.json)
2. In **Bring your graph**, choose the file to run a real MCP query inside your browser. You can also go straight to setup if you already have the file path. [Open graph setup](https://castlemilk.github.io/loom/mcp/#connect)
3. For one assistant, select **Local stdio** and copy the **Codex** or **Claude Code** command. Run it from the folder containing your file with Node.js 22.14 or later installed. The shell resolves its full path once, so the assistant can start the server from any project. You can also enter an absolute path or choose **Client JSON** for another MCP host. Your file appears as the graph `local`.
4. For a team, select **Streamable HTTP**. Use the path on your server, configure your HTTPS endpoint and OAuth issuer, then give teammates the MCP URL. The public guest walkthrough demonstrates this connection using Loom’s sample data. [Try the hosted example](https://castlemilk.github.io/loom/mcp/live/)

```json
{
  "name": "Service ownership",
  "nodes": [
    { "id": "checkout", "label": "Checkout" },
    { "id": "payments", "label": "Payments team" }
  ],
  "links": [{ "source": "checkout", "target": "payments", "kind": "owned_by" }]
}
```

Ask **“How does Checkout connect to Payments team in my graph?”** The assistant can call `get_connection` with `{"graph":"local","from":"checkout","to":"payments"}` and read the original `owned_by` relationship.

## Install the plugin or desktop extension

Add this GitHub repository as a marketplace, then install `loom-graph@loom`. The plugin includes four offline examples and the same read-only MCP server. To use your file, the graph setup above generates a separate `my-graph` connection. Hosts that let you set the server process environment can also pass `LOOM_GRAPH_FILE` to the installed launcher. An explicit `--graph` takes precedence. [Choose your installer](https://castlemilk.github.io/loom/mcp/#install)

**Codex**

```sh
codex plugin marketplace add castlemilk/loom
codex plugin add loom-graph@loom
```

**Claude Code**

```sh
claude plugin marketplace add castlemilk/loom
claude plugin install loom-graph@loom
```

**Claude Desktop** — Open Extensions in desktop settings, choose **Advanced settings → Install Extension**, and select the downloaded `.mcpb` file. Then ask how Music connects to Sound in Wikispeedia. [Claude Desktop extension guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

For an offline marketplace, extract the ZIP into a permanent location and use its folder path in the first command. In a source checkout, `task setup` followed by `task mcp:pack` builds the downloads in `artifacts/mcp/`. After changing the server or its data, run `task mcp:marketplace` to regenerate the catalogs and bundled plugin in the repository. `task mcp:test:plugins` checks local installs. After publication, `task mcp:test:github` installs directly from GitHub in fresh Codex and Claude Code profiles and queries both servers.

### Open the graph browser

Hosts that support the OpenAI MCP Extensions global entrypoint can open **Loom graph browser** from navigation. Choose a graph, search for a node, then select an outgoing neighbor. MCP Apps hosts can also display the connection inline when `get_connection` returns. Both views use the same `ui://loom/graph-browser.html` resource and the host’s active MCP connection. Other clients can read the structured result and source URL directly. [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) · [OpenAI MCP Extensions](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#mcp-app-entrypoints)

## Connect over HTTP

Open the hosted demo, choose **Connect over HTTP**, continue as a guest and approve **Allow graph access**. Your browser returns to GitHub Pages, exchanges its authorization code using PKCE, and receives five minutes of `graph:read` access to the public graphs. Choose **List graph tools**, then **Run get_connection** to read the archived Music → Sound passage. [Try the live OAuth demo](https://castlemilk.github.io/loom/mcp/live/)

The public MCP endpoint is `https://loom-graph.apps.deephost.benebsworth.com/mcp`. Loom Guest issues tokens for that resource, with the Pages walkthrough registered as a public client. The marketplace plugin uses local stdio. For your own HTTP deployment, register your clients with your chosen issuer. [Public resource metadata](https://loom-graph.apps.deephost.benebsworth.com/.well-known/oauth-protected-resource/mcp)

After `task setup` in a repository checkout, run the following command. In your MCP client, choose Streamable HTTP and enter `http://127.0.0.1:7341/mcp`. To use the installable package, copy the release-specific start command from the component page. [Client setup](https://castlemilk.github.io/loom/mcp/#connect)

```sh
node mcp/cli.js --http
```

The listener binds to loopback. Use `--port` to change the port and `--graph /absolute/path/to/scene.json` to serve a Studio export. For a public endpoint, terminate HTTPS at a reverse proxy, preserve the public Host header and forward both the MCP endpoint and its well-known metadata routes to the listener. Set `--resource-url` to the exact public MCP URL and `--issuer` to the exact issuer in the provider’s OpenID Connect discovery document.

```sh
node mcp/cli.js --graph /srv/graphs/team.json --http --resource-url https://graphs.example.org/mcp \
  --issuer https://identity.example.org/realms/loom
```

### Try a real sign-in

```text
               GRAPH MCP          CLIENT          OAUTH PROVIDER
                 .---.            .---.                .-.
                 |=.=|            | >_|               [ o ]
                 '---'            /___\                '-'
 Endpoint          o<---------------*                   |
 Discovery         *--------------->o------------------>o
                   |                o<------------------'
 Consent           |                o------sign in----->o
                   |                o<-------code-------'
 Token             |                *-----code + PKCE==>o
                   |                o<=======token======'
 Tools             o<--tools/list---*                   |
                   '--------------->o                   |
 Result            o<--tools/call---*                   |
                   '====passage====>@                   |
```

At the final step, choose **Open graph browser** to inspect the live result and explore another graph over the same authorized connection. **Install Loom Graph** below the walkthrough offers both local installers.

After `task setup`, choose either provider. Both commands start a graph server on loopback and a disposable identity provider.

| Provider | Start command | Sign-in service |
| --- | --- | --- |
| Keycloak | `task mcp:demo` | Docker runs a temporary realm on port 8180. |
| oidc-provider | `task mcp:demo PROVIDER=local` | Node.js runs the provider’s development sign-in and consent pages on port 8181. |

Open the local walkthrough, connect, and continue to the provider. Use the demo username **reader** and password **loom-demo**. Approve the graph permission, list the available tools and run `get_connection`. The browser displays the passage linking Music to Sound. Ctrl+C stops the demo. [Open local walkthrough](http://127.0.0.1:7341/demo/)

The initial HTTP 401 identifies the protected-resource metadata document. It names the issuer and the `graph:read` scope. The client uses an authorization code and PKCE S256. After consent it exchanges the code and sends the access token in a Bearer header. Graph MCP verifies the RS256 signature using the issuer’s signing keys, the issuer, expiration, audience and scope on each request. A missing or invalid token receives 401. A valid token lacking the read scope receives 403. [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

### Use your own provider

| Provider | Configure the API and client |
| --- | --- |
| Keycloak | Use the realm issuer, a public standard-flow client with PKCE S256, and a `graph:read` client scope. An audience mapper on that scope adds the full MCP URL to the **access token**. Include the scope in the token. [Demo realm configuration](https://github.com/castlemilk/loom/blob/main/mcp/demo/loom-realm.json) · [Keycloak endpoints](https://www.keycloak.org/securing-apps/oidc-layers) |
| Auth0 | Register an RS256 API whose identifier is the full MCP URL and add the `graph:read` permission. Enable the tenant’s Resource Parameter Compatibility Profile so the OAuth `resource` selects that API. Use your tenant issuer, including its trailing slash. [Auth0 API settings](https://auth0.com/docs/get-started/apis/api-settings) · [Resource parameter setup](https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0) |

Register each MCP client’s callback with its provider and give the client its public client ID. To try the browser walkthrough against your own provider, register `http://127.0.0.1:7341/demo/` as an exact callback, allow the web origin `http://127.0.0.1:7341`, and configure `http://127.0.0.1:7341/mcp` as the resource. Set `LOOM_DEMO_ISSUER`, `LOOM_DEMO_CLIENT_ID` and optionally `LOOM_DEMO_PROVIDER` (display name) before running `task mcp:demo`. This uses your provider’s sign-in page and the local graph server.

The public walkthrough replays exchanges captured from both providers. Run `task mcp:test:oauth` to check both recordings against fresh sign-ins, including consent denial and retry. To refresh a recording, run `sh mcp/demo/start.sh --test --record` for Keycloak, or prefix that command with `LOOM_DEMO_PROFILE=local` for oidc-provider. The recording contains public discovery fields, HTTP statuses, tool names and graph evidence.

## Connect over stdio

The setup page supplies the exact downloadable package URL for that release. Choose **My graph file** and enter its absolute path. Reconnect or restart the server after editing the file to load the new snapshot.

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

If your application already returns a graph snapshot, pass its nodes and links directly to the server. For this example, `readCatalog` is your application’s function for reading that snapshot.

```ts
import { createLoomMcpServerFactory } from 'loom-graph-mcp'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { readCatalog } from './catalog.js'

const { nodes, links } = await readCatalog()
const graph = { id: 'catalog', name: 'Service catalog', data: { nodes, links } }
serveStdio(createLoomMcpServerFactory([graph]))
```

The factory indexes the snapshot once and supplies a fresh server for each connection. To read a JSON file in code, use `await loadGraphFile(path)` from the same package. For a transport that takes one server instance, call `createLoomMcpServer([graph])`. An optional `evidence(from, to)` function can attach source information to an existing edge. [Official MCP stdio transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio)

## Built-in data

- **wikispeedia** contains 4,604 articles and 119,882 directed links. The dataset is credited to Robert West, Jure Leskovec, Joelle Pineau and Doina Precup. Loom groups the recorded links by subject and indexes cross-topic anchors and excerpts from the 2007 Schools Wikipedia Selection. Those passages are credited to Wikipedia contributors under the GNU Free Documentation License. [Stanford SNAP dataset and papers](https://snap.stanford.edu/data/wikispeedia.html) · [Original edition and license](https://dlab.epfl.ch/wikispeedia/wpcd/wp/w/Wikipedia_Text_of_the_GNU_Free_Documentation_License.htm)
- **knowledge** contains 508 nodes and 746 relationships from the Loom knowledge-console demo. [Source console](https://benebsworth.com/)
- **bauhaus** and **outer-solar-system** contain curated English Wikipedia articles. Loom extracts links and records the revision used for each article. Node details include a permalink to that revision. The descriptions are credited to English Wikipedia contributors under CC BY-SA 4.0. [Bauhaus](https://castlemilk.github.io/loom/examples/bauhaus/) · [Outer Solar System](https://castlemilk.github.io/loom/examples/outer-solar-system/) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

The server code uses the MIT license. Data license texts ship under `data-licenses/`.
