/**
 * Main scoping review workflow orchestration - FULL IMPLEMENTATION
 * Coordinates all agents and manages state transitions
 */

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  Criteria,
  Study,
  Config,
  ConfigSchema,
  ConsensusDecision,
} from '../state/schemas.js';
import { StateStore, generateRunId } from '../state/store.js';
import { parseRisFile } from '../tools/risParser.js';
import { parsePubMedXml, parsePubMedMedline } from '../tools/pubmedParser.js';
import { parseTextFile } from '../tools/textParser.js';
import { deduplicateStudies } from '../tools/dedupe.js';
import { extractPdfText, ExtractedPdf } from '../tools/pdfExtract.js';
import { createAbstractScreeningAgents } from '../agents/AbstractScreener.real.js';
import { createFullTextScreeningAgents } from '../agents/FullTextScreener.js';
import { AdjudicatorAgent } from '../agents/Adjudicator.real.js';
import { DataExtractorAgent } from '../agents/DataExtractor.js';
import { calculateConsensus, createConsensusDecision } from './consensus.js';
import { PrismaFlowGenerator } from '../tools/prismaFlow.js';
import { ChartGenerator } from '../tools/charts.js';
import { DocumentWriter } from '../tools/writers.js';
import { PdfFetcher } from '../tools/pdfFetch.js';
import { PdfToMarkdownConverter } from '../agents/PdfToMarkdownConverter.js';
import { MarkdownQualityChecker } from '../agents/MarkdownQualityChecker.js';
import { ExtractionTableGenerator } from '../tools/extractionTables.js';

export interface WorkflowInput {
  prospero?: string;
  criteria: Criteria;
  searchFiles: string[];
  configPath?: string;
}

export class ScopingReviewWorkflow {
  private runId: string;
  private store: StateStore;
  private config: Config;
  private prosperoProtocol?: string;
  private apiKey: string;

  constructor(
    apiKey: string,
    options: { runId?: string; configPath?: string } = {}
  ) {
    this.apiKey = apiKey;
    this.runId = options.runId || generateRunId();
    this.store = new StateStore(this.runId);
    this.config = {} as Config;
  }

  /**
   * Run the complete workflow
   */
  async run(input: WorkflowInput): Promise<void> {
    console.log(`\n🔬 ReviewScope Workflow: ${this.runId}\n`);

    try {
      // Check if resuming from existing state
      const isResume = await this.checkForExistingState();

      if (isResume) {
        console.log('📂 Resuming from existing state...\n');
        await this.store.load();
        const state = this.store.getState();
        console.log(`   Current stage: ${state.current_stage}`);
        console.log(`   Studies: ${state.studies.length}\n`);
      } else {
        // 1. Initialize
        await this.init(input);

        // 2. Ingest & Normalize (skip if resuming)
        if (input.searchFiles && input.searchFiles.length > 0) {
          await this.ingest(input.searchFiles);
        }
      }

      const state = this.store.getState();

      // 3. Abstract Screening
      if (this.shouldRunStage(state.current_stage, 'abstract_screening')) {
        await this.abstractScreening();
      }

      // 4. PDF Fetching
      if (this.shouldRunStage(state.current_stage, 'pdf_fetching')) {
        await this.pdfFetchingGate();
      }

      // 5. PDF to Markdown Conversion (TEMPORARILY DISABLED - rate limits)
      // if (this.shouldRunStage(state.current_stage, 'pdf_to_markdown')) {
      //   await this.pdfToMarkdownConversion();
      // }

      // 6. Full-Text Screening
      if (this.shouldRunStage(state.current_stage, 'fulltext_screening')) {
        await this.fullTextScreening();
      }

      // 7. Data Extraction
      if (this.shouldRunStage(state.current_stage, 'extraction')) {
        await this.dataExtraction();
      }

      // 8. Synthesis & Visualization
      if (this.shouldRunStage(state.current_stage, 'synthesis')) {
        await this.synthesis();
      }

      // 9. Export
      if (this.shouldRunStage(state.current_stage, 'complete')) {
        await this.export();
      }

      console.log(`\n✅ Workflow complete! Results in: outputs/${this.runId}\n`);
    } catch (error) {
      console.error(`\n❌ Workflow failed:`, error);
      await this.store.save(); // Save state before exiting
      throw error;
    }
  }

  /**
   * Check if there's an existing state to resume from
   */
  private async checkForExistingState(): Promise<boolean> {
    try {
      await this.store.load();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determine if a stage should run based on current workflow stage
   */
  private shouldRunStage(currentStage: string, targetStage: string): boolean {
    const stageOrder = [
      'init',
      'ingested',
      'abstract_screening',
      'pdf_fetching',
      'pdf_to_markdown',
      'fulltext_screening',
      'extraction',
      'synthesis',
      'complete',
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    const targetIndex = stageOrder.indexOf(targetStage);

    return targetIndex >= currentIndex;
  }

  /**
   * Initialize workflow
   */
  private async init(input: WorkflowInput): Promise<void> {
    console.log('📋 Initializing workflow...');

    const configPath = input.configPath || 'config/config.yaml';
    const configYaml = await fs.readFile(configPath, 'utf-8');
    this.config = ConfigSchema.parse(yaml.load(configYaml));

    if (input.prospero) {
      this.prosperoProtocol = await fs.readFile(input.prospero, 'utf-8');
    }

    await this.store.init(this.config, this.runId);
    await this.store.update({
      criteria: input.criteria,
      prospero_protocol: this.prosperoProtocol || null,
      current_stage: 'init',
    });

    console.log('✓ Initialized\n');
  }

  /**
   * Ingest search exports
   */
  private async ingest(searchFiles: string[]): Promise<void> {
    console.log('📥 Ingesting search exports...');

    let allStudies: Study[] = [];

    for (const file of searchFiles) {
      const ext = path.extname(file).toLowerCase();
      const content = await fs.readFile(file, 'utf-8');
      let studies: Study[] = [];

      if (ext === '.ris') {
        studies = await parseRisFile(content, file);
      } else if (ext === '.xml') {
        studies = await parsePubMedXml(content, file);
      } else if (ext === '.txt') {
        try {
          studies = await parsePubMedMedline(content, file);
        } catch {
          studies = await parseTextFile(content, file);
        }
      } else {
        studies = await parseTextFile(content, file);
      }

      allStudies = allStudies.concat(studies);
      console.log(`  • ${file}: ${studies.length} records`);
    }

    console.log(`\n📊 Total records: ${allStudies.length}`);

    const { unique, duplicates } = await deduplicateStudies(
      allStudies,
      this.config.dedupe_thresholds.title_similarity
    );

    console.log(`  • Unique: ${unique.length}`);
    console.log(`  • Duplicates removed: ${duplicates.length}`);

    await this.store.update({
      studies: unique,
      current_stage: 'ingested',
    });

    const state = this.store.getState();
    state.prisma_counts.identified = allStudies.length;
    state.prisma_counts.deduplicated = unique.length;
    await this.store.save();

    console.log('✓ Ingest complete\n');
  }

  /**
   * Abstract screening with 3 agents
   */
  private async abstractScreening(): Promise<void> {
    console.log('🔍 Abstract screening (3 agents, majority vote)...');

    const state = this.store.getState();
    const { studies, criteria } = state;

    if (!criteria) throw new Error('Criteria not set');

    const agents = createAbstractScreeningAgents(
      this.apiKey,
      this.config.model,
      this.config.temperature.screening,
      this.config.seed
    );

    const adjudicator = new AdjudicatorAgent(
      this.apiKey,
      this.config.model,
      this.config.temperature.adjudication,
      this.config.seed
    );

    let includedCount = 0;
    let excludedCount = 0;

    for (const study of studies) {
      console.log(`  • Screening: ${study.title.substring(0, 60)}...`);

      // Get 3 votes in parallel
      const votes = await Promise.all(
        agents.map((agent) =>
          agent.screen(study, criteria, this.prosperoProtocol)
        )
      );

      // Calculate consensus
      const { needsAdjudication, preliminaryConsensus } = calculateConsensus(
        study.study_id,
        votes,
        'abstract'
      );

      let consensus: ConsensusDecision;

      if (needsAdjudication) {
        console.log(`    ⚖️  Escalating to adjudicator...`);
        const adjudication = await adjudicator.adjudicate(
          study,
          votes,
          criteria,
          'abstract',
          undefined,
          this.prosperoProtocol
        );

        consensus = createConsensusDecision(
          study.study_id,
          votes,
          'abstract',
          adjudication.adjudicator_rationale
        );
        consensus.final_decision = adjudication.final_decision;
      } else {
        consensus = createConsensusDecision(study.study_id, votes, 'abstract');
      }

      if (consensus.final_decision === 'include') {
        includedCount++;
      } else {
        excludedCount++;
      }

      await this.store.append('abstract_decisions', votes);
      await this.store.append('abstract_consensus', consensus);

      // Save periodically
      if ((includedCount + excludedCount) % 10 === 0) {
        await this.store.save();
      }
    }

    state.prisma_counts.title_abstract_screened = studies.length;
    state.prisma_counts.abstract_excluded = excludedCount;
    state.current_stage = 'abstract_screening';
    await this.store.save();

    console.log(`\n📈 Abstract screening complete:`);
    console.log(`  • Included: ${includedCount}`);
    console.log(`  • Excluded: ${excludedCount}\n`);

    // Generate PDF download table for included studies
    if (includedCount > 0) {
      await this.generatePdfDownloadTable();
    }
  }

  /**
   * PDF fetching gate
   */
  private async pdfFetchingGate(): Promise<void> {
    console.log('📄 PDF Fetching Phase\n');

    const state = this.store.getState();
    const includedStudies = state.abstract_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => state.studies.find((s) => s.study_id === c.study_id)!)
      .filter(Boolean);

    const fetcher = new PdfFetcher(
      this.config.pdf_fetch.pdfs_dir,
      this.config.pdf_fetch.logs_dir
    );

    const { available, missing } = await fetcher.checkAvailablePdfs(
      includedStudies
    );

    console.log(`📦 ${includedStudies.length} studies need full-text PDFs`);
    console.log(`  ✓ Available: ${available.size}`);
    console.log(`  ✗ Missing: ${missing.length}\n`);

    if (missing.length > 0) {
      const instructions = fetcher.generateUploadInstructions(
        missing,
        state.studies
      );
      console.log(instructions);

      // Save missing list
      const missingPath = path.join(this.config.pdf_fetch.logs_dir, this.runId, 'missing_pdfs.json');
      await fs.mkdir(path.dirname(missingPath), { recursive: true });
      await fs.writeFile(missingPath, JSON.stringify(missing, null, 2));
    }

    state.missing_pdfs = missing;
    state.current_stage = 'pdf_fetching';
    state.prisma_counts.fulltext_retrieved = available.size;
    await this.store.save();

    console.log(`✓ PDF check complete\n`);
  }

  /**
   * PDF to Markdown Conversion
   * Two agents convert PDFs to markdown, third agent reviews and selects best
   */
  private async pdfToMarkdownConversion(): Promise<void> {
    console.log('📝 Converting PDFs to Markdown...\n');

    const state = this.store.getState();
    const includedStudies = state.abstract_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => state.studies.find((s) => s.study_id === c.study_id)!)
      .filter(Boolean);

    // Create converter agents
    const converter1 = new PdfToMarkdownConverter(
      this.apiKey,
      this.config.model,
      'markdown-converter-1'
    );
    const converter2 = new PdfToMarkdownConverter(
      this.apiKey,
      this.config.model,
      'markdown-converter-2'
    );
    const qualityChecker = new MarkdownQualityChecker(this.apiKey, this.config.model);

    const markdownResults: Map<string, string> = new Map();
    const outputDir = path.join('outputs', this.runId, 'markdown');
    await fs.mkdir(outputDir, { recursive: true });

    let convertedCount = 0;
    let skippedCount = 0;

    // Process 3 studies at a time
    const batchSize = 1; // Process one at a time to avoid rate limits
    for (let i = 0; i < includedStudies.length; i += batchSize) {
      const batch = includedStudies.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (study) => {
          const pdfPath = path.join(this.config.pdf_fetch.pdfs_dir, `${study.study_id}.pdf`);

          try {
            // Check if PDF exists
            await fs.access(pdfPath);

            // Extract PDF text
            const pdfText = await extractPdfText(pdfPath, study.study_id, false);

            console.log(`  • Converting: ${study.title.substring(0, 60)}...`);

            // Get two conversions in parallel
            const [conversion1, conversion2] = await Promise.all([
              converter1.convert(study.study_id, pdfText, study.title),
              converter2.convert(study.study_id, pdfText, study.title),
            ]);

            console.log(`    Agent 1: Quality ${conversion1.quality_score}/10`);
            console.log(`    Agent 2: Quality ${conversion2.quality_score}/10`);

            // Quality checker selects best version
            const qualityCheck = await qualityChecker.check(
              study.study_id,
              pdfText,
              study.title,
              conversion1,
              conversion2
            );

            console.log(`    ✓ Selected: ${qualityCheck.selected_version}`);

            // Determine final markdown
            let finalMarkdown: string;
            if (qualityCheck.selected_version === 'agent_1') {
              finalMarkdown = conversion1.markdown;
            } else if (qualityCheck.selected_version === 'agent_2') {
              finalMarkdown = conversion2.markdown;
            } else {
              // Hybrid version
              finalMarkdown = qualityCheck.final_markdown || conversion1.markdown;
            }

            // Save markdown
            const markdownPath = path.join(outputDir, `${study.study_id}.md`);
            await fs.writeFile(markdownPath, finalMarkdown);

            markdownResults.set(study.study_id, finalMarkdown);
            convertedCount++;

            // Save quality check result
            const qaPath = path.join(outputDir, `${study.study_id}_qa.json`);
            await fs.writeFile(
              qaPath,
              JSON.stringify(
                {
                  study_id: study.study_id,
                  title: study.title,
                  conversion1_quality: conversion1.quality_score,
                  conversion2_quality: conversion2.quality_score,
                  selected: qualityCheck.selected_version,
                  quality_scores: qualityCheck.quality_scores,
                  rationale: qualityCheck.rationale,
                },
                null,
                2
              )
            );
          } catch (error) {
            console.log(`    ⚠️  Could not convert PDF for ${study.study_id}`);
            skippedCount++;
          }
        })
      );
    }

    state.current_stage = 'pdf_to_markdown';
    await this.store.save();

    console.log(`\n📈 PDF to Markdown conversion complete:`);
    console.log(`  • Converted: ${convertedCount}`);
    console.log(`  • Skipped: ${skippedCount}`);
    console.log(`  • Markdown files: ${outputDir}\n`);
  }

  /**
   * Full-text screening
   */
  private async fullTextScreening(): Promise<void> {
    console.log('📖 Full-text screening...');

    const state = this.store.getState();
    const includedStudies = state.abstract_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => state.studies.find((s) => s.study_id === c.study_id)!)
      .filter(Boolean);

    const agents = createFullTextScreeningAgents(
      this.apiKey,
      this.config.model,
      this.config.temperature.screening,
      this.config.seed
    );

    const adjudicator = new AdjudicatorAgent(
      this.apiKey,
      this.config.model,
      this.config.temperature.adjudication,
      this.config.seed
    );

    const pdfExtractionsMap = new Map<string, ExtractedPdf>();

    // Extract all PDFs first
    for (const study of includedStudies) {
      const pdfPath = path.join(this.config.pdf_fetch.pdfs_dir, `${study.study_id}.pdf`);

      try {
        const extraction = await extractPdfText(
          pdfPath,
          study.study_id,
          this.config.ocr_enabled
        );
        pdfExtractionsMap.set(study.study_id, extraction);
      } catch (error) {
        console.log(`  ⚠️  Could not extract PDF for ${study.study_id}`);
      }
    }

    let includedCount = 0;

    // Screen each study
    for (const study of includedStudies) {
      const pdfText = pdfExtractionsMap.get(study.study_id);
      if (!pdfText) continue;

      console.log(`  • Screening: ${study.title.substring(0, 60)}...`);

      const votes = await Promise.all(
        agents.map((agent) =>
          agent.screen(study, pdfText, state.criteria!, this.prosperoProtocol)
        )
      );

      const { needsAdjudication } = calculateConsensus(
        study.study_id,
        votes,
        'fulltext'
      );

      let consensus: ConsensusDecision;

      if (needsAdjudication) {
        console.log(`    ⚖️  Escalating to adjudicator...`);
        const adjudication = await adjudicator.adjudicate(
          study,
          votes,
          state.criteria!,
          'fulltext',
          pdfText,
          this.prosperoProtocol
        );

        consensus = createConsensusDecision(
          study.study_id,
          votes,
          'fulltext',
          adjudication.adjudicator_rationale
        );
        consensus.final_decision = adjudication.final_decision;
      } else {
        consensus = createConsensusDecision(study.study_id, votes, 'fulltext');
      }

      if (consensus.final_decision === 'include') {
        includedCount++;
      } else {
        state.prisma_counts.fulltext_excluded.push({
          study_id: study.study_id,
          reason: consensus.votes[0].reasons[0] || 'See decision log',
        });
      }

      await this.store.append('fulltext_decisions', votes);
      await this.store.append('fulltext_consensus', consensus);
    }

    state.current_stage = 'fulltext_screening';
    state.prisma_counts.included = includedCount;
    await this.store.save();

    console.log(`\n📈 Full-text screening complete:`);
    console.log(`  • Included: ${includedCount}\n`);
  }

  /**
   * Data extraction
   */
  private async dataExtraction(): Promise<void> {
    console.log('📊 Data extraction...');

    const state = this.store.getState();
    const finalIncluded = state.fulltext_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => state.studies.find((s) => s.study_id === c.study_id)!)
      .filter(Boolean);

    const extractor = new DataExtractorAgent(
      this.apiKey,
      this.config.model,
      this.config.temperature.extraction
    );

    const studiesWithPdfs: Array<{ study: Study; pdfText: ExtractedPdf }> = [];

    for (const study of finalIncluded) {
      const pdfPath = path.join(this.config.pdf_fetch.pdfs_dir, `${study.study_id}.pdf`);

      try {
        const pdfText = await extractPdfText(pdfPath, study.study_id, this.config.ocr_enabled);
        studiesWithPdfs.push({ study, pdfText });
      } catch (error) {
        console.log(`  ⚠️  Could not extract PDF for ${study.study_id}`);
      }
    }

    const extractions = await extractor.extractBatch(studiesWithPdfs);

    state.extractions = extractions;
    state.current_stage = 'extraction';
    await this.store.save();

    console.log(`✓ Data extraction complete (${extractions.length} studies)\n`);
  }

  /**
   * Synthesis and visualization
   */
  private async synthesis(): Promise<void> {
    console.log('📈 Generating synthesis outputs...');

    const state = this.store.getState();
    const outputDir = path.join('outputs', this.runId);

    // PRISMA flow diagram
    const prismaGen = new PrismaFlowGenerator();
    await prismaGen.generateSvg(
      state.prisma_counts,
      path.join(outputDir, 'figures/prisma_flow.svg')
    );

    // Charts
    const chartGen = new ChartGenerator();
    await chartGen.generateStudyTypesChart(
      state.extractions,
      path.join(outputDir, 'figures/study_types.svg')
    );

    await chartGen.generateGeographicChart(
      state.extractions,
      path.join(outputDir, 'figures/geographic.svg')
    );

    await chartGen.generateTimelineChart(
      state.studies,
      path.join(outputDir, 'figures/timeline.svg')
    );

    state.current_stage = 'synthesis';
    await this.store.save();

    console.log('✓ Synthesis complete\n');
  }

  /**
   * Export final outputs
   */
  /**
   * Generate PDF download table for included studies after abstract screening
   * Simple format: study_id, title, authors, doi, year, journal
   */
  private async generatePdfDownloadTable(): Promise<void> {
    const state = this.store.getState();
    const outputDir = path.join('outputs', this.runId);

    const includedStudies = state.abstract_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => state.studies.find((s) => s.study_id === c.study_id)!)
      .filter(Boolean);

    if (includedStudies.length === 0) return;

    // Generate simple CSV with essential information
    const rows = ['Study_ID,Title,Authors,DOI,Year,Journal,PDF_Filename'];

    includedStudies.forEach((study) => {
      const title = this.escapeCsv(study.title || 'No title');
      const authors = this.escapeCsv(study.authors.join('; '));
      const doi = study.doi || '';
      const year = study.year || '';
      const journal = this.escapeCsv(study.journal || '');
      const pdfFilename = `${study.study_id}.pdf`;

      rows.push(
        [study.study_id, title, authors, doi, year, journal, pdfFilename].join(',')
      );
    });

    // Save CSV
    const csvPath = path.join(outputDir, 'studies_for_fulltext_screening.csv');
    await fs.mkdir(path.dirname(csvPath), { recursive: true });
    await fs.writeFile(csvPath, rows.join('\n'));

    console.log(`\n📄 Studies for full-text screening:`);
    console.log(`  • ${csvPath}`);
    console.log(`  • ${includedStudies.length} studies passed abstract screening\n`);
    console.log(`📥 Next steps:`);
    console.log(`  1. Open the CSV file to see which studies need PDFs`);
    console.log(`  2. Download PDFs using the DOI links`);
    console.log(`  3. Save PDFs to the pdfs/ directory with the filename shown in the CSV`);
    console.log(`  4. Re-run the workflow to continue with full-text screening\n`);
  }

  /**
   * Escape CSV field
   */
  private escapeCsv(field: string): string {
    if (!field) return '';
    const cleaned = field.replace(/\n/g, ' ').replace(/\r/g, '').trim();
    if (cleaned.includes(',') || cleaned.includes('"') || cleaned.includes('\n')) {
      return `"${cleaned.replace(/"/g, '""')}"`;
    }
    return cleaned;
  }

  private async export(): Promise<void> {
    console.log('📦 Exporting outputs...');

    const state = this.store.getState();
    const outputDir = path.join('outputs', this.runId);
    const tablesDir = path.join(outputDir, 'tables');

    const writer = new DocumentWriter();

    // Word manuscript
    await writer.generateWordManuscript(
      state,
      path.join(outputDir, 'manuscript/template.docx')
    );

    // LaTeX manuscript
    await writer.generateLatexManuscript(
      state,
      path.join(outputDir, 'manuscript/template.tex')
    );

    // Get included studies
    const includedStudies = state.fulltext_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => state.studies.find((s) => s.study_id === c.study_id)!)
      .filter(Boolean);

    // Basic study characteristics (legacy format for compatibility)
    await writer.exportStudyCharacteristicsCsv(
      includedStudies,
      state.extractions,
      path.join(tablesDir, 'study_characteristics.csv')
    );

    // Decision tables
    await writer.exportDecisionsCsv(
      state.abstract_consensus,
      path.join(tablesDir, 'abstract_decisions.csv')
    );

    await writer.exportDecisionsCsv(
      state.fulltext_consensus,
      path.join(tablesDir, 'fulltext_decisions.csv')
    );

    // Generate comprehensive extraction tables
    console.log('\n📊 Generating comprehensive extraction tables...');
    const tableGenerator = new ExtractionTableGenerator();
    const generatedTables = await tableGenerator.generateAllTables(
      includedStudies,
      state.extractions,
      path.join(tablesDir, 'extraction')
    );

    console.log('\n✅ Extraction tables generated:');
    Object.entries(generatedTables).forEach(([name, filePath]) => {
      const fileName = path.basename(filePath);
      console.log(`  • ${fileName}`);
    });

    // Generate summary statistics JSON
    const summaryStats = {
      total_included: includedStudies.length,
      designs: this.summarizeField(state.extractions, 'design'),
      countries: this.summarizeField(state.extractions, 'country'),
      regions: this.summarizeField(state.extractions, 'region'),
      setting_types: this.summarizeField(state.extractions, 'setting_type'),
      methodology_approaches: this.summarizeField(state.extractions, 'methodology_approach'),
      funding_types: this.summarizeField(state.extractions, 'funding_type'),
      income_levels: this.summarizeField(state.extractions, 'income_level'),
      data_completeness: this.summarizeField(state.extractions, 'data_completeness'),
      extraction_confidence: this.summarizeField(state.extractions, 'extraction_confidence'),
    };

    await fs.writeFile(
      path.join(tablesDir, 'extraction/summary_statistics.json'),
      JSON.stringify(summaryStats, null, 2)
    );

    state.current_stage = 'complete';
    await this.store.save();

    console.log(`\n✓ Exported to: ${outputDir}\n`);
  }

  /**
   * Helper to summarize a field across extractions
   */
  private summarizeField(extractions: any[], field: string): Record<string, number> {
    const summary: Record<string, number> = {};
    extractions.forEach((ext) => {
      const value = ext[field] || 'Not reported';
      summary[value] = (summary[value] || 0) + 1;
    });
    return summary;
  }
}
