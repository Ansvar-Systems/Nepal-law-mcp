/**
 * Response metadata utilities for Nepal Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Nepal Law Commission (lawcommission.gov.np) — Government of Nepal',
    jurisdiction: 'NP',
    disclaimer:
      'This data is sourced from the Nepal Law Commission under Government Open Data principles. ' +
      'Always verify with the official Nepal Law Commission portal (lawcommission.gov.np).',
    freshness,
  };
}
