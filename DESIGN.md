# Loom

## Art direction

Loom presents graph layout as a material study. A copper rod shows a connection. An ivory, graphite or terracotta joint shows a node. The field guide pairs a photographic-style wire sculpture with the working graph engine so a visitor can handle a spatial interpretation of the illustration. The product audience is someone evaluating a graph library or configuring a real graph.

The field guide at `/` leads to a running example or the full editor. `/artwork/` publishes individual files and their usage. `/studio/` is the working surface. The studio wordmark returns to the guide. Historical example links at the root forward their query and fragment to the editor.

| Material | Guide colour | Use |
| --- | --- | --- |
| Paper | `#f5f3ea` | Reading surface and ground for ink drawings |
| Graphite | `#202721` | Titles and navigation |
| Copper | `#9b4427` | Display italic, mark-family accent and active links |
| Mineral | `#e8ece5` | Background of the example index |

Instrument Serif in roman and italic sets guide titles. The font files are self-hosted, with their licence in `web/public/licenses/`. The example index uses ruled rows, a small drawing, the name of the study and one measurement from the graph. Body text and controls use the studio's sans-serif stack. Joint counts, measurements and source code use monospace.

### Artwork and geometry

The four 224-pixel WebPs in `web/public/illustrations/` are independent crops of the original generated drawing sheet. Explore uses the magnifier, Layout uses parallel lanes, Groups uses enclosing contours, and Style uses a drawing nib. The guide and studio reference the same individual files. The artwork catalogue makes each downloadable. The original `settings-guide.webp` remains available at its existing public address for earlier studio clients.

The wire-study still uses two WebP widths, 640 and 1280 pixels, in a 3:2 frame. It is an original generated illustration. Its spatial interpretation has 21 named movable joints and 41 rods in `web/public/examples/wire-model.json`. The preview and full editor read the same file, anchor positions, palette and wire weights. The still reserves the display space before decoding. The live renderer starts on request and releases its graph when closed. Escape returns focus to the preview button. With WebGL2 unavailable, visitors can still browse and download the artwork.

## Components and navigation

The landing page opens on an optical bench. A glass prism stands for the archived Light article. Three incoming articles and three outgoing articles form nine paths across topics. The selected path lights up, and each of its two links opens the passage that contains the original hyperlink. The website build uses the SDK index and Graph MCP evidence reader to extract just those six links. The image is an original generated illustration. Keep the actual targets and labels in HTML so keyboard and touch readers can trace the same path.

Below the bench, the Studio walkthrough opens Music and inspects Jazz. The SDK runs a neighbor query on Music and scrolls to Sound in the Science topic. Graph MCP traces the link from Music to Sound to its archived passage. Each chapter has a text version and a link into the corresponding product. On phones the scenes recompose around the action. The wire model sits beside the code that mounts it in “Build with Loom.” The [walkthrough rehearsal](web/showcase/REHEARSAL.md) records the source, playback checks and regeneration command.

The shared masthead keeps the Loom mark at the left, reading and component links in the middle, and the Studio action at the right. On phones the action stays beside the wordmark and the four links occupy their own row. Keyboard focus and the current location remain visible. The component selector supports arrow keys, Home and End.

The field guide uses pine (`#1d3028`) for the work surface and a light copper (`#f1ac7c`) for display accents on pine. Paper sections carry diagrams, reading and examples. The shared component stylesheet defines surface colours, rules, section spacing, small type and control height. Use the serif for display titles, the sans face for actions and the monospaced face for real code or measurements.

Graph MCP’s mark is a copper branch with three ivory terminals on pine. Use the same square asset on the website, in the artwork catalogue and in MCP server discovery. Keep the adjacent text label at navigation sizes. The component page offers a real browser query and a separate configuration for the local server.

## Graph studio

The graph is the working surface. The studio is for people authoring graph views who need to see how a change affects reading, picking and dragging a real node. The dark canvas and warm instrument panel come from the existing knowledge console. Keep both legible when authors switch graph themes.

## Surfaces and type

The wordmark, narrow control column and adjustable canvas establish the layout. The graph uses the selected theme's ink, background and taxonomy colours. Put boundary artwork behind the WebGL canvas, with labels, tooltips and controls above it. Group colour identifies membership. The legend pairs it with a shape, a name and the number of members.

Use the existing Inter/system sans stack for navigation, object names and controls. Reserve the IBM Plex Mono fallback stack for counts, metrics and plotted labels. Use native controls, a visible focus ring and modest corners. Controls that affect the same operation should read as one group.

## Interaction

The sidebar opens on Explore. Its four illustrated tabs switch the visible settings panel. A copper underline marks the active tab. Left and right arrow keys move between tabs, Home and End reach the ends, and Tab enters the selected panel. The URL keeps the selected panel so bookmarks and browser history reopen it. The global bubble switch is the first control under Taxonomies. It preserves the per-group choices. On small screens the controls follow the graph in document flow. The splitter resizes graph height there.

Explore lists every member of an open group in source order. The two view buttons change how much of the graph is visible. The list keeps eight rows per page for large groups, and a name or ID search reaches every member. A member button selects the corresponding marker and inspector even when the canvas label is omitted.

An open group has one unfilled outer contour, an expanded legend button and a breadcrumb showing its name and member count. Spaced rings face the opening camera and stay in world space while the viewer orbits. The rendered graph supplies the motion. Reduced motion follows the engine's existing preference. Group controls and search provide keyboard access to the same views as picking on the canvas. The legend scrolls in one row when the splitter makes the canvas narrow.

The Section atlas uses violet for Optics, teal for Acoustics, ochre for Materials and blue for Tides. Short notebook titles keep node labels readable. Its default content-size and link-weight scales reserve visible space between members. Authors can change either scale in Appearance.

## Document tools and contextual controls

The tool strip groups Select, Node, Connect and JSON, with a divider before history. A filled copper treatment marks the active tool. Selecting a node opens its named inspector with editable properties, a kind or pin indicator, and a disclosure listing incident connections. Switching setting tabs folds that card. Changing a layout, taxonomy or quantitative encoding reveals the controls that shape it. Each disclosure pairs a native keyboard-operable summary with its current value and a rotating chevron. A manual collapse lasts until the next relevant change.

On narrow screens the strip occupies a full row. Opening a tool focuses its input and Escape returns to its button. The graph accepts V, N and C for selection, node creation and connection editing. Text inputs keep their own keyboard shortcuts.

## Runtime ownership

The studio inherits its paper, text, rule, accent and type tokens from `demo/studio.css`. `web/app/globals.css` owns the studio's graph tools, legend and responsive controls. `src/theme.ts` and the studio's theme adapter own graph colour and geometry. `web/app/fields.jsx` owns shared controls. The working interaction examples and typed settings live in the README.
