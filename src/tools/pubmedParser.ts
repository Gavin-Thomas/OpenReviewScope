/**
 * PubMed XML/MEDLINE format parser
 * Supports PubMed exports in XML and MEDLINE text formats
 */

import { Study } from '../state/schemas.js';
import { createHash } from 'crypto';
import { parseStringPromise } from 'xml2js';

/**
 * Parse PubMed XML format
 */
export async function parsePubMedXml(
  content: string,
  sourceFile: string
): Promise<Study[]> {
  try {
    const result = await parseStringPromise(content, {
      explicitArray: false,
      mergeAttrs: true,
    });

    const articles = extractArticles(result);
    return articles.map((article) =>
      pubMedArticleToStudy(article, sourceFile)
    );
  } catch (error) {
    throw new Error(`Failed to parse PubMed XML: ${error}`);
  }
}

/**
 * Parse PubMed MEDLINE text format
 */
export async function parsePubMedMedline(
  content: string,
  sourceFile: string
): Promise<Study[]> {
  const records = splitMedlineRecords(content);
  const studies: Study[] = [];

  for (const record of records) {
    const parsed = parseMedlineRecord(record);
    if (parsed) {
      const study = medlineRecordToStudy(parsed, sourceFile);
      if (study) {
        studies.push(study);
      }
    }
  }

  return studies;
}

/**
 * Extract articles from parsed PubMed XML
 */
function extractArticles(xml: any): any[] {
  if (!xml) return [];

  // Handle different XML structures
  if (xml.PubmedArticleSet?.PubmedArticle) {
    const articles = xml.PubmedArticleSet.PubmedArticle;
    return Array.isArray(articles) ? articles : [articles];
  }

  if (xml.PubmedArticle) {
    return Array.isArray(xml.PubmedArticle)
      ? xml.PubmedArticle
      : [xml.PubmedArticle];
  }

  return [];
}

/**
 * Convert PubMed XML article to Study
 */
function pubMedArticleToStudy(article: any, sourceFile: string): Study {
  const medlineCitation = article.MedlineCitation;
  const articleData = medlineCitation?.Article || {};

  // Title
  const title =
    articleData.ArticleTitle ||
    articleData.VernacularTitle ||
    'Untitled';

  // Authors
  const authorList = articleData.AuthorList?.Author;
  const authors: string[] = [];

  if (authorList) {
    const authorArray = Array.isArray(authorList)
      ? authorList
      : [authorList];
    for (const author of authorArray) {
      if (author.LastName) {
        const name = author.ForeName
          ? `${author.LastName}, ${author.ForeName}`
          : author.LastName;
        authors.push(name);
      } else if (author.CollectiveName) {
        authors.push(author.CollectiveName);
      }
    }
  }

  // Year
  const pubDate =
    articleData.Journal?.JournalIssue?.PubDate ||
    medlineCitation?.DateCompleted ||
    {};
  const year = parseInt(pubDate.Year || new Date().getFullYear().toString());

  // Journal
  const journal =
    articleData.Journal?.Title ||
    articleData.Journal?.ISOAbbreviation ||
    'Unknown';

  // Abstract
  const abstractData = articleData.Abstract?.AbstractText;
  let abstract: string | null = null;
  if (abstractData) {
    if (Array.isArray(abstractData)) {
      abstract = abstractData
        .map((a: any) => (typeof a === 'string' ? a : a._))
        .join(' ');
    } else {
      abstract = typeof abstractData === 'string' ? abstractData : abstractData._;
    }
  }

  // DOI
  const articleIds = article.PubmedData?.ArticleIdList?.ArticleId || [];
  const articleIdArray = Array.isArray(articleIds) ? articleIds : [articleIds];
  const doiEntry = articleIdArray.find((id: any) => id.IdType === 'doi');
  const doi = doiEntry ? doiEntry._ : null;

  // PMID
  const pmid = medlineCitation?.PMID?._ || medlineCitation?.PMID;

  // Keywords/MeSH
  const meshList = medlineCitation?.MeshHeadingList?.MeshHeading || [];
  const meshArray = Array.isArray(meshList) ? meshList : [meshList];
  const keywords = meshArray
    .map((mesh: any) => mesh.DescriptorName?._)
    .filter(Boolean);

  // Generate study ID
  const study_id = generateStudyId(title, authors, year);

  return {
    study_id,
    title,
    authors,
    year,
    journal,
    doi,
    abstract,
    keywords: keywords.length > 0 ? keywords : null,
    source_file: sourceFile,
    raw_record: { article, pmid },
    publisher_url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null,
  };
}

/**
 * Split MEDLINE text into records
 */
function splitMedlineRecords(content: string): string[] {
  const records: string[] = [];
  const lines = content.split(/\r?\n/);
  let currentRecord: string[] = [];

  for (const line of lines) {
    if (line.trim() === '' && currentRecord.length > 0) {
      records.push(currentRecord.join('\n'));
      currentRecord = [];
    } else if (line.trim() !== '') {
      currentRecord.push(line);
    }
  }

  if (currentRecord.length > 0) {
    records.push(currentRecord.join('\n'));
  }

  return records.filter((r) => r.trim().length > 0);
}

/**
 * Parse MEDLINE text record
 */
function parseMedlineRecord(recordText: string): Record<string, any> | null {
  const lines = recordText.split(/\r?\n/);
  const record: Record<string, any> = {};
  let currentTag = '';
  let currentValue = '';

  for (const line of lines) {
    const match = line.match(/^([A-Z]{2,4})\s*-\s*(.*)$/);
    if (match) {
      // Save previous tag
      if (currentTag) {
        if (!record[currentTag]) {
          record[currentTag] = [];
        }
        record[currentTag].push(currentValue.trim());
      }

      currentTag = match[1];
      currentValue = match[2];
    } else if (line.trim().startsWith('      ')) {
      // Continuation line
      currentValue += ' ' + line.trim();
    }
  }

  // Save last tag
  if (currentTag) {
    if (!record[currentTag]) {
      record[currentTag] = [];
    }
    record[currentTag].push(currentValue.trim());
  }

  return Object.keys(record).length > 0 ? record : null;
}

/**
 * Convert MEDLINE record to Study
 */
function medlineRecordToStudy(
  record: Record<string, any>,
  sourceFile: string
): Study | null {
  const title = record.TI?.[0] || record.TTL?.[0];
  if (!title) return null;

  const authors = record.AU || record.FAU || [];
  const yearMatch = record.DP?.[0]?.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  const journal = record.TA?.[0] || record.JT?.[0] || 'Unknown';
  const abstract = record.AB?.[0] || null;
  const doi = record.AID?.find((id: string) => id.includes('[doi]'))?.replace(
    /\s*\[doi\]$/,
    ''
  ) || null;
  const keywords = record.MH || record.OT || null;
  const pmid = record.PMID?.[0];

  const study_id = generateStudyId(title, authors, year);

  return {
    study_id,
    title,
    authors,
    year,
    journal,
    doi,
    abstract,
    keywords,
    source_file: sourceFile,
    raw_record: record,
    publisher_url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null,
  };
}

/**
 * Generate a deterministic study ID
 */
function generateStudyId(title: string, authors: string[], year: number): string {
  const normalized = `${title.toLowerCase()}_${authors.join('_')}_${year}`;
  const hash = createHash('sha256').update(normalized).digest('hex');
  return hash.substring(0, 16);
}
