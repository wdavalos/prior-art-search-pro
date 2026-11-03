# Prior Art Search Pro (Google Patents, Legal Status)

Run it on the Apify Store: https://apify.com/red.cars/prior-art-search-pro

> Free tier tip: same data on ScraperFleet - https://scraperfleet.com/actors/prior-art-search-pro/


Search the Google Patents index for prior art: keyword queries plus assignee, inventor, CPC class, priority-date window, granted/application status, patent vs. design, country and language filters. Flat rows with title, abstract snippet, dates, assignee, inventor, publication number, Google Patents URL, PDF and legal status. $0.005/run + $2.00 per 1,000 rows.

## Why this actor

- **No login, no API key, no proxy.** Reads the public Google Patents search endpoint directly (plain HTTPS fetch, datacenter-friendly).
- **Filters that matter for prior art:** assignee, inventor, CPC class, priority date before/after (YYYYMMDD), granted vs. application, patent vs. design, country, language, newest-first or relevance.
- **Legal status per row:** family status and an `familyActive` boolean folded in from the index, so you can triage live patents vs. dead ones without opening every PDF.
- **Flat, predictable pricing:** $0.005 per run + $0.002 per row ($2.00 per 1,000). No enrichment tiers, no hidden per-event costs.
- **Clean rows:** HTML entities and highlight tags stripped; hard result caps (index itself caps any single query at 1,000 results); zero-result runs push one hint row (status ZERO_RESULTS) instead of charging you for nothing.

## Comparison

| Actor | 30-day users | Pricing | Notes |
|---|---|---|---|
| **prior-art-search-pro (this)** | new | $0.005/run + $2.00/1k rows, flat | filters + legal status, no proxy, no tiers |
| khadinakbar/google-patents-scraper | 56 | $2.00/1k basic, $5.00/1k detailed (per-event tiers) | tiered enrichment pricing; paid events per depth |
| constructive_calm/google-patents-intelligence | 5 | $0.01/run + $2–8/1k per event | higher start cost, fewer users |
| nexgendata/uspto-patent-search | 1 | per-result event pricing | tiny user base |

Sources: Apify Store listings and public run stats, Oct 30, 2026.

## Input

| Field | Type | Notes |
|---|---|---|
| `query` | string | Keyword query, e.g. `machine learning` or `cpc:G06F battery` |
| `maxResults` | number | 1–1000, default 10 (index caps any query at 1,000) |
| `assignee` | string | e.g. `Tesla` |
| `inventor` | string | e.g. `Muddu` |
| `cpc` | string | e.g. `G06F` |
| `before` / `after` | string | Priority-date window, YYYYMMDD |
| `status` | select | GRANT or APPLICATION |
| `type` | select | PATENT or DESIGN |
| `country` | string | e.g. `US` |
| `language` | string | e.g. `en` |
| `sortBy` | select | relevance (default) or newest |

## Output

One row per patent: `title`, `publicationNumber`, `url`, `snippet`, `assignee`, `inventor`, `priorityDate`, `filingDate`, `grantDate`, `publicationDate`, `language`, `country`, `legalStatus` (per-country state, e.g. ACTIVE), `familyActive`.

Zero-result runs push one row `{status: "ZERO_RESULTS", reason: ...}`. Nothing is charged for it.

## Pricing

- Actor start: **$0.005** per run.
- Result row: **$0.002** per row = **$2.00 per 1,000 rows**.
- No proxy. Platform usage is not billed to the user; our cost per 1,000 rows is far below price, so the actor never runs at negative margin.

## Pair it with Academic Research MCP

Cover both sides of a prior-art check: [Academic Research MCP](https://apify.com/red.cars/academic-research-mcp) searches 600M+ papers, grants, and citations across CrossRef, OpenAlex, PubMed and DBLP, while this actor pulls the patent record from Google Patents with legal status. One agent, two tool calls, literature plus patents.

## FAQ

**Do I need an API key?** No. The Google Patents search endpoint is public.

**Is there a result cap?** Yes, 1,000 rows per query, capped by the source index itself. For broad queries, narrow with assignee, CPC or date filters.

**How fresh is the data?** The index updates continuously; sortBy=newest returns latest publications first.

**Can I search by company?** Yes, use `assignee` (e.g. `Tesla`) alone or combined with `query`.

**What is `familyActive`?** True when the patent family's best stage is active in at least one country, folded in from the index's family metadata.
