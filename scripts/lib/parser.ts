/**
 * Nepal Law HTML Parser (STUB)
 *
 * This parser must be implemented for the specific jurisdiction's
 * HTML structure. It should parse legislation pages from the
 * official source and extract provisions in the standard format.
 *
 * Source: lawcommission.gov.np
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: string;
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

export function parseHtml(_html: string, _act: ActIndexEntry): ParsedAct {
  throw new Error(
    'Parser not yet implemented for Nepal. ' +
    'Implement this function to parse HTML from lawcommission.gov.np.'
  );
}
