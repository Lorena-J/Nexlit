# Search evaluation checklist

The automated tests cover controlled examples and interaction regressions. They do **not** establish improved relevance on real publications. This checklist is the starting set for a human-reviewed baseline.

Run each query in Precise mode with a 100-candidate pool. Record the date, query, retrieved IDs and order, and label the first 10 candidates as **useful**, **uncertain** or **irrelevant** after reading their titles and abstracts. Keep uncertain judgments separate. Save the same candidate metadata to compare later ranking changes without changes in OpenAlex affecting the comparison.

| # | Query | What a useful result should address |
| --- | --- | --- |
| 1 | `"social memory" AND hippocampus` | Hippocampal involvement in social memory |
| 2 | `sleep AND "memory consolidation"` | Sleep's relationship to consolidation |
| 3 | `"graph theory" AND introduction` | Introductory graph theory |
| 4 | `"programming education" AND beginners` | Learning programming as a beginner |
| 5 | `"machine learning" AND interpretability` | Interpreting machine learning models |
| 6 | `"solar energy" AND storage` | Storing energy from solar sources |
| 7 | `"lithium battery" AND degradation` | Causes or measurement of battery degradation |
| 8 | `"climate change" AND agriculture` | Agricultural effects or adaptation |
| 9 | `"medieval history" AND trade` | Trade in the medieval period |
| 10 | `inflation AND "monetary policy"` | The relationship between policy and inflation |
| 11 | `"urban planning" AND walkability` | Planning choices and walkability |
| 12 | `"language acquisition" AND bilingualism` | Bilingual language acquisition |
| 13 | `"water quality" AND microplastics` | Microplastics and water quality |
| 14 | `"supply chain" AND resilience` | Supply-chain resilience |
| 15 | `"remote work" AND productivity` | Productivity under remote working arrangements |
| 16 | `"music education" AND motivation` | Motivation in learning music |
| 17 | `"computer vision" AND agriculture` | Agricultural applications of computer vision |
| 18 | `"renewable energy" AND (wind OR solar)` | Wind or solar renewable energy |
| 19 | `("social memory" OR "social recognition") AND hippocampus` | Relevant alternative terminology |
| 20 | `"graph theory" NOT "neural network"` | Graph-theory work outside the excluded topic |

For each query, report useful results / 10 (**precision@10**, with missing slots counting as not useful), number retrieved, number locally confirmed, graph size, latency and API requests. If known relevant papers are available, record their IDs before testing and track whether they appear in the candidate pool. Investigate failures before expanding the set or tuning weights.

Also repeat selected queries in Balanced and Exploratory modes. Check that broader retrieval adds useful coverage rather than merely increasing the result count. Include cases with no abstracts, plural variants, near-matching phrases, preprints and highly cited off-topic papers.

No real-publication relevance judgments have been recorded yet. Synthetic passing tests must not be reported as a precision improvement on this set.
