#!/usr/bin/env tsx
/**
 * Nepal Law MCP -- Census Script
 *
 * Enumerates all laws from lawcommission.gov.np using two sources:
 *   1. Alphabetical index page — 340+ act names (Nepali) with volume references
 *   2. Sitemap XML — content URLs with English slugs and last-modified dates
 *
 * Strategy: The alphabetical index has all acts but no URLs to individual pages.
 * The sitemap has content URLs but only ~200 per page. We merge both sources.
 *
 * Source: lawcommission.gov.np
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *   npx tsx scripts/census.ts --sitemap-only   # Skip alphabetical index (faster)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');
const BASE_URL = 'https://lawcommission.gov.np';
const SITEMAP_URL = `${BASE_URL}/sitemap-news.xml`;
const ALPHA_INDEX_URL = `${BASE_URL}/pages/alphabetical-index-of-acts/`;

const USER_AGENT = 'nepal-law-mcp/1.0 (https://github.com/Ansvar-Systems/nepal-law-mcp; hello@ansvar.ai)';

/* ---------- Types ---------- */

interface CensusLawEntry {
  id: string;
  title: string;
  title_en: string;
  identifier: string;
  url: string;
  status: 'in_force' | 'amended' | 'repealed';
  category: 'act' | 'regulation' | 'ordinance' | 'order' | 'constitution' | 'rules' | 'other';
  classification: 'ingestable' | 'excluded' | 'inaccessible';
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
  volume: string;
  bs_year: string;
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  census_date: string;
  agent: string;
  summary: {
    total_laws: number;
    ingestable: number;
    ocr_needed: number;
    inaccessible: number;
    excluded: number;
  };
  laws: CensusLawEntry[];
}

/* ---------- Helpers ---------- */

/** Convert Devanagari numerals to Arabic */
function devanagariToArabic(str: string): string {
  return str.replace(/[०-९]/g, (ch) => {
    return String(ch.charCodeAt(0) - 0x0966);
  });
}

/** Convert BS year to approximate AD year */
function bsToAd(bsYear: string): number {
  const numeric = parseInt(devanagariToArabic(bsYear), 10);
  if (isNaN(numeric)) return 0;
  return numeric - 57; // BS is ~57 years ahead of AD
}

/** Generate a URL-safe ID from a title */
function titleToId(title: string, contentId?: string): string {
  if (contentId) {
    return `np-content-${contentId}`;
  }
  // Use a simplified transliteration for Nepali titles
  const cleaned = title
    .replace(/[,\s]+/g, '-')
    .replace(/[^\u0900-\u097F\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `np-${cleaned || 'unknown'}`.slice(0, 80);
}

/** Extract content ID from URL */
function extractContentId(url: string): string | null {
  const match = url.match(/\/content\/(\d+)\//);
  return match ? match[1] : null;
}

/** Categorize a law based on its English slug */
function categorizeBySlug(slug: string): CensusLawEntry['category'] {
  const s = slug.toLowerCase();
  if (s.includes('constitution')) return 'constitution';
  if (s.includes('ordinance')) return 'ordinance';
  if (s.includes('rule') || s.includes('regulation') || s.includes('niyamavali')) return 'rules';
  if (s.includes('order') || s.includes('formation')) return 'order';
  if (s.includes('act') || s.includes('-ain-') || s.endsWith('-ain') || s.includes('-ann-')) return 'act';
  return 'other';
}

/** Detect if an entry is a law (act/regulation/etc) vs a notice/report */
function isLegislation(slug: string): boolean {
  const s = slug.toLowerCase();
  const lawPatterns = [
    'act', 'ain', 'ann', 'ordinance', 'regulation', 'rule', 'constitution',
    'order', 'code', 'niyamavali', 'bidhan',
  ];
  const nonLawPatterns = [
    'report', 'notice', 'annual', 'tender', 'meeting', 'advisory', 'study',
    'information', 'opinion', 'suggestion', 'feedback', 'dictionary', 'maxim',
    'relocated', 'competition', 'election', 'voter', 'standing-list', 'concept',
    'draft-bill', 'celebration', 'photo', 'gallery',
  ];

  // Exclude non-law content
  if (nonLawPatterns.some(p => s.includes(p))) return false;
  // Include law content
  if (lawPatterns.some(p => s.includes(p))) return true;
  // Default: include (to be conservative)
  return true;
}

/** Extract English title from URL slug */
function slugToTitle(slug: string): string {
  return slug
    .replace(/^[\d-]+/, '') // Remove leading content ID prefix like "13371-"
    .replace(/-+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract BS year from title */
function extractBsYear(title: string): string {
  // Match Devanagari 4-digit year (e.g., २०७४)
  const devMatch = title.match(/[२-२][०-९]{3}/);
  if (devMatch) return devMatch[0];
  // Match Arabic 4-digit year (e.g., 2074)
  const arabicMatch = title.match(/\b(19|20)\d{2}\b/);
  if (arabicMatch) return arabicMatch[0];
  return '';
}

/* ---------- Fetch helpers ---------- */

async function fetchPage(url: string, timeoutMs = 30000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xml,*/*' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/* ---------- Source 1: Sitemap ---------- */

interface SitemapEntry {
  url: string;
  lastmod: string;
  contentId: string;
  slug: string;
}

async function fetchSitemapEntries(): Promise<SitemapEntry[]> {
  console.log('  Fetching sitemap...');
  const entries: SitemapEntry[] = [];

  // Try all 5 pages of the sitemap
  for (let page = 1; page <= 5; page++) {
    const url = page === 1 ? SITEMAP_URL : `${SITEMAP_URL}?p=${page}`;
    console.log(`    Page ${page}: ${url}`);
    const xml = await fetchPage(url, 60000);
    if (!xml) {
      console.log(`    -> timeout/error, skipping`);
      continue;
    }

    // Parse URLs from XML
    const urlMatches = [...xml.matchAll(/<loc>(https:\/\/lawcommission\.gov\.np\/content\/[^<]+)<\/loc>/g)];
    const modMatches = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];

    for (let i = 0; i < urlMatches.length; i++) {
      const contentUrl = urlMatches[i][1];
      const lastmod = modMatches[i]?.[1] ?? '';
      const contentId = extractContentId(contentUrl);
      if (!contentId) continue;

      const slug = contentUrl.replace(/\/$/, '').split('/').pop() ?? '';
      entries.push({ url: contentUrl, lastmod, contentId, slug });
    }
    console.log(`    -> ${urlMatches.length} entries`);
  }

  return entries;
}

/* ---------- Source 2: Alphabetical Index ---------- */

interface AlphaEntry {
  name: string;
  volume: string;
  bsYear: string;
}

async function fetchAlphabeticalIndex(): Promise<AlphaEntry[]> {
  console.log('  Fetching alphabetical index...');
  const html = await fetchPage(ALPHA_INDEX_URL, 60000);
  if (!html) {
    console.log('    -> timeout/error');
    return [];
  }

  const entries: AlphaEntry[] = [];

  // Extract table rows
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) {
    console.log('    -> no table found');
    return [];
  }

  const tableHtml = tableMatch[1];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 3) continue;

    // The table has two columns of acts side by side (6-7 cells per row)
    // Process pairs of (number, name, volume)
    for (let offset = 0; offset + 2 < cells.length; offset += 3) {
      // Skip if we hit the spacer column (offset 3)
      if (offset === 3 && cells.length >= 7) {
        offset = 4; // Skip spacer, jump to second set
        if (offset + 2 >= cells.length) break;
      }

      const nameHtml = cells[offset + 1]?.[1] ?? '';
      const volHtml = cells[offset + 2]?.[1] ?? '';

      // Extract text
      const name = nameHtml.replace(/<[^>]+>/g, '').trim();
      const vol = volHtml.replace(/<[^>]+>/g, '').trim();

      // Only include entries that contain 'ऐन' (Act) and have a year
      if (name && name.includes('ऐन') && name.includes(',')) {
        const bsYear = extractBsYear(name);
        entries.push({ name, volume: devanagariToArabic(vol), bsYear });
      }
    }
  }

  console.log(`    -> ${entries.length} acts from alphabetical index`);
  return entries;
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const sitemapOnly = process.argv.includes('--sitemap-only');

  console.log('Nepal Law MCP -- Census');
  console.log('=======================\n');
  console.log(`  Source: ${BASE_URL}`);
  console.log(`  Mode: ${sitemapOnly ? 'sitemap only' : 'sitemap + alphabetical index'}\n`);

  // 1. Fetch sitemap entries (content URLs with English slugs)
  const sitemapEntries = await fetchSitemapEntries();

  // 2. Fetch alphabetical index (Nepali act names)
  let alphaEntries: AlphaEntry[] = [];
  if (!sitemapOnly) {
    alphaEntries = await fetchAlphabeticalIndex();
  }

  // 3. Build census from sitemap entries (these have URLs)
  const laws: CensusLawEntry[] = [];
  const seenIds = new Set<string>();

  // Process sitemap entries first (they have actual URLs)
  for (const entry of sitemapEntries) {
    if (!isLegislation(entry.slug)) continue;

    const category = categorizeBySlug(entry.slug);
    const titleEn = slugToTitle(entry.slug);
    const bsYear = extractBsYear(titleEn);
    const id = `np-content-${entry.contentId}`;

    if (seenIds.has(id)) continue;
    seenIds.add(id);

    laws.push({
      id,
      title: titleEn, // We use English title from slug (Nepali title available after ingestion)
      title_en: titleEn,
      identifier: `act/${bsYear || 'unknown'}/${entry.contentId}`,
      url: entry.url.replace(/\/$/, ''),
      status: 'in_force',
      category,
      classification: 'ingestable',
      ingested: false,
      provision_count: 0,
      ingestion_date: null,
      volume: '',
      bs_year: bsYear,
    });
  }

  // Add alphabetical index entries that are not in sitemap
  // These won't have URLs until we can access category pages
  for (const alpha of alphaEntries) {
    // Generate a deterministic ID from the Nepali title
    const titleHash = alpha.name
      .replace(/[,\s]+/g, '-')
      .replace(/[^\u0900-\u097F-]/g, '')
      .slice(0, 60);
    const id = `np-alpha-${titleHash}`;

    if (seenIds.has(id)) continue;

    // Check if a similar entry already exists in sitemap (by BS year)
    const bsYearArabic = devanagariToArabic(alpha.bsYear);
    const existsInSitemap = laws.some(l =>
      l.bs_year === bsYearArabic || l.bs_year === alpha.bsYear,
    );

    // Even if no exact match, include it as 'inaccessible' since we lack URLs
    seenIds.add(id);
    laws.push({
      id,
      title: alpha.name,
      title_en: '', // No English title from alpha index
      identifier: `act/${bsYearArabic || 'unknown'}/alpha`,
      url: '', // No direct URL available
      status: 'in_force',
      category: 'act',
      classification: existsInSitemap ? 'excluded' : 'inaccessible', // duplicate or no URL
      ingested: false,
      provision_count: 0,
      ingestion_date: null,
      volume: alpha.volume,
      bs_year: bsYearArabic,
    });
  }

  // Sort by title
  laws.sort((a, b) => a.title.localeCompare(b.title));

  const ingestable = laws.filter(l => l.classification === 'ingestable');
  const excluded = laws.filter(l => l.classification === 'excluded');
  const inaccessible = laws.filter(l => l.classification === 'inaccessible');

  const census: CensusFile = {
    schema_version: '2.0',
    jurisdiction: 'NP',
    jurisdiction_name: 'Nepal',
    portal: BASE_URL,
    census_date: new Date().toISOString().split('T')[0],
    agent: 'census.ts v1.0',
    summary: {
      total_laws: laws.length,
      ingestable: ingestable.length,
      ocr_needed: 0,
      inaccessible: inaccessible.length,
      excluded: excluded.length,
    },
    laws,
  };

  // Ensure data directory exists
  const dataDir = path.dirname(CENSUS_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log(`\nCensus complete:`);
  console.log(`  Total laws:     ${laws.length}`);
  console.log(`  Ingestable:     ${ingestable.length} (have content URLs)`);
  console.log(`  Excluded:       ${excluded.length} (duplicate in sitemap)`);
  console.log(`  Inaccessible:   ${inaccessible.length} (no content URL)`);
  console.log(`\n  Acts:          ${laws.filter(l => l.category === 'act').length}`);
  console.log(`  Rules:         ${laws.filter(l => l.category === 'rules').length}`);
  console.log(`  Ordinances:    ${laws.filter(l => l.category === 'ordinance').length}`);
  console.log(`  Orders:        ${laws.filter(l => l.category === 'order').length}`);
  console.log(`  Constitution:  ${laws.filter(l => l.category === 'constitution').length}`);
  console.log(`  Other:         ${laws.filter(l => l.category === 'other').length}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
