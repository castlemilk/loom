# Loom Graph Studio

The graph is the working surface. The studio is for people authoring graph views who need to see how a change affects reading, picking and dragging a real node. The dark canvas and warm instrument panel come from the existing knowledge console. Keep both legible when authors switch graph themes.

## Surfaces and type

The wordmark, narrow control column and adjustable canvas establish the layout. The graph uses the selected theme's ink, background and taxonomy colours. Put boundary artwork behind the WebGL canvas, with labels, tooltips and controls above it. Group colour identifies membership. The legend pairs it with a shape, a name and the number of members.

Use the existing Inter/system sans stack for navigation, object names and controls. Reserve the IBM Plex Mono fallback stack for counts, metrics and plotted labels. Use native controls, a visible focus ring and modest corners. Controls that affect the same operation should read as one group.

## Interaction

The sidebar opens with four illustrated links to Explore, Layout, Groups and Style. The illustrations share one 320-pixel WebP with four quadrants. Each link includes its text label and lands keyboard focus on its heading. The global bubble switch is the first control under Taxonomies. It preserves the per-group choices. On small screens the controls follow the graph in document flow. The splitter resizes graph height there.

Explore lists every member of an open group in source order. The two view buttons change how much of the graph is visible. The list keeps eight rows per page for large groups, and a name or ID search reaches every member. A member button selects the corresponding marker and inspector even when the canvas label is omitted.

An open group has one unfilled outer contour, an expanded legend button and a breadcrumb showing its name and member count. Spaced rings face the opening camera and stay in world space while the viewer orbits. The rendered graph supplies the motion. Reduced motion follows the engine's existing preference. Group controls and search provide keyboard access to the same views as picking on the canvas. The legend scrolls in one row when the splitter makes the canvas narrow.

The Section atlas uses violet for Optics, teal for Acoustics, ochre for Materials and blue for Tides. Short notebook titles keep node labels readable. Its default content-size and link-weight scales reserve visible space between members. Authors can change either scale in Appearance.

## Runtime ownership

The studio inherits its paper, text, rule, accent and type tokens from `demo/studio.css`. `web/app/globals.css` owns the studio's graph tools, legend and responsive controls. `src/theme.ts` and the studio's theme adapter own graph colour and geometry. `web/app/fields.jsx` owns shared controls. The working interaction examples and typed settings live in the README.
