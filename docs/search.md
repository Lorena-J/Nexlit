# How search works

Nexlit searches OpenAlex titles, abstracts and keywords. It keeps the proposed query visible and editable. It does not interpret a project semantically or add synonyms automatically.

## Query modes

For `"social memory" hippocampus sleep`:

| Mode | Generated query |
| --- | --- |
| Precise | `"social memory" AND hippocampus AND sleep` |
| Balanced (default) | `"social memory" AND (hippocampus OR sleep)` |
| Exploratory | `"social memory" OR hippocampus OR sleep` |

Balanced uses the first concept as the anchor. With two concepts it requires both; with one it requires that concept. Reorder the input to choose another anchor. Words in quotes stay together. Plain-language filler words are removed; this is a deterministic word parser, not a language model.

An explicit query such as `("social memory" OR "social recognition") AND hippocampus NOT sleep` overrides the mode. Nexlit supports quoted phrases, parentheses and uppercase AND/OR/NOT, with NOT before AND before OR. Adjacent concepts imply AND. Other advanced syntax, such as wildcards and proximity operators, is rejected with an explanation. Boolean queries have a 32-positive-concept / 3,000-encoded-character limit. Only English results are retained. Spanish input can be translated with MyMemory; review the English query, particularly its phrases and operators.

## Ranking and graph selection

1. OpenAlex returns pages of 20 candidates with its relevance score.
2. Nexlit removes duplicates by DOI, identifier or normalized title.
3. It checks the Boolean query against the available title, abstract and keywords, with simple plural matching. Phrases must occur within one field. Candidates whose metadata does not confirm the query stay visible for manual inspection, but are excluded from automatic graph selection.
4. Confirmed matches are ordered using **55% provider relevance, 30% positive-concept coverage and 15% title coverage**. Provider relevance is log-normalized against the highest score in the loaded pool. These are initial heuristic weights, not a calibrated probability. If provider scores are missing, retrieval order supplies a fallback.
5. Before creating a graph, the main search expands toward a pool of 100, 200 or 500 candidates, selected in the dialog. The pool target is at least the requested node count. Expansion is bounded by the corresponding provider pages, even if responses contain duplicates. Any candidates already loaded remain available to rank.
6. The best confirmed matches are selected, up to the requested count. A smaller graph is allowed when too few candidates qualify. With no confirmed matches, Nexlit asks you to refine the search. It never silently broadens the query.

Each search or graph comparison has a 60-second timeout and can be canceled. Changing the query, mode or input language invalidates old candidates. A failed expansion keeps previously loaded results for retry.

## Current limits

Local matching is deliberately simpler than OpenAlex's stemming and keyword expansion. Missing abstracts, synonyms and word variants can cause a relevant provider result to fail local confirmation. Review these results manually; the graph's confirmed count is not a measure of scientific relevance or quality. Multiple alternatives in an OR group still count as separate concepts in the ranking coverage component.

Learning mode uses a separate objective-driven planner. It searches a visible, editable foundation area before the narrow target, checks abstract evidence and content bridges, and stops at missing prerequisites. It creates partial paths without advanced quotas. See [learning paths](learning-paths.md) for the stage model, search budget and limitations.

Dates, publication-type filters, semantic matching and human-validated prerequisite estimates remain future work. See [the evaluation checklist](search-evaluation.md) before changing ranking weights.

OpenAlex API behavior is documented in its [search guide](https://help.openalex.org/api/searching/).
