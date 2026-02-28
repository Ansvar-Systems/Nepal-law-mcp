#!/usr/bin/env tsx
/**
 * Nepal Law MCP -- Census-Driven Ingestion Pipeline
 *
 * Reads data/census.json and fetches + parses every ingestable Act
 * from lawcommission.gov.np.
 *
 * Strategy: The Nepal Law Commission (GIWMS CMS) serves all law content
 * as embedded PDF flipbooks, not HTML text. This pipeline:
 *   1. Fetches the HTML page for each act
 *   2. Extracts the embedded PDF URL from the flipbook JS
 *   3. Downloads the PDF from giwmscdntwo.gov.np
 *   4. Uses pdftotext (poppler-utils) to extract plain text
 *   5. Parses the extracted text for provisions and definitions
 *
 * Features:
 *   - Resume support: skips Acts that already have a seed JSON file
 *   - Census update: writes provision counts + ingestion dates back to census.json
 *   - Rate limiting: 500ms minimum between requests (via fetcher.ts)
 *
 * Usage:
 *   npm run ingest                    # Full census-driven ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached PDFs (re-parse only)
 *   npm run ingest -- --force         # Re-ingest even if seed exists
 *
 * Data source: lawcommission.gov.np (Nepal Law Commission)
 * Format: PDF via GIWMS CMS flipbook (Nepali/English)
 * License: Government Open Data
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import { parseNepalLawText, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const PDF_DIR = path.resolve(__dirname, '../data/pdf');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

const USER_AGENT = 'nepal-law-mcp/1.0 (https://github.com/Ansvar-Systems/nepal-law-mcp; hello@ansvar.ai)';

/* ---------- Types ---------- */

interface CensusLawEntry {
  id: string;
  title: string;
  title_en: string;
  identifier: string;
  url: string;
  status: 'in_force' | 'amended' | 'repealed';
  category: string;
  classification: 'ingestable' | 'excluded' | 'inaccessible';
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
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

function parseArgs(): { limit: number | null; skipFetch: boolean; force: boolean; offset: number } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let force = false;
  let offset = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--offset' && args[i + 1]) {
      offset = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  return { limit, skipFetch, force, offset };
}

/**
 * Extract the PDF URL from an HTML page.
 * The GIWMS CMS embeds PDFs via a dearflip flipbook:
 *   var pdf = 'https://giwmscdntwo.gov.np/media/pdf_upload/...pdf';
 *   var flipBook = $("#flipbookContainer").flipBook(pdf, options);
 */
function extractPdfUrl(html: string): string | null {
  // Pattern 1: var pdf = '...'
  const match = html.match(/var\s+pdf\s*=\s*'([^']+\.pdf)'/);
  if (match) return match[1];

  // Pattern 2: var pdf = "..."
  const match2 = html.match(/var\s+pdf\s*=\s*"([^"]+\.pdf)"/);
  if (match2) return match2[1];

  // Pattern 3: flipBook("url", ...)
  const match3 = html.match(/flipBook\s*\(\s*['"]([^'"]+\.pdf)['"]/);
  if (match3) return match3[1];

  // Pattern 4: source: "url.pdf"
  const match4 = html.match(/source\s*:\s*['"]([^'"]+\.pdf)['"]/);
  if (match4) return match4[1];

  return null;
}

/**
 * Download a PDF file. Returns true on success.
 */
async function downloadPdf(url: string, destPath: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/pdf,*/*' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!response.ok) return false;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) return false; // Too small to be a real PDF

    fs.writeFileSync(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract text from a PDF using pdftotext (poppler-utils).
 * Returns the extracted text or null on failure.
 */
function extractTextFromPdf(pdfPath: string): string | null {
  try {
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 120000,
    }).toString('utf-8');

    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Convert a census entry to an ActIndexEntry for the parser.
 */
function censusToActEntry(law: CensusLawEntry): ActIndexEntry {
  const parts = law.identifier.split('/');
  return {
    id: law.id,
    title: law.title,
    titleEn: law.title_en || law.title,
    shortName: (law.title_en || law.title).length > 30
      ? (law.title_en || law.title).substring(0, 27) + '...'
      : (law.title_en || law.title),
    status: law.status === 'in_force' ? 'in_force' : law.status === 'amended' ? 'amended' : 'repealed',
    issuedDate: '',
    inForceDate: '',
    url: law.url,
  };
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const { limit, skipFetch, force, offset } = parseArgs();

  console.log('Nepal Law MCP -- Ingestion Pipeline (PDF-based)');
  console.log('================================================\n');
  console.log(`  Source: lawcommission.gov.np (Nepal Law Commission)`);
  console.log(`  Format: PDF via GIWMS CMS flipbook`);
  console.log(`  Text extraction: pdftotext (poppler-utils)`);
  console.log(`  License: Government Open Data`);

  if (limit) console.log(`  --limit ${limit}`);
  if (offset) console.log(`  --offset ${offset}`);
  if (skipFetch) console.log(`  --skip-fetch`);
  if (force) console.log(`  --force (re-ingest all)`);

  // Verify pdftotext is available
  try {
    execSync('pdftotext -v 2>&1', { timeout: 5000 });
  } catch {
    console.error('\nERROR: pdftotext not found. Install poppler-utils:');
    console.error('  sudo apt install poppler-utils  (Debian/Ubuntu)');
    console.error('  brew install poppler             (macOS)');
    process.exit(1);
  }

  // Load census
  if (!fs.existsSync(CENSUS_PATH)) {
    console.error(`\nERROR: Census file not found at ${CENSUS_PATH}`);
    console.error('Run "npx tsx scripts/census.ts" first.');
    process.exit(1);
  }

  const census: CensusFile = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8'));
  const ingestable = census.laws.filter(l => l.classification === 'ingestable');
  const sliced = offset ? ingestable.slice(offset) : ingestable;
  const acts = limit ? sliced.slice(0, limit) : sliced;

  console.log(`\n  Census: ${census.summary.total_laws} total, ${ingestable.length} ingestable`);
  console.log(`  Processing: ${acts.length} acts\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let noPdf = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  const results: { act: string; provisions: number; definitions: number; status: string }[] = [];

  // Build a map for census updates
  const censusMap = new Map<string, CensusLawEntry>();
  for (const law of census.laws) {
    censusMap.set(law.id, law);
  }

  const today = new Date().toISOString().split('T')[0];

  for (const law of acts) {
    const act = censusToActEntry(law);
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const pdfFile = path.join(PDF_DIR, `${act.id}.pdf`);
    const txtFile = path.join(PDF_DIR, `${act.id}.txt`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Resume support: skip if seed already exists and has >1 provision (unless --force)
    if (!force && fs.existsSync(seedFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
        const provCount = existing.provisions?.length ?? 0;
        const defCount = existing.definitions?.length ?? 0;

        // Only consider "resumed" if we got real provisions (not just the HTML junk fallback)
        if (provCount > 1 || (provCount === 1 && !existing.provisions[0].content.includes('@media'))) {
          totalProvisions += provCount;
          totalDefinitions += defCount;

          const entry = censusMap.get(law.id);
          if (entry) {
            entry.ingested = true;
            entry.provision_count = provCount;
            entry.ingestion_date = entry.ingestion_date ?? today;
          }

          results.push({ act: act.shortName, provisions: provCount, definitions: defCount, status: 'resumed' });
          skipped++;
          processed++;
          continue;
        }
        // Otherwise, re-ingest (the old seed has junk data from HTML parsing)
      } catch {
        // Corrupt seed file, re-ingest
      }
    }

    try {
      let text: string | null = null;

      // Step 1: Check for cached text first
      if (fs.existsSync(txtFile) && skipFetch) {
        text = fs.readFileSync(txtFile, 'utf-8');
        if (text.length > 50) {
          console.log(`  [${processed + 1}/${acts.length}] Using cached text ${act.id} (${(text.length / 1024).toFixed(0)} KB)`);
        } else {
          text = null;
        }
      }

      // Step 2: Check for cached PDF
      if (!text && fs.existsSync(pdfFile) && skipFetch) {
        text = extractTextFromPdf(pdfFile);
        if (text) {
          fs.writeFileSync(txtFile, text);
          console.log(`  [${processed + 1}/${acts.length}] Re-extracted text from cached PDF ${act.id}`);
        }
      }

      // Step 3: Fetch HTML page to get PDF URL
      if (!text && !skipFetch) {
        if (!act.url) {
          console.log(`  [${processed + 1}/${acts.length}] ${act.id} -- no URL, skipping`);
          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'NO_URL' });
          failed++;
          processed++;
          continue;
        }

        process.stdout.write(`  [${processed + 1}/${acts.length}] ${act.id}...`);

        // Fetch HTML page
        let html: string | null = null;
        try {
          const result = await fetchWithRateLimit(act.url);
          if (result.status === 200 && result.body.length > 1000) {
            html = result.body;
            fs.writeFileSync(sourceFile, html);
            process.stdout.write(' HTML');
          } else {
            process.stdout.write(` HTTP ${result.status}`);
          }
        } catch {
          process.stdout.write(' timeout');
        }

        if (!html) {
          console.log(' -- page unavailable');
          const entry = censusMap.get(law.id);
          if (entry) entry.classification = 'inaccessible';
          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'TIMEOUT' });
          failed++;
          processed++;
          continue;
        }

        // Extract PDF URL from HTML
        const pdfUrl = extractPdfUrl(html);
        if (!pdfUrl) {
          console.log(' -- no PDF URL found');
          noPdf++;
          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'NO_PDF' });
          failed++;
          processed++;
          continue;
        }

        process.stdout.write(' -> PDF');

        // Download PDF
        const pdfOk = await downloadPdf(pdfUrl, pdfFile);
        if (!pdfOk) {
          console.log(' -- PDF download failed');
          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'PDF_FAIL' });
          failed++;
          processed++;
          continue;
        }

        process.stdout.write(' -> text');

        // Extract text from PDF
        text = extractTextFromPdf(pdfFile);
        if (!text) {
          console.log(' -- text extraction failed');
          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'TEXT_FAIL' });
          failed++;
          processed++;
          continue;
        }

        // Cache extracted text
        fs.writeFileSync(txtFile, text);
        console.log(` OK (${(text.length / 1024).toFixed(0)} KB text)`);
      }

      if (!text) {
        console.log(`  [${processed + 1}/${acts.length}] ${act.id} -- no text available`);
        results.push({ act: act.shortName, provisions: 0, definitions: 0, status: 'NO_TEXT' });
        failed++;
        processed++;
        continue;
      }

      // Parse the extracted text
      const parsed = parseNepalLawText(text, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;

      // Update census entry
      const entry = censusMap.get(law.id);
      if (entry) {
        entry.ingested = true;
        entry.provision_count = parsed.provisions.length;
        entry.ingestion_date = today;
      }

      results.push({
        act: act.shortName,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'OK',
      });
      ingested++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${act.id}: ${msg}`);
      results.push({ act: act.shortName, provisions: 0, definitions: 0, status: `ERROR: ${msg.substring(0, 80)}` });
      failed++;
    }

    processed++;

    // Save census every 50 acts (checkpoint)
    if (processed % 50 === 0) {
      writeCensus(census, censusMap);
      console.log(`  [checkpoint] Census updated at ${processed}/${acts.length}`);
    }
  }

  // Final census update
  writeCensus(census, censusMap);

  // Report
  console.log(`\n${'='.repeat(70)}`);
  console.log('Ingestion Report');
  console.log('='.repeat(70));
  console.log(`\n  Source:      lawcommission.gov.np (PDF via GIWMS CMS)`);
  console.log(`  Processed:   ${processed}`);
  console.log(`  New:         ${ingested}`);
  console.log(`  Resumed:     ${skipped}`);
  console.log(`  Failed:      ${failed} (${noPdf} no PDF URL)`);
  console.log(`  Total provisions:  ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);

  // Summary of failures
  const failures = results.filter(r =>
    ['TIMEOUT', 'NO_PDF', 'PDF_FAIL', 'TEXT_FAIL', 'NO_URL', 'NO_TEXT'].includes(r.status) ||
    r.status.startsWith('ERROR'));
  if (failures.length > 0 && failures.length <= 40) {
    console.log(`\n  Failed acts:`);
    for (const f of failures) {
      console.log(`    ${f.act}: ${f.status}`);
    }
  } else if (failures.length > 40) {
    console.log(`\n  ${failures.length} acts failed (too many to list)`);
  }

  // Zero-provision acts
  const zeroProv = results.filter(r => r.provisions === 0 && r.status === 'OK');
  if (zeroProv.length > 0) {
    console.log(`\n  Zero-provision acts (${zeroProv.length}):`);
    for (const z of zeroProv.slice(0, 20)) {
      console.log(`    ${z.act}`);
    }
    if (zeroProv.length > 20) {
      console.log(`    ... and ${zeroProv.length - 20} more`);
    }
  }

  console.log('');
}

function writeCensus(census: CensusFile, censusMap: Map<string, CensusLawEntry>): void {
  census.laws = Array.from(censusMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  census.summary.total_laws = census.laws.length;
  census.summary.ingestable = census.laws.filter(l => l.classification === 'ingestable').length;
  census.summary.inaccessible = census.laws.filter(l => l.classification === 'inaccessible').length;
  census.summary.excluded = census.laws.filter(l => l.classification === 'excluded').length;

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
