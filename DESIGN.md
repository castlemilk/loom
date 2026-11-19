# Loom Graph Studio

The graph is the working surface. The studio is for people authoring graph views who need to see how a change affects reading, picking and dragging a real node. The dark canvas and warm instrument panel come from the existing knowledge console. Keep both legible when authors switch graph themes.

## Surfaces and type

The wordmark, narrow control column and adjustable canvas establish the layout. The graph uses the selected theme's ink, background and taxonomy colours. Put boundary artwork behind the WebGL canvas, with labels, tooltips and controls above it. Group colour identifies membership. The legend pairs it with a shape, a name and the number of members.

Use the existing Inter/system sans stack for navigation, object names and controls. Reserve the IBM Plex Mono fallback stack for counts, metrics and plotted labels. Use native controls, a visible focus ring and modest corners. Controls that affect the same operation should read as one group.

## Interaction

The sidebar starts with node search and the group-opening action. Choosing a node exposes its inspector beside those controls. Advanced layout, styling, workload generation and diagnostics share the same scrollable panel. On small screens the controls follow the graph in document flow. The splitter resizes graph height there.

An open group has an outline, an expanded legend button and a breadcrumb showing its name and member count. The rendered graph supplies the motion. Reduced motion follows the engine's existing preference. Group controls and search provide keyboard access to the same views as picking on the canvas.

## Runtime ownership

The studio inherits its paper, text, rule, accent and type tokens from `demo/studio.css`. `web/app/globals.css` owns the studio's graph tools, legend and responsive controls. `src/theme.ts` and the studio's theme adapter own graph colour and geometry. `web/app/fields.jsx` owns shared controls. The working interaction examples and typed settings live in the README.
