/**
 * build_legal_stance — Build a comprehensive set of citations for a legal question.
 */

import type Database from '@ansvar/mcp-sqlite';
import { buildFtsQueryVariants, buildLikePattern, sanitizeFtsInput } from '../utils/fts-query.js';
import { resolveDocumentId } from '../utils/statute-id.js';
import { generateResponseMetadata, type ToolResponse, type CitationRef } from '../utils/metadata.js';

export interface BuildLegalStanceInput {
  query: string;
  document_id?: string;
  limit?: number;
}

export interface LegalStanceResult {
  document_id: string;
  document_title: string;
  provision_ref: string;
  section: string;
  title: string | null;
  snippet: string;
  relevance: number;
  _citation?: CitationRef;
}

const RESEARCH_DISCLAIMER =
  'FOR RESEARCH ONLY — Not legal advice. Verify all citations against official Nepal Law Commission sources before use.';

function metaWithDisclaimer(db: InstanceType<typeof Database>, extra?: Record<string, string>) {
  return { ...generateResponseMetadata(db), disclaimer: RESEARCH_DISCLAIMER, ...extra };
}

function addCitations(rows: LegalStanceResult[]): LegalStanceResult[] {
  return rows.map(r => ({
    ...r,
    _citation: {
      canonical_ref: `s${r.provision_ref.replace(/^(?:s|art)/, '')}, ${r.document_title}`,
      lookup_tool: 'get_provision',
    },
  }));
}

export async function buildLegalStance(
  db: InstanceType<typeof Database>,
  input: BuildLegalStanceInput,
): Promise<ToolResponse<LegalStanceResult[]>> {
  if (!input.query || input.query.trim().length === 0) {
    return { results: [], _meta: metaWithDisclaimer(db) };
  }

  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
  const fetchLimit = limit * 2;
  const queryVariants = buildFtsQueryVariants(sanitizeFtsInput(input.query));

  // Resolve document_id from title if provided
  let resolvedDocId: string | undefined;
  if (input.document_id) {
    const resolved = resolveDocumentId(db, input.document_id);
    resolvedDocId = resolved ?? undefined;
    if (!resolved) {
      return {
        results: [],
        _meta: {
          ...metaWithDisclaimer(db),
          note: `No document found matching "${input.document_id}"`,
        },
      };
    }
  }

  let queryStrategy = 'none';
  for (const ftsQuery of queryVariants) {
    let sql = `
      SELECT
        lp.document_id,
        ld.title as document_title,
        lp.provision_ref,
        lp.section,
        lp.title,
        snippet(provisions_fts, 0, '>>>', '<<<', '...', 48) as snippet,
        bm25(provisions_fts) as relevance
      FROM provisions_fts
      JOIN legal_provisions lp ON lp.id = provisions_fts.rowid
      JOIN legal_documents ld ON ld.id = lp.document_id
      WHERE provisions_fts MATCH ?
    `;
    const params: (string | number)[] = [ftsQuery];

    if (resolvedDocId) {
      sql += ' AND lp.document_id = ?';
      params.push(resolvedDocId);
    }

    sql += ' ORDER BY relevance LIMIT ?';
    params.push(fetchLimit);

    try {
      const rows = db.prepare(sql).all(...params) as LegalStanceResult[];
      if (rows.length > 0) {
        queryStrategy = ftsQuery === queryVariants[0] ? 'exact' : 'fallback';
        const deduped = addCitations(deduplicateResults(rows, limit));
        return {
          results: deduped,
          _meta: metaWithDisclaimer(
            db,
            queryStrategy === 'fallback' ? { query_strategy: 'broadened' } : undefined,
          ),
        };
      }
    } catch {
      continue;
    }
  }

  // LIKE fallback — last resort when all FTS5 variants return empty
  {
    const likePattern = buildLikePattern(sanitizeFtsInput(input.query));
    let sql = `
      SELECT
        lp.document_id,
        ld.title as document_title,
        lp.provision_ref,
        lp.section,
        lp.title,
        substr(lp.content, 1, 300) as snippet,
        0 as relevance
      FROM legal_provisions lp
      JOIN legal_documents ld ON ld.id = lp.document_id
      WHERE lp.content LIKE ? COLLATE NOCASE
    `;
    const likeParams: (string | number)[] = [likePattern];

    if (resolvedDocId) {
      sql += ' AND lp.document_id = ?';
      likeParams.push(resolvedDocId);
    }

    sql += ' LIMIT ?';
    likeParams.push(fetchLimit);

    try {
      const rows = db.prepare(sql).all(...likeParams) as LegalStanceResult[];
      if (rows.length > 0) {
        return {
          results: addCitations(deduplicateResults(rows, limit)),
          _meta: metaWithDisclaimer(db, { query_strategy: 'like_fallback' }),
        };
      }
    } catch {
      // LIKE query failed — fall through to empty return
    }
  }

  return { results: [], _meta: metaWithDisclaimer(db) };
}

/**
 * Deduplicate results by document_title + provision_ref.
 * Duplicate document IDs (numeric vs slug) cause the same provision to appear twice.
 */
function deduplicateResults(
  rows: LegalStanceResult[],
  limit: number,
): LegalStanceResult[] {
  const seen = new Set<string>();
  const deduped: LegalStanceResult[] = [];
  for (const row of rows) {
    const key = `${row.document_title}::${row.provision_ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= limit) break;
  }
  return deduped;
}
