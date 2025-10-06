/**
 * Deduplication and normalization utilities
 * Removes duplicate studies using multiple strategies
 */

import { Study } from '../state/schemas.js';
import stringSimilarity from 'string-similarity';

export interface DedupeResult {
  unique: Study[];
  duplicates: Array<{
    kept: string;
    removed: string[];
    reason: string;
  }>;
}

/**
 * Deduplicate studies using multiple strategies
 * 1. Exact DOI match
 * 2. Normalized title similarity
 * 3. Authors + year heuristic
 */
export async function deduplicateStudies(
  studies: Study[],
  titleSimilarityThreshold: number = 0.85
): Promise<DedupeResult> {
  const unique: Study[] = [];
  const duplicates: Array<{
    kept: string;
    removed: string[];
    reason: string;
  }> = [];

  for (const study of studies) {
    const duplicate = findDuplicate(
      study,
      unique,
      titleSimilarityThreshold
    );

    if (duplicate) {
      // Found duplicate - track it
      const existingEntry = duplicates.find((d) => d.kept === duplicate.match.study_id);
      if (existingEntry) {
        existingEntry.removed.push(study.study_id);
      } else {
        duplicates.push({
          kept: duplicate.match.study_id,
          removed: [study.study_id],
          reason: duplicate.reason,
        });
      }
    } else {
      // Unique study
      unique.push(study);
    }
  }

  return { unique, duplicates };
}

/**
 * Find if a study is a duplicate of any in the existing list
 */
function findDuplicate(
  study: Study,
  existing: Study[],
  titleSimilarityThreshold: number
): { match: Study; reason: string } | null {
  for (const candidate of existing) {
    // Strategy 1: Exact DOI match
    if (study.doi && candidate.doi && study.doi === candidate.doi) {
      return { match: candidate, reason: 'Exact DOI match' };
    }

    // Strategy 2: Normalized title similarity
    const titleSimilarity = compareTitles(study.title, candidate.title);
    if (titleSimilarity >= titleSimilarityThreshold) {
      return {
        match: candidate,
        reason: `Title similarity: ${titleSimilarity.toFixed(2)}`,
      };
    }

    // Strategy 3: Same authors + year + similar title
    if (
      study.year === candidate.year &&
      authorsOverlap(study.authors, candidate.authors) > 0.5 &&
      titleSimilarity > 0.7
    ) {
      return {
        match: candidate,
        reason: `Same authors (${authorsOverlap(study.authors, candidate.authors).toFixed(2)}) + year + similar title`,
      };
    }
  }

  return null;
}

/**
 * Compare two titles using normalized similarity
 */
function compareTitles(title1: string, title2: string): number {
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);

  return stringSimilarity.compareTwoStrings(normalized1, normalized2);
}

/**
 * Normalize title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate author overlap (Jaccard similarity)
 */
function authorsOverlap(authors1: string[], authors2: string[]): number {
  if (authors1.length === 0 || authors2.length === 0) return 0;

  const normalized1 = new Set(authors1.map(normalizeAuthor));
  const normalized2 = new Set(authors2.map(normalizeAuthor));

  const intersection = new Set(
    [...normalized1].filter((a) => normalized2.has(a))
  );
  const union = new Set([...normalized1, ...normalized2]);

  return intersection.size / union.size;
}

/**
 * Normalize author name for comparison
 */
function normalizeAuthor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize DOI (strip URL prefix, normalize case)
 */
export function normalizeDoi(doi: string | null): string | null {
  if (!doi) return null;

  return doi
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .toLowerCase()
    .trim();
}

/**
 * Attempt to recover/fill missing DOIs via Crossref title search
 */
export async function fillMissingDois(studies: Study[]): Promise<Study[]> {
  // This would integrate with Crossref API
  // For now, return as-is (can be implemented later)
  return studies;
}
