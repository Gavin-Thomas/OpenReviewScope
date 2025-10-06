/**
 * PRISMA Flow Diagram Generator
 * Creates PRISMA-ScR compliant flow diagrams
 */

import { PrismaCounts } from '../state/schemas.js';
import { promises as fs } from 'fs';
import path from 'path';

export class PrismaFlowGenerator {
  /**
   * Generate PRISMA flow diagram as SVG
   */
  async generateSvg(counts: PrismaCounts, outputPath: string): Promise<string> {
    const svg = this.createFlowDiagramSvg(counts);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, svg);
    return outputPath;
  }

  /**
   * Create SVG content for PRISMA flow
   */
  private createFlowDiagramSvg(counts: PrismaCounts): string {
    const width = 800;
    const height = 1000;
    const boxWidth = 300;
    const boxHeight = 80;
    const spacing = 100;

    let y = 50;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- PRISMA-ScR Flow Diagram -->

  <!-- Identification -->
  <rect x="${width / 2 - boxWidth / 2}" y="${y}" width="${boxWidth}" height="${boxHeight}"
        fill="#e3f2fd" stroke="#1976d2" stroke-width="2"/>
  <text x="${width / 2}" y="${y + 35}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold">
    Records identified
  </text>
  <text x="${width / 2}" y="${y + 55}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold">
    n = ${counts.identified}
  </text>

  <!-- Arrow -->
  <line x1="${width / 2}" y1="${y + boxHeight}" x2="${width / 2}" y2="${y + boxHeight + 40}"
        stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>

  ${(y += boxHeight + spacing, '')}

  <!-- After deduplication -->
  <rect x="${width / 2 - boxWidth / 2}" y="${y}" width="${boxWidth}" height="${boxHeight}"
        fill="#e8f5e9" stroke="#388e3c" stroke-width="2"/>
  <text x="${width / 2}" y="${y + 35}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold">
    Records after deduplication
  </text>
  <text x="${width / 2}" y="${y + 55}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold">
    n = ${counts.deduplicated}
  </text>

  <!-- Arrow -->
  <line x1="${width / 2}" y1="${y + boxHeight}" x2="${width / 2}" y2="${y + boxHeight + 40}"
        stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>

  ${(y += boxHeight + spacing, '')}

  <!-- Screened -->
  <rect x="${width / 2 - boxWidth / 2}" y="${y}" width="${boxWidth}" height="${boxHeight}"
        fill="#fff3e0" stroke="#f57c00" stroke-width="2"/>
  <text x="${width / 2}" y="${y + 25}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold">
    Records screened (title/abstract)
  </text>
  <text x="${width / 2}" y="${y + 45}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold">
    n = ${counts.title_abstract_screened}
  </text>
  <text x="${width / 2}" y="${y + 65}" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">
    Excluded: ${counts.abstract_excluded}
  </text>

  <!-- Arrow -->
  <line x1="${width / 2}" y1="${y + boxHeight}" x2="${width / 2}" y2="${y + boxHeight + 40}"
        stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>

  ${(y += boxHeight + spacing, '')}

  <!-- Full-text assessed -->
  <rect x="${width / 2 - boxWidth / 2}" y="${y}" width="${boxWidth}" height="${boxHeight}"
        fill="#fce4ec" stroke="#c2185b" stroke-width="2"/>
  <text x="${width / 2}" y="${y + 25}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold">
    Full-text articles assessed
  </text>
  <text x="${width / 2}" y="${y + 45}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold">
    n = ${counts.fulltext_retrieved}
  </text>
  <text x="${width / 2}" y="${y + 65}" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">
    Excluded: ${counts.fulltext_excluded.length}
  </text>

  <!-- Arrow -->
  <line x1="${width / 2}" y1="${y + boxHeight}" x2="${width / 2}" y2="${y + boxHeight + 40}"
        stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>

  ${(y += boxHeight + spacing, '')}

  <!-- Included -->
  <rect x="${width / 2 - boxWidth / 2}" y="${y}" width="${boxWidth}" height="${boxHeight}"
        fill="#c8e6c9" stroke="#2e7d32" stroke-width="3"/>
  <text x="${width / 2}" y="${y + 35}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold">
    Studies included in review
  </text>
  <text x="${width / 2}" y="${y + 55}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold">
    n = ${counts.included}
  </text>

  <!-- Arrow marker definition -->
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
      <polygon points="0 0, 10 5, 0 10" fill="#333"/>
    </marker>
  </defs>
</svg>`;

    return svg;
  }

  /**
   * Validate PRISMA count integrity
   */
  validateCounts(counts: PrismaCounts): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (counts.identified < counts.deduplicated) {
      errors.push('Identified count must be >= deduplicated count');
    }

    if (counts.deduplicated < counts.title_abstract_screened) {
      errors.push('Deduplicated count must be >= screened count');
    }

    if (counts.title_abstract_screened < counts.fulltext_retrieved) {
      errors.push('Screened count must be >= full-text retrieved');
    }

    if (counts.fulltext_retrieved < counts.included) {
      errors.push('Full-text retrieved must be >= included count');
    }

    const expectedExcluded =
      counts.title_abstract_screened - counts.fulltext_retrieved;
    if (counts.abstract_excluded !== expectedExcluded) {
      errors.push(
        `Abstract excluded count (${counts.abstract_excluded}) doesn't match expected (${expectedExcluded})`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate PRISMA-ScR checklist
   */
  generateChecklist(counts: PrismaCounts): Record<string, any> {
    return {
      title: {
        item: 'Identify the report as a scoping review',
        completed: true,
      },
      abstract: {
        item: 'Provide a structured summary',
        completed: true,
      },
      rationale: {
        item: 'Describe the rationale for the review',
        completed: false, // User must fill
      },
      objectives: {
        item: 'Provide an explicit statement',
        completed: false, // User must fill
      },
      eligibility_criteria: {
        item: 'Specify the inclusion/exclusion criteria',
        completed: true,
      },
      information_sources: {
        item: 'Describe all sources',
        completed: false, // User must specify
      },
      search: {
        item: 'Present the full search strategies',
        completed: false, // User must provide
      },
      selection_of_sources: {
        item: 'State the process for selecting sources',
        completed: true,
        note: `${counts.identified} identified, ${counts.included} included`,
      },
      data_charting: {
        item: 'Describe methods of charting data',
        completed: true,
      },
      results_of_individual_sources: {
        item: 'For each source, present data charted',
        completed: true,
      },
      synthesis_of_results: {
        item: 'Summarize and/or present the charting results',
        completed: true,
      },
      summary_of_evidence: {
        item: 'Summarize the main results',
        completed: false, // User must write
      },
      limitations: {
        item: 'Discuss the limitations',
        completed: false, // User must write
      },
      conclusions: {
        item: 'Provide a general interpretation',
        completed: false, // User must write
      },
      funding: {
        item: 'Describe sources of funding',
        completed: false, // User must specify
      },
    };
  }
}
