/**
 * get_provision — Retrieve specific provision(s) from a Nepalese statute.
 */

import type Database from '@ansvar/mcp-sqlite';
import { resolveDocumentId } from '../utils/statute-id.js';
import { generateResponseMetadata, type ToolResponse, type CitationRef } from '../utils/metadata.js';

export interface GetProvisionInput {
  document_id: string;
  section?: string;
  provision_ref?: string;
  as_of_date?: string;
}

export interface ProvisionResult {
  document_id: string;
  document_title: string;
  provision_ref: string;
  chapter: string | null;
  section: string;
  title: string | null;
  content: string;
  article_number?: string;
  url?: string;
  _citation: CitationRef;
}

export async function getProvision(
  db: InstanceType<typeof Database>,
  input: GetProvisionInput,
): Promise<ToolResponse<ProvisionResult[]>> {
  const resolvedId = resolveDocumentId(db, input.document_id);
  if (!resolvedId) {
    return {
      results: [],
      _meta: {
        ...generateResponseMetadata(db),
        ...{ note: `No document found matching "${input.document_id}"` },
      },
      _error_type: 'not_found',
    };
  }

  const docRow = db.prepare(
    'SELECT id, title, url FROM legal_documents WHERE id = ?'
  ).get(resolvedId) as { id: string; title: string; url: string | null } | undefined;
  if (!docRow) {
    return { results: [], _meta: generateResponseMetadata(db), _error_type: 'not_found' };
  }

  // Specific provision lookup
  const ref = input.provision_ref ?? input.section;
  if (ref) {
    // Strip subsection references: "13(1)" -> "13", "s13(2)(a)" -> "s13"
    const refTrimmed = ref.trim().replace(/(\([\dA-Za-z]+\))+$/, '');

    // Try direct provision_ref match
    let provision = db.prepare(
      'SELECT * FROM legal_provisions WHERE document_id = ? AND provision_ref = ?'
    ).get(resolvedId, refTrimmed) as Record<string, unknown> | undefined;

    // Try with "s" prefix (e.g., "1" -> "s1") — Nepalese "Section" convention
    if (!provision) {
      provision = db.prepare(
        'SELECT * FROM legal_provisions WHERE document_id = ? AND provision_ref = ?'
      ).get(resolvedId, `s${refTrimmed}`) as Record<string, unknown> | undefined;
    }

    // Try with "art" prefix (e.g., "1" -> "art1") — for Constitution articles
    if (!provision) {
      provision = db.prepare(
        'SELECT * FROM legal_provisions WHERE document_id = ? AND provision_ref = ?'
      ).get(resolvedId, `art${refTrimmed}`) as Record<string, unknown> | undefined;
    }

    // Try section column match
    if (!provision) {
      provision = db.prepare(
        'SELECT * FROM legal_provisions WHERE document_id = ? AND section = ?'
      ).get(resolvedId, refTrimmed) as Record<string, unknown> | undefined;
    }

    // Try LIKE match for flexible input
    if (!provision) {
      provision = db.prepare(
        "SELECT * FROM legal_provisions WHERE document_id = ? AND (provision_ref LIKE ? OR section LIKE ?)"
      ).get(resolvedId, `%${refTrimmed}%`, `%${refTrimmed}%`) as Record<string, unknown> | undefined;
    }

    if (provision) {
      const provRef = String(provision.provision_ref);
      return {
        results: [{
          document_id: resolvedId,
          document_title: docRow.title,
          provision_ref: provRef,
          chapter: provision.chapter as string | null,
          section: String(provision.section),
          title: provision.title as string | null,
          content: String(provision.content),
          article_number: provRef.replace(/^(?:s|art)/, ''),
          url: docRow.url ?? undefined,
          _citation: {
            canonical_ref: `s${provRef.replace(/^(?:s|art)/, '')}, ${docRow.title}`,
            lookup_tool: 'get_provision',
          },
        }],
        _meta: generateResponseMetadata(db),
      };
    }

    return {
      results: [],
      _meta: {
        ...generateResponseMetadata(db),
        ...{ note: `Provision "${ref}" not found in document "${resolvedId}"` },
      },
      _error_type: 'not_found',
    };
  }

  // Return all provisions for the document
  const provisions = db.prepare(
    'SELECT * FROM legal_provisions WHERE document_id = ? ORDER BY id'
  ).all(resolvedId) as Record<string, unknown>[];

  return {
    results: provisions.map(p => {
      const provRef = String(p.provision_ref);
      return {
        document_id: resolvedId,
        document_title: docRow.title,
        provision_ref: provRef,
        chapter: p.chapter as string | null,
        section: String(p.section),
        title: p.title as string | null,
        content: String(p.content),
        article_number: provRef.replace(/^(?:s|art)/, ''),
        url: docRow.url ?? undefined,
        _citation: {
          canonical_ref: `s${provRef.replace(/^(?:s|art)/, '')}, ${docRow.title}`,
          lookup_tool: 'get_provision',
        },
      };
    }),
    _meta: generateResponseMetadata(db),
  };
}
