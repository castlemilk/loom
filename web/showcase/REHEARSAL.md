# Landing page walkthroughs

The three chapters follow Music through Loom’s components. The Studio chapter opens 96 articles and selects Jazz. The SDK queries the Music article’s 24 outgoing neighbors, then scrolls to Sound in the Science topic. Graph MCP takes Music and Sound as inputs and returns the archived introduction with the original hyperlink.

## Source

The recorder uses the bundled Wikispeedia collection, the public `createGraphIndex` API and the server’s `getConnection` implementation. Every article-to-article wire in the Studio illustration comes from the archive. The positions are arranged for the walkthrough. Its link opens the actual topic in Studio. [Wikispeedia dataset](https://snap.stanford.edu/data/wikispeedia.html) · [Archived Music article](https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm)

The opening graph, query results and cited answer draw on the StageShow panel-annotation, payout-flow and ai-chat examples. Desktop uses a full-width window. Phone scenes use a separate header, fewer map labels and a two-line query. [StageShow](https://github.com/benjitaylor/skills/tree/299140fafd08df55a9c234e610c3f64af3f45531/stageshow)

## Record the scenes

After `task setup`, run `task studio:showcase` from the repository root with Chrome and an H.264-capable ffmpeg installed. Set `FFMPEG_PATH` to use a specific ffmpeg executable. The task restores StageShow from `skills-lock.json` and places the finished media in `web/public/showcase/`. Normal site builds serve these files directly.

To edit a chapter, run `node scripts/render-showcase.mjs --preview` after restoring the authoring dependencies. Open the printed URL and select `?scene=studio`, `?scene=sdk` or `?scene=mcp`. Rebuild the preview after editing the scenes.

## Checks

- Film the opening, click, result and settled states at 704 pixels and again at a 390-pixel viewport. The compact composition uses a 358-pixel canvas. Read the result values and the source at the size they appear on the page.
- Check the encoded films as well as the authoring preview. The recorder steps at 24 fps, rejects a restarted sequence and compares each decoded final frame with the reduced-motion poster. All six files must pass before it replaces the public set.
- In Studio, watch the full expansion between the Music and Jazz clicks. In the SDK, three results fit at once. Earlier and later rows scroll behind the clipped list. In MCP, check that the inputs precede Ask, the passage appears after the call, and the source arrives last.
- The site's desktop and touch journeys exercise manual play, pause, offscreen resume, replay, tab navigation, reduced motion, the data-saving preference and recovery from an interrupted video request. They follow the Studio link to Jazz and the SDK link to the connection example.

In the release rehearsal all six wide and phone state sheets passed the StageShow gate. Reviewing the encoded media caught an offset in the phone capture and a repeated opening in the desktop graph. The recorder now checks both. The SDK highlight spans its row, and the last query result and first MCP input both name Sound. Live browser sampling occasionally missed a refresh interval, so the visual review also inspected the decoded 24 fps frames.
