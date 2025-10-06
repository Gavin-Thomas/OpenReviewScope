/**
 * Document Writers for Manuscript Outputs
 * Word (.docx), LaTeX (.tex), and CSV/JSON exporters
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { GlobalState, ExtractionRecord, Study, ConsensusDecision } from '../state/schemas.js';
import { promises as fs } from 'fs';
import path from 'path';

export class DocumentWriter {
  /**
   * Generate Word (.docx) manuscript
   */
  async generateWordManuscript(
    state: GlobalState,
    outputPath: string
  ): Promise<string> {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Title
            new Paragraph({
              text: 'Scoping Review: PRISMA-ScR Compliant Report',
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),

            new Paragraph({ text: '' }), // Blank line

            // Abstract
            new Paragraph({
              text: 'Abstract',
              heading: HeadingLevel.HEADING_1,
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: `This scoping review identified ${state.prisma_counts.identified} records from database searches. After deduplication (${state.prisma_counts.deduplicated} unique records) and title/abstract screening, ${state.prisma_counts.fulltext_retrieved} full-text articles were assessed for eligibility. A total of ${state.prisma_counts.included} studies met the inclusion criteria and were included in the final review.`,
                }),
              ],
            }),

            new Paragraph({ text: '' }),

            // Methods
            new Paragraph({
              text: 'Methods',
              heading: HeadingLevel.HEADING_1,
            }),

            new Paragraph({
              text: 'Eligibility Criteria',
              heading: HeadingLevel.HEADING_2,
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Population: ', bold: true }),
                new TextRun({ text: state.criteria?.pcc.population || 'N/A' }),
              ],
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Concept: ', bold: true }),
                new TextRun({ text: state.criteria?.pcc.concept || 'N/A' }),
              ],
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Context: ', bold: true }),
                new TextRun({ text: state.criteria?.pcc.context || 'N/A' }),
              ],
            }),

            new Paragraph({ text: '' }),

            // Results
            new Paragraph({
              text: 'Results',
              heading: HeadingLevel.HEADING_1,
            }),

            new Paragraph({
              text: 'Study Selection',
              heading: HeadingLevel.HEADING_2,
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: `The PRISMA flow diagram (Figure 1) illustrates the study selection process. Of ${state.prisma_counts.identified} records identified, ${state.prisma_counts.included} studies were included in the final review.`,
                }),
              ],
            }),

            new Paragraph({ text: '' }),

            new Paragraph({
              text: 'Study Characteristics',
              heading: HeadingLevel.HEADING_2,
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: `Table 1 presents the characteristics of included studies. [User should insert table from CSV export]`,
                }),
              ],
            }),

            new Paragraph({ text: '' }),

            // Discussion
            new Paragraph({
              text: 'Discussion',
              heading: HeadingLevel.HEADING_1,
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: '[User to complete based on synthesis of findings]',
                  italics: true,
                }),
              ],
            }),

            new Paragraph({ text: '' }),

            // References
            new Paragraph({
              text: 'References',
              heading: HeadingLevel.HEADING_1,
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: '[User to add references for included studies]',
                  italics: true,
                }),
              ],
            }),

            new Paragraph({ text: '' }),

            // Appendices
            new Paragraph({
              text: 'Appendices',
              heading: HeadingLevel.HEADING_1,
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: 'Appendix A: Search Strategies',
                  bold: true,
                }),
              ],
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: '[User to insert search strategies]',
                  italics: true,
                }),
              ],
            }),

            new Paragraph({ text: '' }),

            new Paragraph({
              children: [
                new TextRun({
                  text: 'Appendix B: Excluded Studies',
                  bold: true,
                }),
              ],
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: `${state.prisma_counts.fulltext_excluded.length} studies were excluded at full-text stage. Reasons for exclusion are available in the supplementary materials.`,
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);
    return outputPath;
  }

  /**
   * Generate LaTeX manuscript template
   */
  async generateLatexManuscript(
    state: GlobalState,
    outputPath: string
  ): Promise<string> {
    const latex = `\\documentclass[12pt]{article}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\title{Scoping Review: PRISMA-ScR Compliant Report}
\\author{[Author Names]}
\\date{${new Date().toLocaleDateString()}}

\\begin{document}

\\maketitle

\\begin{abstract}
This scoping review identified ${state.prisma_counts.identified} records from database searches. After deduplication (${state.prisma_counts.deduplicated} unique records) and title/abstract screening, ${state.prisma_counts.fulltext_retrieved} full-text articles were assessed for eligibility. A total of ${state.prisma_counts.included} studies met the inclusion criteria and were included in the final review.
\\end{abstract}

\\section{Introduction}
[User to complete]

\\section{Methods}

\\subsection{Eligibility Criteria}
\\textbf{Population:} ${state.criteria?.pcc.population || 'N/A'}

\\textbf{Concept:} ${state.criteria?.pcc.concept || 'N/A'}

\\textbf{Context:} ${state.criteria?.pcc.context || 'N/A'}

\\subsection{Information Sources}
[User to specify databases searched]

\\subsection{Search Strategy}
[User to include full search strategies]

\\subsection{Selection Process}
Studies were screened independently by three reviewers using an automated multi-agent system. Conflicts were resolved through adjudication.

\\section{Results}

\\subsection{Study Selection}
Figure \\ref{fig:prisma} shows the PRISMA flow diagram illustrating the study selection process.

\\begin{figure}[h]
  \\centering
  \\includegraphics[width=0.8\\textwidth]{../figures/prisma_flow.svg}
  \\caption{PRISMA flow diagram}
  \\label{fig:prisma}
\\end{figure}

\\subsection{Study Characteristics}
Table \\ref{tab:characteristics} presents the characteristics of included studies.

\\begin{table}[h]
  \\centering
  \\caption{Characteristics of included studies}
  \\label{tab:characteristics}
  \\begin{tabular}{llll}
    \\toprule
    Study & Design & Country & Sample Size \\\\
    \\midrule
    [Import from CSV] & & & \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

\\subsection{Results of Individual Sources}
[User to synthesize key findings]

\\section{Discussion}

\\subsection{Summary of Evidence}
[User to complete]

\\subsection{Limitations}
[User to discuss limitations]

\\section{Conclusions}
[User to provide conclusions]

\\section*{Funding}
[User to declare funding sources]

\\section*{Acknowledgments}
This scoping review was conducted using AUTOSCOPE, an automated screening system powered by Claude AI.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, latex);
    return outputPath;
  }

  /**
   * Export study characteristics to CSV
   */
  async exportStudyCharacteristicsCsv(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(
      extractions.map((e) => [e.study_id, e])
    );

    const headers = [
      'Study ID',
      'Title',
      'Authors',
      'Year',
      'Journal',
      'DOI',
      'Design',
      'Country',
      'Sample Size',
      'Intervention/Concept',
      'Key Findings',
    ];

    const rows = studies.map((study) => {
      const extraction = extractionMap.get(study.study_id);
      return [
        study.study_id,
        this.escapeCsv(study.title),
        this.escapeCsv(study.authors.join('; ')),
        study.year,
        this.escapeCsv(study.journal),
        study.doi || 'N/A',
        this.escapeCsv(extraction?.design || 'N/A'),
        this.escapeCsv(extraction?.country || 'N/A'),
        this.escapeCsv(extraction?.sample_size || 'N/A'),
        this.escapeCsv(extraction?.intervention_or_concept || 'N/A'),
        this.escapeCsv(extraction?.key_findings?.join('; ') || 'N/A'),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Export decisions to CSV
   */
  async exportDecisionsCsv(
    decisions: ConsensusDecision[],
    outputPath: string
  ): Promise<string> {
    const headers = [
      'Study ID',
      'Stage',
      'Consensus',
      'Final Decision',
      'Vote Count Include',
      'Vote Count Exclude',
      'Vote Count Unsure',
      'Adjudicator Used',
      'Timestamp',
    ];

    const rows = decisions.map((decision) => {
      const includeCount = decision.votes.filter((v) => v.decision === 'include').length;
      const excludeCount = decision.votes.filter((v) => v.decision === 'exclude').length;
      const unsureCount = decision.votes.filter((v) => v.decision === 'unsure').length;

      return [
        decision.study_id,
        decision.stage,
        decision.consensus,
        decision.final_decision,
        includeCount,
        excludeCount,
        unsureCount,
        decision.adjudicator_rationale ? 'Yes' : 'No',
        decision.timestamp,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Escape CSV field
   */
  private escapeCsv(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
