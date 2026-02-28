/**
 * Nepal Law Text Parser
 *
 * Parses legislation text extracted from PDFs sourced from lawcommission.gov.np.
 *
 * The Nepal Law Commission (GIWMS CMS) serves all law content as PDF flipbooks.
 * Text is extracted using pdftotext (poppler-utils) before being parsed here.
 *
 * Content is primarily in Nepali (Devanagari script), with some English translations.
 *
 * Content structure:
 *   - Title in Nepali (e.g., "मुलुकी देवानी संहिता, २०७४")
 *   - Chapters marked with "परिच्छेद" (Paricched) followed by chapter number
 *   - Sections marked with "दफा" (Dafa) followed by a number, or Devanagari numeral + period
 *   - Numbered sections (e.g., "१." = Section 1)
 *   - Definitions typically in the first chapter ("परिभाषा")
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

/** Convert Devanagari numerals to Arabic */
function devanagariToArabic(str: string): string {
  return str.replace(/[०-९]/g, (ch) => {
    return String(ch.charCodeAt(0) - 0x0966);
  });
}

/** Clean up PDF-extracted text: remove headers, footers, page numbers */
function cleanPdfText(text: string): string {
  const lines = text.split('\n');
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines (but preserve as paragraph breaks)
    if (!trimmed) {
      if (cleaned.length > 0 && cleaned[cleaned.length - 1] !== '') {
        cleaned.push('');
      }
      continue;
    }

    // Skip page numbers (standalone digits)
    if (/^\d+$/.test(trimmed)) continue;
    if (/^[०-९]+$/.test(trimmed)) continue;

    // Skip www.lawcommission.gov.np headers/footers
    if (trimmed.includes('www.lawcommission.gov.np')) continue;

    // Skip lone "www" lines
    if (/^www\.\S+$/.test(trimmed)) continue;

    cleaned.push(trimmed);
  }

  return cleaned.join('\n');
}

/**
 * Extract title from the text (usually the first substantial Nepali line).
 */
function extractTitle(text: string): string {
  const lines = text.split('\n').filter(l => l.trim().length > 5);

  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    // Look for Nepali title (contains Devanagari and typically has a year)
    if (/[\u0900-\u097F]/.test(trimmed) && trimmed.length > 10 && trimmed.length < 300) {
      // Skip amendment lines
      if (trimmed.match(/^\d+\./)) continue;
      if (trimmed.startsWith('सं शोधन') || trimmed.startsWith('संशोधन')) continue;
      return trimmed;
    }
  }

  return '';
}

/**
 * Parse sections/chapters from Nepali law text.
 *
 * Nepali law structure:
 *   परिच्छेद-N  = Chapter N (or परिच्छेद–N, पररच्छे द–N)
 *   दफा N      = Section N
 *   N.          = Section N (Devanagari numeral followed by period)
 *
 * The text from pdftotext -layout preserves the document structure well.
 */
function parseSections(text: string): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];
  let currentChapter = '';
  let currentChapterTitle = '';

  const lines = text.split('\n');
  let sectionNumber = '';
  let sectionTitle = '';
  let sectionContent: string[] = [];
  let inSection = false;

  // Regex patterns for section/chapter detection
  // Chapter: परिच्छेद-N or पररच्छे द–N (PDF text may have spacing variations)
  const chapterPatterns = [
    /^प[रर]र?ि?च्छे?\s*द[–\-]?\s*([०-९\d]+)\s*$/,      // Just chapter number on its own line
    /^प[रर]र?ि?च्छे?\s*द[–\-]?\s*([०-९\d]+)\s*[:\.\s]+(.*)/,  // Chapter number + title
  ];

  // Section: दफा N or N. (where N is Devanagari) at the start of a line
  const sectionPatterns = [
    /^दफा\s*[:\.]?\s*([०-९\d]+[क-ह]?)\s*[:\.\s]*(.*)/,   // दफा N. Title
    /^([०-९]+[क-ह]?)\.\s+(.*)/,                            // N. Title (Devanagari numeral with period)
  ];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (inSection) sectionContent.push('');
      continue;
    }

    // Check for chapter header
    let isChapter = false;
    for (const pattern of chapterPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // Save previous section
        if (inSection && sectionNumber) {
          provisions.push(makeProvision(sectionNumber, currentChapter, sectionTitle, sectionContent));
        }

        currentChapter = devanagariToArabic(match[1]);
        currentChapterTitle = match[2]?.trim() ?? '';

        // If the chapter title is on the next line, read it
        if (!currentChapterTitle && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && !nextLine.match(/^दफा/) && !nextLine.match(/^[०-९]+\./) && !nextLine.match(/^प[रर]/)) {
            currentChapterTitle = nextLine;
          }
        }

        inSection = false;
        sectionNumber = '';
        sectionContent = [];
        isChapter = true;
        break;
      }
    }
    if (isChapter) continue;

    // Check for section header
    let isSection = false;
    for (const pattern of sectionPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // Save previous section
        if (inSection && sectionNumber) {
          provisions.push(makeProvision(sectionNumber, currentChapter, sectionTitle, sectionContent));
        }

        sectionNumber = devanagariToArabic(match[1]);
        sectionTitle = match[2]?.trim() ?? '';
        sectionContent = [];
        inSection = true;
        isSection = true;
        break;
      }
    }
    if (isSection) continue;

    // Accumulate content for current section
    if (inSection) {
      sectionContent.push(trimmed);
    }
  }

  // Save last section
  if (inSection && sectionNumber) {
    provisions.push(makeProvision(sectionNumber, currentChapter, sectionTitle, sectionContent));
  }

  return provisions;
}

function makeProvision(
  sectionNumber: string,
  chapter: string,
  title: string,
  contentLines: string[],
): ParsedProvision {
  // Clean up content: join lines, collapse multiple blank lines
  let content = contentLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // If content is very short and title is long, the title IS the content
  if (!content && title) {
    content = title;
  }

  // If the title contains a colon, split on it
  if (title.includes('ः') && !content) {
    const parts = title.split('ः');
    title = parts[0].trim();
    content = parts.slice(1).join('ः').trim();
  }

  return {
    provision_ref: sectionNumber,
    chapter: chapter ? `Chapter ${chapter}` : undefined,
    section: `Section ${sectionNumber}`,
    title: title || '',
    content: content || title || '',
  };
}

/** Extract definitions from the parsed provisions */
function extractDefinitions(provisions: ParsedProvision[]): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];

  // Look for definition sections (typically Section 2 or sections containing "परिभाषा")
  for (const prov of provisions) {
    if (prov.title.includes('परिभाषा') || prov.title.includes('पररिाषा') ||
        prov.title.includes('परिभाष') || prov.provision_ref === '2') {
      // Parse definitions from content
      // Pattern: "term" भन्नाले ... (meaning/definition)
      const defPattern = /"([^"]+)"\s*भन्नाले\s+([\s\S]*?)(?="|$)/g;
      let defMatch;
      while ((defMatch = defPattern.exec(prov.content)) !== null) {
        definitions.push({
          term: defMatch[1].trim(),
          definition: defMatch[2].trim().replace(/\s+/g, ' '),
          source_provision: prov.provision_ref,
        });
      }

      // Also try: (क) "term" — definition
      const altPattern = /\([क-ह]+\)\s*"([^"]+)"\s*[:\-–—]\s*([\s\S]*?)(?=\([क-ह]+\)|$)/g;
      while ((defMatch = altPattern.exec(prov.content)) !== null) {
        const term = defMatch[1].trim();
        if (!definitions.some(d => d.term === term)) {
          definitions.push({
            term,
            definition: defMatch[2].trim().replace(/\s+/g, ' '),
            source_provision: prov.provision_ref,
          });
        }
      }

      // Pattern: (क) "term" भन्नाले ...
      const altPattern2 = /\([क-ह]+\)\s*"([^"]+)"\s*भन्नाले\s+([\s\S]*?)(?=\([क-ह]+\)|$)/g;
      while ((defMatch = altPattern2.exec(prov.content)) !== null) {
        const term = defMatch[1].trim();
        if (!definitions.some(d => d.term === term)) {
          definitions.push({
            term,
            definition: defMatch[2].trim().replace(/\s+/g, ' '),
            source_provision: prov.provision_ref,
          });
        }
      }

      break; // Only process the first definition section
    }
  }

  return definitions;
}

/**
 * Parse Nepal Law text extracted from PDF.
 *
 * This is the primary entry point for the ingestion pipeline.
 * Text should be extracted from PDF using pdftotext -layout.
 */
export function parseNepalLawText(text: string, act: ActIndexEntry): ParsedAct {
  // Clean up PDF artifacts
  const cleanedText = cleanPdfText(text);

  // Extract title from the text
  const pageTitle = extractTitle(cleanedText);

  // Parse sections and chapters
  const provisions = parseSections(cleanedText);

  // Extract definitions
  const definitions = extractDefinitions(provisions);

  // If no structured sections found, split by paragraphs as fallback
  if (provisions.length === 0 && cleanedText.length > 100) {
    const paragraphs = cleanedText.split(/\n{2,}/).filter(p => p.trim().length > 30);
    for (let i = 0; i < paragraphs.length; i++) {
      provisions.push({
        provision_ref: String(i + 1),
        section: `Paragraph ${i + 1}`,
        title: '',
        content: paragraphs[i].trim(),
      });
    }
  }

  return {
    id: act.id,
    type: 'statute',
    title: pageTitle || act.title,
    title_en: act.titleEn || '',
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}

/**
 * Legacy HTML parser -- kept for backward compatibility but not recommended.
 * The PDF-based pipeline (parseNepalLawText) produces much better results.
 */
export function parseNepalLawHtml(html: string, act: ActIndexEntry): ParsedAct {
  // Strip HTML tags to get raw text, then delegate to text parser
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ');

  return parseNepalLawText(text, act);
}

// Re-export for backward compatibility
export { parseNepalLawHtml as parseHtml };
