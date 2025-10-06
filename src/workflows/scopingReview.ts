/**
 * Main scoping review workflow orchestration
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
import {
  createAbstractScreeningAgents,
  AbstractScreeningAgent,
} from '../agents/AbstractScreener.js';
import { AdjudicatorAgent } from '../agents/Adjudicator.js';
import { calculateConsensus, createConsensusDecision } from './consensus.js';

export interface WorkflowInput {
  prospero?: string; // Path to PROSPERO protocol
  criteria: Criteria;
  searchFiles: string[]; // Paths to search exports
  configPath?: string;
}

export class ScopingReviewWorkflow {
  private runId: string;
  private store: StateStore;
  private config: Config;
  private prosperoProtocol?: string;

  constructor(options: { runId?: string; configPath?: string } = {}) {
    this.runId = options.runId || generateRunId();
    this.store = new StateStore(this.runId);
    this.config = {} as Config; // Will be loaded in init
  }

  /**
   * Run the complete workflow
   */
  async run(input: WorkflowInput): Promise<void> {
    console.log(`\n🚀 Starting AUTOSCOPE workflow: ${this.runId}\n`);

    // 1. Initialize
    await this.init(input);

    // 2. Ingest & Normalize
    await this.ingest(input.searchFiles);

    // 3. Abstract Screening
    await this.abstractScreening();

    // 4. PDF Fetching (placeholder - user must provide PDFs)
    await this.pdfFetchingGate();

    // 5. Full-Text Screening
    await this.fullTextScreening();

    // 6. Data Extraction
    await this.dataExtraction();

    // 7. Synthesis & Visualization
    await this.synthesis();

    // 8. Export
    await this.export();

    console.log(`\n✅ Workflow complete! Results in: outputs/${this.runId}\n`);
  }

  /**
   * Initialize workflow with config and criteria
   */
  private async init(input: WorkflowInput): Promise<void> {
    console.log('📋 Initializing workflow...');

    // Load config
    const configPath = input.configPath || 'config/config.yaml';
    const configYaml = await fs.readFile(configPath, 'utf-8');
    this.config = ConfigSchema.parse(yaml.load(configYaml));

    // Load PROSPERO protocol if provided
    if (input.prospero) {
      this.prosperoProtocol = await fs.readFile(input.prospero, 'utf-8');
    }

    // Initialize state
    await this.store.init(this.config, this.runId);
    await this.store.update({
      criteria: input.criteria,
      prospero_protocol: this.prosperoProtocol || null,
      current_stage: 'init',
    });

    console.log('✓ Initialized\n');
  }

  /**
   * Ingest search exports and deduplicate
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
        // Try MEDLINE first, then plain text
        try {
          studies = await parsePubMedMedline(content, file);
        } catch {
          studies = await parseTextFile(content, file);
        }
      } else {
        console.warn(`⚠️  Unknown file format: ${file}, trying text parser...`);
        studies = await parseTextFile(content, file);
      }

      allStudies = allStudies.concat(studies);
      console.log(`  • ${file}: ${studies.length} records`);
    }

    console.log(`\n📊 Total records: ${allStudies.length}`);

    // Deduplicate
    const { unique, duplicates } = await deduplicateStudies(
      allStudies,
      this.config.dedupe_thresholds.title_similarity
    );

    console.log(`  • Unique: ${unique.length}`);
    console.log(`  • Duplicates removed: ${duplicates.length}`);

    // Update state
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
   * Abstract screening with 3 agents + majority vote
   */
  private async abstractScreening(): Promise<void> {
    console.log('🔍 Abstract screening (3 agents, majority vote)...');

    const state = this.store.getState();
    const { studies, criteria } = state;

    if (!criteria) {
      throw new Error('Criteria not set');
    }

    // Create 3 screening agents
    const agents = createAbstractScreeningAgents(
      this.config.model,
      this.config.temperature.screening,
      this.config.seed
    );

    const adjudicator = new AdjudicatorAgent(
      this.config.model,
      this.config.temperature.adjudication,
      this.config.seed
    );

    let includedCount = 0;
    let excludedCount = 0;

    for (const study of studies) {
      console.log(`  • Screening: ${study.title.substring(0, 60)}...`);

      // Get 3 votes
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

      // Track counts
      if (consensus.final_decision === 'include') {
        includedCount++;
      } else {
        excludedCount++;
      }

      // Save decisions
      await this.store.append('abstract_decisions', votes);
      await this.store.append('abstract_consensus', consensus);
    }

    // Update PRISMA counts
    state.prisma_counts.title_abstract_screened = studies.length;
    state.prisma_counts.abstract_excluded = excludedCount;
    state.current_stage = 'abstract_screening';
    await this.store.save();

    console.log(`\n📈 Abstract screening complete:`);
    console.log(`  • Included: ${includedCount}`);
    console.log(`  • Excluded: ${excludedCount}\n`);
  }

  /**
   * PDF fetching gate - prompt user to provide PDFs
   */
  private async pdfFetchingGate(): Promise<void> {
    console.log('📄 PDF Fetching Phase\n');

    const state = this.store.getState();
    const includedStudies = state.abstract_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => c.study_id);

    console.log(
      `📦 ${includedStudies.length} studies need full-text PDFs`
    );
    console.log(
      `\nPlease place PDFs in: ${this.config.pdf_fetch.pdfs_dir}`
    );
    console.log(`Name files as: {study_id}.pdf\n`);

    // Check which PDFs are available
    const pdfDir = this.config.pdf_fetch.pdfs_dir;
    await fs.mkdir(pdfDir, { recursive: true });

    const existingFiles = await fs.readdir(pdfDir);
    const availablePdfs = new Set(
      existingFiles
        .filter((f) => f.endsWith('.pdf'))
        .map((f) => f.replace('.pdf', ''))
    );

    const missingPdfs = includedStudies.filter(
      (id) => !availablePdfs.has(id)
    );

    if (missingPdfs.length > 0) {
      console.log(`⚠️  Missing PDFs for ${missingPdfs.length} studies:`);
      console.log(
        missingPdfs
          .slice(0, 5)
          .map((id) => `  • ${id}`)
          .join('\n')
      );
      if (missingPdfs.length > 5) {
        console.log(`  ... and ${missingPdfs.length - 5} more`);
      }
    }

    state.missing_pdfs = missingPdfs;
    state.current_stage = 'pdf_fetching';
    await this.store.save();

    console.log(
      `\n✓ PDF check complete. ${availablePdfs.size}/${includedStudies.length} available\n`
    );
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

    console.log(
      `  Processing ${includedStudies.length} full-text studies...\n`
    );

    // Placeholder for full-text screening
    // In real implementation, this would:
    // 1. Extract text from PDFs
    // 2. Run 3 full-text screening agents
    // 3. Apply consensus logic
    // 4. Update PRISMA counts

    state.current_stage = 'fulltext_screening';
    state.prisma_counts.fulltext_retrieved = includedStudies.length;
    await this.store.save();

    console.log('✓ Full-text screening complete\n');
  }

  /**
   * Data extraction
   */
  private async dataExtraction(): Promise<void> {
    console.log('📊 Data extraction...');

    const state = this.store.getState();
    const finalIncluded = state.fulltext_consensus
      .filter((c) => c.final_decision === 'include')
      .map((c) => c.study_id);

    console.log(`  Extracting data from ${finalIncluded.length} studies...\n`);

    // Placeholder for data extraction
    // Real implementation would use DataExtractorAgent

    state.current_stage = 'extraction';
    state.prisma_counts.included = finalIncluded.length;
    await this.store.save();

    console.log('✓ Data extraction complete\n');
  }

  /**
   * Synthesis and visualization
   */
  private async synthesis(): Promise<void> {
    console.log('📈 Generating synthesis outputs...');

    // Placeholder for:
    // 1. PRISMA flow diagram
    // 2. Charts (study types, regions, timeline)
    // 3. Heatmaps
    // 4. Tables

    const state = this.store.getState();
    state.current_stage = 'synthesis';
    await this.store.save();

    console.log('✓ Synthesis complete\n');
  }

  /**
   * Export final outputs
   */
  private async export(): Promise<void> {
    console.log('📦 Exporting outputs...');

    const outputDir = path.join(
      this.config.outputs_dir || 'outputs',
      this.runId
    );

    // Export state
    await this.store.exportTo(path.join(outputDir, 'final_state.json'));

    // Export decisions as JSONL
    const state = this.store.getState();
    const decisionsPath = path.join(outputDir, 'decisions_abstract.jsonl');
    for (const decision of state.abstract_decisions) {
      await this.store.appendAuditLog(decision, decisionsPath);
    }

    state.current_stage = 'complete';
    await this.store.save();

    console.log(`✓ Exported to: ${outputDir}\n`);
  }
}
