# Learning from zero

With **Learn from scratch**, Nexlit builds a sequence of learning objectives and searches for missing prerequisites. It no longer mixes introductory and advanced papers using percentages.

## Using it

1. Enter your target topic and enable **Learn from scratch**.
2. Review **Foundation area**. Nexlit suggests a broader area from OpenAlex's topic hierarchy, or the first query concept when the hierarchy is unavailable. You can edit it in English before creating the path.
3. Set a maximum number of readings and a candidate-pool budget, then choose **Create learning path**.
4. Open **Reading path** to inspect each objective, its prerequisites and the abstract excerpt under **Why this reading?**

The graph shows the same topic and citation connections as an imported bibliography, including in learning mode. Selecting a reading adds only the arrow from that reading to the next step. Closing its card or pausing the reading path removes that arrow while keeping the graph connections visible. The last reading has no outgoing reading arrow. Reading-order arrows do not indicate citations.

The five stages organize the route; they do not limit it to five readings. Nexlit first establishes a reachable progression with its prerequisite readings, then adds complementary material within stages toward your requested count (up to 200). Repeated DOI/title records and readings without additional content do not fill the route. The selected count can remain below the target when the loaded candidate pool lacks supported, complementary material; this does not mean the topic has little published literature.

## Objectives and dependencies

| Stage | Goal | Requires |
| --- | --- | --- |
| Orientation | Understand the foundation area's purpose and vocabulary | No prior domain stage |
| Foundations | Learn its basic concepts | Orientation |
| Methods | Understand how the subject is studied | Foundations |
| Applications | Connect fundamentals and methods to the target topic | Foundations and methods |
| Advanced | Explore specialized questions, limitations and open problems | Applications |

Orientation, foundations and methods can use broader material from the foundation area. Applications and advanced readings must match the original target query. Explicit exclusions are retained in broader searches. Complex exclusions inside OR branches are applied conservatively to the broader searches.

For later stages, Nexlit also requires shared content terms with prerequisite readings, excluding generic wording and the foundation area's name. The proposed transition identifies those shared terms. A generic methods paper with no content connection to the foundations cannot provide an automatic bridge just because its label is “Methods”.

## Evidence and gaps

Teaching roles are estimated from title and abstract cues. A usable abstract must contain at least 60 characters, with an evidence sentence of at least 40 characters supporting the role. A title alone, a publication's review type, or a short bibliographic citation does not establish a beginner entry. Advanced cues take precedence over introductory wording.

Explicit assumed knowledge such as “requires prior knowledge of calculus” is recorded. It blocks automatic inclusion unless that named area has already been covered as the foundation subject. Nexlit does not assume that every concept mentioned in an abstract has been taught.

Missing stages receive search priority. Once all stages are covered, Nexlit continues the original target search and stage-specific searches until the requested reading count is reached, sources are exhausted or the request budget is used. Each stage-specific search makes at most two page requests. A missing prerequisite blocks advancement to later stages, while supported earlier stages can still gain complementary readings. The selected candidate pool allows up to one page request per 20 candidates, with a maximum of 25 requests. Learning expansion replaces normal graph expansion rather than running both. Cancellation and the 60-second operation timeout still apply.

A partial path contains only its supported stages, with potentially several readings per stage. Later readings are withheld when an earlier bridge is missing. If no beginner entry is found, no learning graph is created and the existing library/path stays intact. The preview and saved reading panel identify missing stages. Reordering or removing prerequisite readings produces a review message. Teaching evidence, content bridges and gap information survive JSON export/import.

## What still needs review

These are deterministic metadata rules, not a semantic assessment of prerequisites or a guarantee that the selected readings teach an entire field. Shared words are evidence of a possible connection, not proof of teaching continuity. Abstract wording, missing metadata and technical prerequisites not stated in an abstract can cause errors. A broader foundation area can also be too broad for the target; review the suggested area and selected readings.

The automated tests cover synthetic complete and partial paths, misleading reviews, missing abstracts, unrelated methods, explicit assumed knowledge, cancellation, and persistence. Real-publication paths still need human evaluation.

A small live check of the first 20 introductory results in two areas found a supported initial segment for graph theory and no supported beginner entry for solar energy. The latter correctly produced no automatic route. These checks validate query handling and conservative gaps; they are not an evaluation of educational quality.
