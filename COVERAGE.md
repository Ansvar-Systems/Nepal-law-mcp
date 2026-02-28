# Coverage Index -- Nepal Law MCP

> Auto-generated from census and database data. Do not edit manually.
> Generated: 2026-02-28

## Source

| Field | Value |
|-------|-------|
| Authority | Government of Nepal, Nepal Law Commission |
| Portal | [lawcommission.gov.np](https://lawcommission.gov.np) |
| License | Government Open Data |
| Census date | 2026-02-27 |
| Content format | PDF (GIWMS CMS flipbook), extracted via pdftotext |
| Language | Nepali (Devanagari), some English translations |

## Summary

| Metric | Count |
|--------|-------|
| Total laws enumerated | 1,181 |
| Ingestable (have content URLs) | 701 |
| Ingested (fetched and parsed) | 447 |
| Excluded (duplicates) | 333 |
| Inaccessible (no URL or HTTP error) | 147 |
| Provisions extracted | 19,293 |
| Definitions extracted | 49 |
| **Coverage (ingested / ingestable)** | **63.8%** |

## Categories

| Category | Count |
|----------|-------|
| Acts (ऐन) | 596 |
| Rules (नियमावली) | 194 |
| Other (विधेयक, etc.) | 358 |
| Ordinances (अध्यादेश) | 13 |
| Orders (आदेश) | 10 |
| Constitution (संविधान) | 10 |

## Top Statutes by Provision Count

| # | Statute | Provisions |
|---|---------|-----------|
| 1 | Environment Protection Rules, 2056 | 432 |
| 2 | Convention on Aboriginal and Tribal Peoples | 391 |
| 3 | Civil Code (मुलुकी देवानी संहिता), 2074 | 336 |
| 4 | Nepal Bank Act, 1994 | 320 |
| 5 | Criminal Code (मुलुकी अपराध संहिता), 2074 | 309 |
| 6 | Geneva Convention (Third) | 257 |
| 7 | Fourth Convention Relating to Protection of Civilian Persons | 229 |
| 8 | Education Regulation, 2059 | 222 |
| 9 | Adikavi Bhanubhakta Birthplace Development | 219 |
| 10 | Police Regulation, 2071 | 214 |

## Ingestion Notes

- Content is served as PDF flipbooks embedded in GIWMS CMS pages
- PDF text extraction uses `pdftotext -layout` (poppler-utils)
- Parser handles Nepali (Devanagari) section markers: दफा (Section), परिच्छेद (Chapter)
- Some sections are numbered with Devanagari numerals (e.g., १, २, ३)
- The Nepal Law Commission site occasionally returns HTTP 403 under load; re-running ingestion with `--resume` picks up where it left off
- Coverage can be increased by re-running ingestion at different times (site availability varies)
