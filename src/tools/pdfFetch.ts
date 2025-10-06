/**
 * PDF Fetching System
 * Implements both OpenURL browser mode and Legacy API mode
 */

import { Study, FetchResult } from '../state/schemas.js';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

export class PdfFetcher {
  private pdfsDir: string;
  private logsDir: string;
  private userAgent: string;

  constructor(pdfsDir: string = 'pdfs/', logsDir: string = 'outputs/') {
    this.pdfsDir = pdfsDir;
    this.logsDir = logsDir;
    this.userAgent = 'AutoScopeBot/1.0 (+https://github.com/autoscope)';
  }

  /**
   * Check which PDFs are already available
   */
  async checkAvailablePdfs(studies: Study[]): Promise<{
    available: Map<string, string>;
    missing: string[];
  }> {
    const available = new Map<string, string>();
    const missing: string[] = [];

    // Ensure pdfs directory exists
    await fs.mkdir(this.pdfsDir, { recursive: true });

    // List existing PDFs
    const existingFiles = await fs.readdir(this.pdfsDir);
    const pdfFiles = existingFiles.filter((f) => f.endsWith('.pdf'));

    // Create mapping of study_id to file path
    const fileMap = new Map<string, string>();
    for (const file of pdfFiles) {
      const studyId = file.replace('.pdf', '');
      fileMap.set(studyId, path.join(this.pdfsDir, file));
    }

    // Check each study
    for (const study of studies) {
      const pdfPath = fileMap.get(study.study_id);
      if (pdfPath) {
        // Verify file exists and is valid PDF
        try {
          const buffer = await fs.readFile(pdfPath);
          if (this.isValidPdf(buffer)) {
            available.set(study.study_id, pdfPath);
          } else {
            missing.push(study.study_id);
          }
        } catch {
          missing.push(study.study_id);
        }
      } else {
        missing.push(study.study_id);
      }
    }

    return { available, missing };
  }

  /**
   * Fetch PDFs using simple download (placeholder for full implementation)
   * In production, this would use Playwright for OpenURL and HTTP for APIs
   */
  async fetchPdfs(
    studies: Study[],
    mode: 'openurl_browser' | 'legacy_api' = 'legacy_api'
  ): Promise<FetchResult[]> {
    const results: FetchResult[] = [];

    console.log(`\n📄 PDF Fetching (${mode} mode)`);
    console.log(`Processing ${studies.length} studies...\n`);

    for (const study of studies) {
      const result = await this.fetchSinglePdf(study, mode);
      results.push(result);

      // Log result
      if (result.status === 'ok') {
        console.log(`  ✓ ${study.title.substring(0, 60)}...`);
      } else {
        console.log(`  ✗ ${study.title.substring(0, 60)}... (${result.status})`);
      }
    }

    // Write retrieval report
    await this.writeRetrievalReport(results);

    return results;
  }

  /**
   * Fetch single PDF (simplified implementation)
   * Real implementation would use Playwright or HTTP APIs
   */
  private async fetchSinglePdf(
    study: Study,
    mode: 'openurl_browser' | 'legacy_api'
  ): Promise<FetchResult> {
    const timestamp = new Date().toISOString();

    try {
      // Check if already exists
      const pdfPath = path.join(this.pdfsDir, `${study.study_id}.pdf`);

      try {
        await fs.access(pdfPath);
        const buffer = await fs.readFile(pdfPath);

        if (this.isValidPdf(buffer)) {
          return {
            study_id: study.study_id,
            status: 'ok',
            file_path: pdfPath,
            file_sha256: this.sha256(buffer),
            attempt_ts: timestamp,
            mode,
            doi_used: study.doi || undefined,
            bytes: buffer.length,
            user_agent_profile: this.userAgent,
            notes: 'Already available locally',
          };
        }
      } catch {
        // File doesn't exist, continue to fetch
      }

      // In a real implementation, this would:
      // 1. For openurl_browser: Use Playwright to navigate institutional resolver
      // 2. For legacy_api: Try DOI resolution, Unpaywall, PMC, OpenAlex
      //
      // For now, return not-found to indicate manual upload needed
      return {
        study_id: study.study_id,
        status: 'not-found',
        attempt_ts: timestamp,
        mode,
        doi_used: study.doi || undefined,
        user_agent_profile: this.userAgent,
        notes: study.doi
          ? `Manual download required. DOI: ${study.doi}`
          : 'Manual download required. No DOI available.',
      };
    } catch (error) {
      return {
        study_id: study.study_id,
        status: `fail:${(error as Error).message}`,
        attempt_ts: timestamp,
        mode,
        user_agent_profile: this.userAgent,
        notes: (error as Error).message,
      };
    }
  }

  /**
   * Validate PDF file structure
   */
  private isValidPdf(buffer: Buffer): boolean {
    // Check PDF header
    const header = buffer.subarray(0, 5).toString('utf-8');
    if (!header.startsWith('%PDF-')) {
      return false;
    }

    // Check for EOF marker
    const tail = buffer.subarray(-1024).toString('utf-8');
    if (!tail.includes('%%EOF')) {
      return false;
    }

    return true;
  }

  /**
   * Calculate SHA-256 hash
   */
  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Write PDF retrieval report
   */
  private async writeRetrievalReport(results: FetchResult[]): Promise<void> {
    const reportPath = path.join(this.logsDir, 'pdf_retrieval_report.csv');

    const headers = [
      'study_id',
      'attempt_ts',
      'mode',
      'status',
      'file_path',
      'file_sha256',
      'doi_used',
      'bytes',
      'notes',
    ];

    const rows = results.map((r) => [
      r.study_id,
      r.attempt_ts,
      r.mode,
      r.status,
      r.file_path || '',
      r.file_sha256 || '',
      r.doi_used || '',
      r.bytes || '',
      r.notes || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, csv);

    console.log(`\n✓ PDF retrieval report saved to: ${reportPath}\n`);
  }

  /**
   * Generate instructions for manual PDF upload
   */
  generateUploadInstructions(missing: string[], studies: Study[]): string {
    const studyMap = new Map(studies.map((s) => [s.study_id, s]));

    let instructions = `\n${'='.repeat(80)}\n`;
    instructions += `MANUAL PDF UPLOAD REQUIRED\n`;
    instructions += `${'='.repeat(80)}\n\n`;
    instructions += `${missing.length} PDFs could not be automatically retrieved.\n\n`;
    instructions += `Please download the PDFs manually and place them in:\n`;
    instructions += `  ${path.resolve(this.pdfsDir)}/\n\n`;
    instructions += `File naming: {study_id}.pdf\n\n`;
    instructions += `Studies requiring manual download:\n`;
    instructions += `${'-'.repeat(80)}\n\n`;

    missing.slice(0, 20).forEach((studyId, i) => {
      const study = studyMap.get(studyId);
      if (study) {
        instructions += `${i + 1}. ${study.title.substring(0, 70)}...\n`;
        instructions += `   Study ID: ${studyId}\n`;
        if (study.doi) {
          instructions += `   DOI: https://doi.org/${study.doi}\n`;
        }
        if (study.publisher_url) {
          instructions += `   URL: ${study.publisher_url}\n`;
        }
        instructions += `   File name: ${studyId}.pdf\n\n`;
      }
    });

    if (missing.length > 20) {
      instructions += `... and ${missing.length - 20} more studies.\n`;
      instructions += `See outputs/missing_pdfs.json for complete list.\n`;
    }

    instructions += `\n${'-'.repeat(80)}\n`;
    instructions += `After downloading PDFs, run the workflow again to continue.\n`;
    instructions += `${'='.repeat(80)}\n\n`;

    return instructions;
  }
}
