# SDK roadmap

These are proposed additions, in the order we would build them. Each addresses work an application has to do itself today.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/roadmap/)

## Update a mounted graph

**Build this first.** The editor already commits atomic batches. The studio still rebuilds its WebGL graph when the node or link set changes and carries surviving positions, camera and selection into the new instance. Every embedding app that supports editing has to reproduce that work.

A public update operation should take stable node and link IDs, validate a whole change before applying it, and report which objects changed. Test it by adding a link to a selected, hand-positioned node while zoomed in. Its position, selection, camera and event subscriptions should survive. A bad endpoint should leave the displayed graph intact.

## Pick and edit connections

**Build on live updates.** Loom already draws arrows, separates parallel links and supports endpoint changes through editor transactions. The Wikipedia demo implements its own screen-space test to select a crossing. Other hosts need the same interaction for curved wires and loops.

Start with selection by stable link ID and the nearest point on the rendered path. A user could then drag an endpoint to another node and commit a single undoable transaction. Check the interaction with parallel links, self-loops, touch input and a rotated camera before adding bend handles or named ports.

## Share visible-node artwork

**Extract this from the atlas.** The Wikipedia image source already handles batching, cancellation and caching. The studio decides which nodes merit a picture, moves the pictures with the projected nodes, and shares the results with cards. Today a second app must implement that display logic again.

Give hosts a provider for any graph’s node IDs, image URLs and attribution links. The renderer should request visible images within a budget, keep fallback markers usable and discard late results after a selection or dataset change. Validate it with a slow provider, a missing image, and two cards that share a thumbnail.

## Resume edits across clients

**After the local edit contract settles.** Document IDs and expected revisions already catch stale writes within an editor session. A disconnected client still needs durable operation IDs, replay semantics and a bounded cursor for changes since a saved revision.

Test by reconnecting two clients after both edited the same document. Replaying an acknowledged command should apply it once. A conflict should identify the intervening change and let the host decide how to reconcile it. These capabilities would also give a future HTTP or MCP adapter a stable foundation.
