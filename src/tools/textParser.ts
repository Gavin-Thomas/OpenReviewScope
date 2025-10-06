/**
 * Plain text parser for bibliographic data
 * Handles simple text formats and fallback parsing
 */

import { Study } from '../state/schemas.js';
import { createHash } from 'crypto';

/**
 * Parse plain text file with simple heuristics
 * Attempts to extract title, authors, year, etc. from unstructured text
 */
export async function parseTextFile(
  content: string,
  sourceFile: string
): Promise<Study[]> {
  const studies: Study[] = [];

  // Try different patterns
  const citations = extractCitations(content);

  for (const citation of citations) {
    const study = citationToStudy(citation, sourceFile);
    if (study) {
      studies.push(study);
    }
  }

  return studies;
}

/**
 * Extract individual citations from text
 * Supports various citation formats
 */
function extractCitations(content: string): string[] {
  const citations: string[] = [];
  const lines = content.split(/\r?\n/);

  let currentCitation: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      if (currentCitation.length > 0) {
        citations.push(currentCitation.join(' '));
        currentCitation = [];
      }
      continue;
    }

    // Detect numbered citations (1., 2., [1], etc.)
    if (/^(\d+[\.\)]|\[\d+\])/.test(trimmed)) {
      if (currentCitation.length > 0) {
        citations.push(currentCitation.join(' '));
      }
      currentCitation = [trimmed.replace(/^(\d+[\.\)]|\[\d+\])\s*/, '')];
    } else {
      currentCitation.push(trimmed);
    }
  }

  if (currentCitation.length > 0) {
    citations.push(currentCitation.join(' '));
  }

  return citations.filter((c) => c.length > 10);
}

/**
 * Convert citation string to Study object
 */
function citationToStudy(citation: string, sourceFile: string): Study | null {
  // Extract year (4-digit number, often in parentheses)
  const yearMatch = citation.match(/\((\d{4})\)|\b(\d{4})\b/);
  const year = yearMatch
    ? parseInt(yearMatch[1] || yearMatch[2])
    : new Date().getFullYear();

  // Extract DOI
  const doiMatch = citation.match(
    /(?:doi:|DOI:|https?:\/\/doi\.org\/)?\s*(10\.\d+\/[^\s,;]+)/i
  );
  const doi = doiMatch ? doiMatch[1] : null;

  // Extract title (often in quotes or between author and year)
  let title = extractTitle(citation);
  if (!title || title.length < 5) {
    // Use first substantial part as title
    const parts = citation.split(/[,;]/);
    title = parts.find((p) => p.trim().length > 20)?.trim() || citation.substring(0, 100);
  }

  // Extract authors (names before year or before title)
  const authors = extractAuthors(citation, year);

  // Extract journal (often after title, italicized or after "In:")
  const journal = extractJournal(citation);

  // Generate study ID
  const study_id = generateStudyId(title, authors, year);

  return {
    study_id,
    title,
    authors,
    year,
    journal: journal || 'Unknown',
    doi,
    abstract: null,
    keywords: null,
    source_file: sourceFile,
    raw_record: { original_citation: citation },
    publisher_url: doi ? `https://doi.org/${doi}` : null,
  };
}

/**
 * Extract title from citation
 */
function extractTitle(citation: string): string | null {
  // Try quoted title
  const quotedMatch = citation.match(/["']([^"']{10,})["']/);
  if (quotedMatch) return quotedMatch[1];

  // Try title before year
  const beforeYearMatch = citation.match(/^[^(]+?\.\s+([^(]{10,}?)\s+\(/);
  if (beforeYearMatch) return beforeYearMatch[1].trim();

  return null;
}

/**
 * Extract authors from citation
 */
function extractAuthors(citation: string, year: number): string[] {
  // Get text before year
  const yearStr = year.toString();
  const beforeYear = citation.split(yearStr)[0];

  // Common patterns: "Last, First; Last2, First2"
  const authors = beforeYear
    .split(/[;,]\s+/)
    .filter((part) => {
      // Simple heuristic: contains capital letters and is short enough
      return /[A-Z]/.test(part) && part.length < 50 && part.length > 2;
    })
    .slice(0, 5); // Take first 5

  return authors.length > 0 ? authors : ['Unknown'];
}

/**
 * Extract journal name from citation
 */
function extractJournal(citation: string): string | null {
  // Try "In: Journal Name"
  const inMatch = citation.match(/\bIn:\s+([^,;.]{5,50})/i);
  if (inMatch) return inMatch[1].trim();

  // Try italicized journal (often denoted by _text_ or *text*)
  const italicMatch = citation.match(/[_*]([A-Z][^_*]{5,50})[_*]/);
  if (italicMatch) return italicMatch[1].trim();

  return null;
}

/**
 * Generate a deterministic study ID
 */
function generateStudyId(title: string, authors: string[], year: number): string {
  const normalized = `${title.toLowerCase()}_${authors.join('_')}_${year}`;
  const hash = createHash('sha256').update(normalized).digest('hex');
  return hash.substring(0, 16);
}
