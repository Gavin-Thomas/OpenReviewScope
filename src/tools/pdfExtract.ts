/**
 * PDF extraction and OCR utilities
 * Extracts text from PDFs with page mapping for citation
 */

import { promises as fs } from 'fs';

export interface ExtractedPage {
  page_number: number;
  text: string;
  has_ocr: boolean;
}

export interface ExtractedPdf {
  study_id: string;
  file_path: string;
  total_pages: number;
  pages: ExtractedPage[];
  full_text: string;
  metadata: Record<string, any>;
  extraction_method: 'native' | 'ocr' | 'hybrid';
}

/**
 * Extract text from PDF with page mapping
 */
export async function extractPdfText(
  filePath: string,
  studyId: string,
  ocrEnabled: boolean = true
): Promise<ExtractedPdf> {
  const dataBuffer = await fs.readFile(filePath);

  // Validate PDF
  if (!isPdfValid(dataBuffer)) {
    throw new Error(`Invalid PDF file: ${filePath}`);
  }

  try {
    // Import from CommonJS wrapper to avoid ESM issues
    const pdf = (await import('./pdfParseWrapper.cjs')).default;

    // Try native text extraction first
    const pdfData = await pdf(dataBuffer);

    const pages: ExtractedPage[] = [];
    let hasText = false;

    // Extract text page by page
    const pageTexts = await extractPageTexts(dataBuffer);

    for (let i = 0; i < pdfData.numpages; i++) {
      const pageText = pageTexts[i] || '';
      const hasContent = pageText.trim().length > 50;

      if (hasContent) {
        hasText = true;
      }

      pages.push({
        page_number: i + 1,
        text: pageText,
        has_ocr: false,
      });
    }

    // If no text found and OCR is enabled, use OCR
    if (!hasText && ocrEnabled && pdfData.numpages <= 50) {
      // Limit OCR to 50 pages
      console.log(
        `No text found in ${filePath}, attempting OCR (${pdfData.numpages} pages)...`
      );
      return await extractWithOcr(filePath, studyId, pdfData.info);
    }

    const full_text = pages.map((p) => p.text).join('\n\n');

    return {
      study_id: studyId,
      file_path: filePath,
      total_pages: pdfData.numpages,
      pages,
      full_text,
      metadata: pdfData.info || {},
      extraction_method: 'native',
    };
  } catch (error) {
    // Fallback to OCR if native extraction fails
    if (ocrEnabled) {
      console.log(`Native extraction failed for ${filePath}, trying OCR...`);
      return await extractWithOcr(filePath, studyId, {});
    }
    throw error;
  }
}

/**
 * Extract text from each page separately
 */
async function extractPageTexts(dataBuffer: Buffer): Promise<string[]> {
  // This is a simplified version
  // In practice, you'd use a library that supports per-page extraction
  const pdf = (await import('./pdfParseWrapper.cjs')).default;
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  // Split by page breaks (heuristic)
  const pages = text.split(/\f|\n{5,}/); // Form feed or many newlines

  return pages;
}

/**
 * Extract text using OCR (placeholder)
 * In production, would use external OCR service
 */
async function extractWithOcr(
  filePath: string,
  studyId: string,
  metadata: Record<string, any>
): Promise<ExtractedPdf> {
  // OCR extraction placeholder
  // In production, integrate with external OCR service (Google Cloud Vision, AWS Textract, etc.)
  console.warn(`OCR not available for ${filePath}. Install external OCR service if needed.`);

  return {
    study_id: studyId,
    file_path: filePath,
    total_pages: 0,
    pages: [],
    full_text: '',
    metadata,
    extraction_method: 'ocr',
  };
}

/**
 * Validate PDF file structure
 */
function isPdfValid(buffer: Buffer): boolean {
  // Check PDF header
  const header = buffer.subarray(0, 5).toString('utf-8');
  if (!header.startsWith('%PDF-')) {
    return false;
  }

  // Check for EOF marker (last 1024 bytes)
  const tail = buffer.subarray(-1024).toString('utf-8');
  if (!tail.includes('%%EOF')) {
    return false;
  }

  return true;
}

/**
 * Find text quote with location (page and section)
 */
export function findQuoteLocation(
  extractedPdf: ExtractedPdf,
  quote: string
): string | null {
  const normalized = quote.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const page of extractedPdf.pages) {
    const pageText = page.text.toLowerCase().replace(/\s+/g, ' ');
    if (pageText.includes(normalized)) {
      return `p.${page.page_number}`;
    }
  }

  return null;
}

/**
 * Extract title from first page (heuristic)
 */
export function extractTitleFromPdf(extractedPdf: ExtractedPdf): string | null {
  if (extractedPdf.pages.length === 0) return null;

  const firstPage = extractedPdf.pages[0].text;
  const lines = firstPage.split('\n').filter((l) => l.trim().length > 0);

  // Heuristic: title is often in first few lines and is longer than average
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 20 && line.length < 200 && !line.match(/^\d+$/)) {
      return line;
    }
  }

  return null;
}

/**
 * Attempt to extract DOI from PDF
 */
export function extractDoiFromPdf(extractedPdf: ExtractedPdf): string | null {
  // Check metadata
  if (extractedPdf.metadata?.doi) {
    return extractedPdf.metadata.doi;
  }

  // Search first 2 pages
  const searchText = extractedPdf.pages
    .slice(0, 2)
    .map((p) => p.text)
    .join('\n');

  const doiMatch = searchText.match(/(?:doi:|DOI:)?\s*(10\.\d+\/[^\s,;]+)/i);
  return doiMatch ? doiMatch[1] : null;
}
