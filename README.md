# Nexlit

Explore research papers through interactive graphs and reading paths.
Nexlit is an early version built with plain HTML, CSS and JavaScript: no build step or backend required.

## Run locally

With Python 3 installed, run this from the project folder:

```sh
python3 -m http.server 8000 --directory dist
```

Open [localhost:8000](http://localhost:8000). The welcome screen opens without a graph. Search for papers, import a bibliography, or choose **Continue exploring your library** to return to saved work. A sample BibTeX file is available at `dist/example.bib`.

On the first visit in each browser tab, only the original Nexlit logo and “Follow your curiosity.” appear in the center. After 0.6 seconds, they move upward and shrink together over a smooth 1-second transition, settling just above the central actions. Once they arrive, “Find your first connection” and “Continue exploring your library” fade in side by side in the center of the screen. Continue is disabled until a library is available. The header is hidden on the welcome screen and returns in the graph view. The introduction does not replay when returning home in that tab; reduced motion shows the final layout immediately.

## What you can do

- Search OpenAlex with Precise, Balanced or Exploratory mode; keep phrases in quotes and edit Boolean queries. You can also import BibTeX or Nexlit JSON libraries.
- Rotate the graph, zoom with the wheel or +/− buttons, and filter by topic. Nodes stay separated, overlapping labels are reduced, and rotation pauses while your pointer is over the graph. Open a node to explore a paper.
- Build a reading path, reorder papers and track what you have read.
- Use **Learn from scratch** to build a staged path from orientation to advanced readings, with multiple readings per stage, prerequisites and visible gaps. See [learning paths](docs/learning-paths.md).
- Fetch abstracts and citation metadata from Crossref, and generate short extractive abstract summaries.
- Export your library, including reading progress, as JSON.

The welcome screen uses a charcoal background with soft sage and lavender accents. The original Nexlit logo keeps its shape and uses the same pastel palette.

The interface and default search language are English. Spanish queries can optionally be translated through MyMemory. Graph creation compares a larger candidate pool and can return fewer nodes when too few matches are confirmed. See [how search works](docs/search.md) and the [evaluation checklist](docs/search-evaluation.md).

## Data and current limits

Your library is saved in this browser on this site, without an account or cloud sync. Export a JSON backup before clearing browser data or moving to another device.

Searches and metadata requests contact OpenAlex and Crossref; Spanish translation sends the query to MyMemory. These features need internet access and depend on service availability and limits.

For reliable search, open **Search papers → OpenAlex access** and add your [free personal OpenAlex API key](https://openalex.org/settings/api) after verifying your email. Anonymous searches share a daily network budget; once exhausted, waiting a few seconds will not help. The key stays in this browser tab’s session, is sent only to OpenAlex, and is excluded from library exports. Remove it with **Remove key**. Search responses are cached in memory for 15 minutes.

Topic links and reading suggestions use metadata and simple heuristics. A topic link does not necessarily mean a citation. Summaries extract sentences from available abstracts, rather than analyzing full papers. This is a working prototype with further improvements planned.

## Development

The complete static app is in `dist/`; edit those files directly. Any static web host can serve that folder. Tests are in `tests/` and use mocked services and DOM elements.

With Node.js 22 or later, run:

```sh
npm test
```

GitHub Actions runs the tests on Node.js 22 and 24 for pull requests and updates to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and review workflow.

Open Sans font files and their license are included in `dist/fonts/`.
