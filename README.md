# Nexlit

Explore research papers through interactive graphs and reading paths.
Nexlit is an early version built with plain HTML, CSS and JavaScript: no build step required. The optional local server provides the ChatGPT connection.

## Run locally

With Node.js 22 or later, run this from the project folder:

```sh
npm start
```

Open [localhost:8000](http://localhost:8000). The welcome screen opens without a graph. Search for papers, import a bibliography, or choose **Continue exploring your library** to return to saved work. A sample BibTeX file is available at `dist/example.bib`.

On the first visit in each browser tab, only the original Nexlit logo and “Follow your curiosity.” appear in the center. After 0.6 seconds, they move upward and shrink together over a smooth 1-second transition, settling just above the central actions. Once they arrive, “Find your first connection” and “Continue exploring your library” fade in side by side in the center of the screen. Continue is disabled until a library is available. The header is hidden on the welcome screen and returns in the graph view. The introduction does not replay when returning home in that tab; reduced motion shows the final layout immediately.

## What you can do

- Choose **Find your first connection**, enter an English topic or Boolean query in the single **What would you like to explore?** field, then choose **Search papers**. Connect ChatGPT when prompted; the search continues after sign-in and the plan-use acknowledgement. You can also import BibTeX or Nexlit JSON libraries.
- Explore a charcoal, sage and lavender constellation with subtle connections and softly shaded nodes. Hover or select a paper to emphasize its relationships. Zoom reveals more labels. Rotation pauses during interaction; overlap adjustments wait until rotation stops, then settle smoothly, pausing on article hover. Open a node to explore a paper.
- Build a reading path, reorder papers and track what you have read.
- Turn on **Learn from scratch** to reveal the **Knowledge area** field. The planner builds a staged path from orientation to advanced readings; the reading panel shows progress and gaps after creation. See [learning paths](docs/learning-paths.md).
- Fetch abstracts and citation metadata from Crossref, and generate short extractive abstract summaries.

The welcome screen, search dialog and graph use a charcoal background with soft sage and lavender accents. The original Nexlit logo keeps its shape and uses the same pastel palette.

Below the two main welcome actions, **Connect ChatGPT** and **Import bibliography** appear as smaller sage outlined buttons that fill on hover or keyboard focus. Import supports BibTeX and Nexlit JSON. In the graph view, connection settings stay in the header and **Library actions** contains Search and Import bibliography.

**Search papers** requires the local Node.js service and a ChatGPT connection. If already connected, the search proceeds directly. Canceling or closing sign-in keeps the query without searching. A static preview can still import and explore bibliographies, but cannot sign in or run a new search. See [connection details](docs/chatgpt.md).

The interface, input and results are English; there is no language selector or automatic translation. Search uses Balanced matching internally, and explicit Boolean syntax can be entered directly. Graph creation compares a larger candidate pool and can return fewer nodes when too few matches are confirmed. See [how search works](docs/search.md) and the [evaluation checklist](docs/search-evaluation.md).

## Data and current limits

Your library is saved in this browser on this site, without an account or cloud sync. Keep your original bibliography files before clearing browser data or moving to another device.

Searches and metadata requests contact OpenAlex and Crossref. These features need internet access and depend on service availability and limits. Connecting ChatGPT does not replace the bibliographic provider or its request quota.

OpenAlex access controls are no longer shown in the simplified search dialog. Anonymous requests share a daily network budget; an exhausted budget is shown as an error. An existing personal key in this tab's session continues to be used, but the dialog cannot add or remove keys. Search responses are cached in memory for 15 minutes.

Topic links and reading suggestions use metadata and simple heuristics. A topic link does not necessarily mean a citation. Summaries extract sentences from available abstracts, rather than analyzing full papers. This is a working prototype with further improvements planned.

## Development

The browser app is in `dist/`; edit those files directly. The loopback Node.js service in `server/` serves it and handles ChatGPT sign-in. Tests are in `tests/` and use mocked services and DOM elements; authentication tests also use signed synthetic credentials and a local HTTP server.

With Node.js 22 or later, run:

```sh
npm test
```

GitHub Actions runs the tests on Node.js 22 and 24 for pull requests and updates to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and review workflow.

Open Sans font files and their license are included in `dist/fonts/`.
