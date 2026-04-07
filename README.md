# Nepal Law MCP Server

**The Nepal Law Commission alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fnepal-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/nepal-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Nepal-law-mcp?style=social)](https://github.com/Ansvar-Systems/Nepal-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Nepal-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Nepal-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/Nepal-law-mcp)
[![Provisions](https://img.shields.io/badge/provisions-47%2C513-blue)](https://github.com/Ansvar-Systems/Nepal-law-mcp)

Query **696 Nepali statutes** -- from the Muluki Penal Code and Individual Privacy Act to the Labour Act, Company Act, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Nepali legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Nepali legal research is scattered across lawcommission.gov.np, moljpa.gov.np (Ministry of Law, Justice and Parliamentary Affairs), and parliamentary archives. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking if a statute is still in force
- A **legal tech developer** building tools on Nepali law
- A **researcher** tracing provisions across 696 statutes

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Nepali law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-np/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add nepal-law --transport http https://mcp.ansvar.eu/law-np/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nepal-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-np/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "nepal-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-np/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/nepal-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nepal-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/nepal-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "nepal-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/nepal-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"नेपालमा व्यक्तिगत डाटा सुरक्षा सम्बन्धी कानून के छ?"* (What does Nepal's Individual Privacy Act say about personal data?)
- *"मुलुकी अपराध संहिताको धारा ३१४ के भन्छ?"* (What does Section 314 of the Muluki Penal Code say?)
- *"श्रमिकको अधिकार सम्बन्धी कानून खोज्नुहोस्"* (Search for provisions on labour rights in Nepal)
- *"Find provisions in the Muluki Civil Code related to property rights"*
- *"What does the Company Act say about director liability?"*
- *"Search for labour rights under Nepal's Labour Act 2074"*
- *"Is the Individual Privacy Act 2075 still in force?"*
- *"Validate the citation 'Labour Act 2074, Section 6'"*
- *"Build a legal stance on data protection obligations under Nepali law"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 696 statutes | Comprehensive Nepali legislation |
| **Provisions** | 47,513 sections | Full-text searchable with FTS5 |
| **Database Size** | ~79 MB | Optimized SQLite, portable |
| **Data Sources** | lawcommission.gov.np | Nepal Law Commission official publications |
| **Languages** | Nepali and English | Official bilingual statute texts |
| **Freshness Checks** | Automated | Drift detection against official sources |

**Verified data only** -- every citation is validated against official sources (Nepal Law Commission, Ministry of Law, Justice and Parliamentary Affairs). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from lawcommission.gov.np and moljpa.gov.np official publications
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by act name and section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
lawcommission.gov.np --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                          ^                        ^
                   Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search lawcommission.gov.np by act name | Search by plain language: *"data protection consent"* |
| Navigate multi-chapter statutes manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "Is this statute still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find international alignment -- dig manually | `get_eu_basis` -- linked frameworks instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Browse lawcommission.gov.np --> Download PDF --> Ctrl+F --> Cross-reference acts --> Repeat

**This MCP:** *"What are the consent requirements under Nepal's Individual Privacy Act?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 47,513 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by act name and section number |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Nepali legal conventions (full/short/pinpoint) |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks that a Nepali statute aligns with |
| `get_nepali_implementations` | Find Nepali laws aligning with a specific international framework |
| `search_eu_implementations` | Search international documents with Nepali alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Nepali statutes against international standards |

---

## International Law Alignment

Nepal is not an EU member state, but Nepali legislation aligns with key international frameworks:

- **Individual Privacy Act 2075** aligns with core principles of the GDPR and UN Privacy Framework -- consent, data minimisation, purpose limitation
- **Labour Act 2074** reflects ILO core conventions on fundamental labour rights
- **Company Act 2063** draws on UNCITRAL model law principles
- Nepal participates in **SAARC** frameworks and has ratified key **UN conventions** including ICCPR and ICESCR

Nepal's legal system follows a **civil law tradition** influenced by Hindu jurisprudence, with statutes enacted in Nepali (Devanagari script) and official English translations provided by the Law Commission.

The international alignment tools allow you to explore these relationships -- checking which Nepali provisions correspond to international standards, and vice versa.

> **Note:** International cross-references reflect alignment and shared principles, not direct transposition. Nepal adopts its own legislative approach, and the tools help identify where Nepali and international law address similar domains.

---

## Data Sources & Freshness

All content is sourced from authoritative Nepali legal databases:

- **[Nepal Law Commission](https://lawcommission.gov.np/)** -- Official statute repository, Ministry of Law, Justice and Parliamentary Affairs
- **[Ministry of Law, Justice and Parliamentary Affairs](https://moljpa.gov.np/)** -- Legislative publications and gazette notifications

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Nepal Law Commission |
| **Retrieval method** | Official statute downloads from lawcommission.gov.np |
| **Languages** | Nepali (Devanagari) and English |
| **Coverage** | 696 statutes, 47,513 provisions |
| **Database size** | ~79 MB |

### Automated Freshness Checks

A GitHub Actions workflow monitors all data sources:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New statutes** | Comparison against Law Commission index |
| **Repealed statutes** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from Nepal Law Commission official publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **International cross-references** reflect alignment relationships, not transposition
> - **Bilingual system** -- statutes are available in Nepali and English; verify Nepali text against official Law Commission publications

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. Consult the **Nepal Bar Association (नेपाल बार एसोसिएसन)** guidance on client confidentiality obligations.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Nepal-law-mcp
cd Nepal-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest           # Ingest statutes from lawcommission.gov.np
npm run build:db         # Rebuild SQLite database
npm run drift:detect     # Run drift detection against anchors
npm run check-updates    # Check for amendments and new statutes
npm run census           # Generate coverage census
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~79 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

**108 national law MCPs** covering Nepal, India, Bangladesh, Pakistan, Australia, Brazil, Canada, China, Denmark, Finland, France, Germany, Ireland, Israel, Italy, Japan, Kenya, Netherlands, Nigeria, Norway, Singapore, Sweden, Switzerland, Thailand, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Supreme Court of Nepal decisions)
- Historical statute versions and amendment tracking
- Nepali-language full-text search improvements
- Regulation and subsidiary legislation coverage

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (696 statutes, 47,513 provisions)
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Supreme Court case law expansion
- [ ] Historical statute versions (amendment tracking)
- [ ] Regulation and subsidiary legislation
- [ ] Nepali-language query optimisation

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{nepal_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Nepal Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Nepal-law-mcp},
  note = {696 Nepali statutes with 47,513 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Nepal Law Commission (public domain, Government of Nepal)
- **International Metadata:** Public domain

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool -- turns out everyone building for South Asian markets has the same research frustrations.

So we're open-sourcing it. Navigating 696 statutes in both Nepali and English shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
