# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-02-22
### Added
- `data/census.json` — full corpus census (11 laws, 1,735 provisions)
- Streamable HTTP transport in `server.json` (Vercel endpoint)
- Keywords array in `server.json` for MCP Registry discoverability

### Changed
- Golden contract tests upgraded to full golden standard — boots real MCP
  server in-process via InMemoryTransport, verifies tool outputs against
  `golden-tests.json` fixture
- Network-dependent assertions (`upstream_text_hash`, `citation_resolves`)
  gated behind `CONTRACT_MODE=nightly` via `it.skipIf` guards
- `server.json` migrated to dual `packages` format (stdio + streamable-http)

## [1.0.0] - 2026-XX-XX
### Added
- Initial release of Nepal Law MCP
- `search_legislation` tool for full-text search across all Nepalese statutes
- `get_provision` tool for retrieving specific articles/sections
- `get_provision_eu_basis` tool for international framework cross-references
- `validate_citation` tool for legal citation validation
- `check_statute_currency` tool for checking statute amendment status
- `list_laws` tool for browsing available legislation
- Contract tests with 12 golden test cases
- Drift detection with 6 stable provision anchors
- Health and version endpoints
- Vercel deployment (single tier bundled)
- npm package with stdio transport
- MCP Registry publishing

[Unreleased]: https://github.com/Ansvar-Systems/nepal-law-mcp/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Ansvar-Systems/nepal-law-mcp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Ansvar-Systems/nepal-law-mcp/releases/tag/v1.0.0
