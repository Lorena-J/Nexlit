# Contributing to Nexlit

Keep `main` as the reviewed version of the app. Use a short-lived branch with a descriptive name, such as `feature/search-learning-paths` or `fix/search-cancellation`.

1. Make a focused change and update the relevant documentation.
2. Run `npm test` with Node.js 22 or later. Test affected interactions in the browser as well: the automated tests use mocked DOM elements and services.
3. Commit with a message describing the change, then push the branch.
4. Open a draft pull request explaining the behavior, validation and remaining limitations.
5. Review the diff and confirm both GitHub Actions checks pass. Mark the PR ready once the outstanding manual review is complete.
6. Merge into `main` when ready, then remove the completed branch.

Solo work follows the same process; a second reviewer is not required by this guide. Use tags/releases to identify published versions, rather than keeping a permanent branch for each version.

For search or learning-path changes, use the [search evaluation checklist](docs/search-evaluation.md) and inspect prerequisite transitions in the [learning-path guide](docs/learning-paths.md). Passing synthetic tests does not establish real-world relevance or teaching quality.
