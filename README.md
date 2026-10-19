# Nexlit

Explore research papers through interactive graphs and reading paths.
Nexlit is an early version built with plain HTML, CSS and JavaScript: no build step or backend required.

## Run locally

With Python 3 installed, run this from the project folder:

```sh
python3 -m http.server 8000 --directory dist
```

Open [localhost:8000](http://localhost:8000). An example library loads automatically.

## What you can do

- Search OpenAlex with Precise, Balanced or Exploratory mode; keep phrases in quotes and edit Boolean queries. You can also import BibTeX or Nexlit JSON libraries.
- Rotate and zoom the graph, filter by topic, and open a node to explore a paper.
- Build a reading path, reorder papers and track what you have read.
- Use **Learn from scratch** to build a staged path from orientation to advanced readings, with prerequisites and visible gaps. See [learning paths](docs/learning-paths.md).
- Fetch abstracts and citation metadata from Crossref, and generate short extractive abstract summaries.
- Export your library, including reading progress, as JSON.

The interface and default search language are English. Spanish queries can optionally be translated through MyMemory. Graph creation compares a larger candidate pool and can return fewer nodes when too few matches are confirmed. See [how search works](docs/search.md) and the [evaluation checklist](docs/search-evaluation.md).

## Data and current limits

Your library is saved in this browser on this site, without an account or cloud sync. Export a JSON backup before clearing browser data or moving to another device.

Searches and metadata requests contact OpenAlex and Crossref; Spanish translation sends the query to MyMemory. These features need internet access and depend on service availability and limits.

Topic links and reading suggestions use metadata and simple heuristics. A topic link does not necessarily mean a citation. Summaries extract sentences from available abstracts, rather than analyzing full papers. This is a working prototype with further improvements planned.

## Development

The complete static app is in `dist/`; edit those files directly. Any static web host can serve that folder. Tests are in `tests/` and use mocked services and DOM elements.

With Node.js 22 or later, run:

```sh
npm test
```

GitHub Actions runs the tests on Node.js 22 and 24 for pull requests and updates to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and review workflow.

Open Sans font files and their license are included in `dist/fonts/`.
