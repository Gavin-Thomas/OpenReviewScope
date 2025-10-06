/**
 * RIS format parser for bibliographic data
 * Supports common RIS exports from EndNote, Zotero, RefWorks, etc.
 */

import { Study } from '../state/schemas.js';
import { createHash } from 'crypto';

export interface RisRecord {
  TY?: string; // Type
  TI?: string; // Title
  T1?: string; // Primary title
  AU?: string[]; // Authors
  A1?: string[]; // First author
  PY?: string; // Publication year
  Y1?: string; // Primary date
  JO?: string; // Journal
  JF?: string; // Full journal name
  T2?: string; // Secondary title
  AB?: string; // Abstract
  N2?: string; // Notes/Abstract
  DO?: string; // DOI
  KW?: string[]; // Keywords
  UR?: string; // URL
  [key: string]: any;
}

/**
 * Parse RIS file content into an array of Study objects
 */
export async function parseRisFile(
  content: string,
  sourceFile: string
): Promise<Study[]> {
  const records = splitRisRecords(content);
  const studies: Study[] = [];

  for (const record of records) {
    const parsed = parseRisRecord(record);
    if (parsed) {
      const study = risRecordToStudy(parsed, sourceFile);
      if (study) {
        studies.push(study);
      }
    }
  }

  return studies;
}

/**
 * Split RIS content into individual records
 */
function splitRisRecords(content: string): string[] {
  const records: string[] = [];
  const lines = content.split(/\r?\n/);
  let currentRecord: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('TY  -') && currentRecord.length > 0) {
      records.push(currentRecord.join('\n'));
      currentRecord = [line];
    } else {
      currentRecord.push(line);
    }
  }

  if (currentRecord.length > 0) {
    records.push(currentRecord.join('\n'));
  }

  return records.filter((r) => r.trim().length > 0);
}

/**
 * Parse a single RIS record into a structured object
 */
function parseRisRecord(recordText: string): RisRecord | null {
  const lines = recordText.split(/\r?\n/);
  const record: RisRecord = {};

  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z0-9])  - (.*)$/);
    if (match) {
      const tag = match[1];
      const value = match[2].trim();

      if (tag === 'AU' || tag === 'A1' || tag === 'KW') {
        // Multi-value fields
        if (!record[tag]) {
          record[tag] = [];
        }
        (record[tag] as string[]).push(value);
      } else {
        // Single-value fields (take first occurrence)
        if (!record[tag]) {
          record[tag] = value;
        }
      }
    }
  }

  return Object.keys(record).length > 0 ? record : null;
}

/**
 * Convert RIS record to Study object
 */
function risRecordToStudy(ris: RisRecord, sourceFile: string): Study | null {
  // Get title
  const title = ris.TI || ris.T1;
  if (!title) return null;

  // Get authors
  const authors = ris.AU || ris.A1 || [];

  // Get year
  const yearString = ris.PY || ris.Y1 || '';
  const yearMatch = yearString.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

  // Get journal
  const journal = ris.JO || ris.JF || ris.T2 || 'Unknown';

  // Get abstract
  const abstract = ris.AB || ris.N2 || null;

  // Get DOI
  const doi = ris.DO || null;

  // Get keywords
  const keywords = ris.KW || null;

  // Generate study ID
  const study_id = generateStudyId(title, authors, year);

  return {
    study_id,
    title,
    authors: Array.isArray(authors) ? authors : [authors],
    year,
    journal,
    doi,
    abstract,
    keywords: keywords ? (Array.isArray(keywords) ? keywords : [keywords]) : null,
    source_file: sourceFile,
    raw_record: ris,
    publisher_url: ris.UR || null,
  };
}

/**
 * Generate a deterministic study ID from bibliographic data
 */
function generateStudyId(title: string, authors: string[], year: number): string {
  const normalized = `${title.toLowerCase()}_${authors.join('_')}_${year}`;
  const hash = createHash('sha256').update(normalized).digest('hex');
  return hash.substring(0, 16);
}
