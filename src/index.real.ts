#!/usr/bin/env node
/**
 * ReviewScope - Automated Scoping Review System
 * CLI entry point with real Anthropic SDK integration
 */

import { Command } from 'commander';
import { ScopingReviewWorkflow } from './workflows/scopingReview.real.js';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import { Criteria, CriteriaSchema } from './state/schemas.js';
import path from 'path';

const program = new Command();

program
  .name('reviewscope')
  .description('Automated Scoping Review System powered by Claude AI')
  .version('1.0.0')
  .addHelpText('after', `
Examples:
  $ reviewscope run --criteria my-criteria.yaml --search exports/*.ris
  $ reviewscope resume --run-id run-2025-01-05-abc123
  $ reviewscope init my-review-project
  $ reviewscope validate --criteria my-criteria.yaml

For detailed help on a command:
  $ reviewscope <command> --help
`);

program
  .command('run')
  .description('Run a new scoping review workflow')
  .requiredOption('--criteria <file>', 'Path to criteria YAML file')
  .option('--search <files...>', 'Search export files (.ris, .xml, .txt)')
  .option('--prospero <file>', 'Path to PROSPERO protocol (optional)')
  .option('--config <file>', 'Path to config.yaml', 'config/config.yaml')
  .option('--run-id <id>', 'Custom run ID (auto-generated if not provided)')
  .option('--api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .addHelpText('after', `
Examples:
  $ reviewscope run --criteria criteria.yaml --search pubmed.ris embase.ris
  $ reviewscope run --criteria criteria.yaml --search exports/*.txt --run-id diabetes-2025

Notes:
  • API key can be set via ANTHROPIC_API_KEY environment variable
  • Workflow is resumable - if interrupted, use 'reviewscope resume --run-id <id>'
  • After abstract screening, you'll need to download PDFs before continuing
`)
  .action(async (options) => {
    try {
      console.log('🔬 ReviewScope - Automated Scoping Review System\n');

      // Check API key
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error('❌ Error: ANTHROPIC_API_KEY not set\n');
        console.error('Please set your API key using one of these methods:');
        console.error('  1. Environment variable: export ANTHROPIC_API_KEY=your-key-here');
        console.error('  2. Command flag: --api-key your-key-here\n');
        console.error('Get your API key from: https://console.anthropic.com/\n');
        process.exit(1);
      }

      // Check if criteria file exists
      try {
        await fs.access(options.criteria);
      } catch {
        console.error(`❌ Error: Criteria file not found: ${options.criteria}\n`);
        console.error('Create a criteria file with this structure:');
        console.error(`
pcc:
  population: "Your target population"
  concept: "Your concept of interest"
  context: "Your study context"

inclusion:
  - "Inclusion criterion 1"
  - "Inclusion criterion 2"

exclusion:
  - "Exclusion criterion 1"
  - "Exclusion criterion 2"
`);
        console.error('Or run: reviewscope init <directory> to create a sample project\n');
        process.exit(1);
      }

      // Validate and load criteria
      let criteria: Criteria;
      try {
        const criteriaYaml = await fs.readFile(options.criteria, 'utf-8');
        criteria = CriteriaSchema.parse(yaml.load(criteriaYaml));
      } catch (error) {
        console.error(`❌ Error: Invalid criteria file format\n`);
        console.error('Run: reviewscope validate --criteria <file> for detailed validation\n');
        throw error;
      }

      // Check search files
      if (!options.search || options.search.length === 0) {
        console.error('⚠️  Warning: No search files provided\n');
        console.error('The workflow will start but you need to provide search export files.');
        console.error('Supported formats: .ris, .xml, .txt (PubMed/MEDLINE)\n');
      }

      // Create workflow
      const workflow = new ScopingReviewWorkflow(apiKey, {
        runId: options.runId,
        configPath: options.config,
      });

      console.log('📋 Configuration:');
      console.log(`  • Criteria: ${options.criteria}`);
      console.log(`  • Search files: ${options.search?.length || 0} file(s)`);
      if (options.prospero) console.log(`  • PROSPERO protocol: ${options.prospero}`);
      console.log('');

      // Run workflow
      await workflow.run({
        prospero: options.prospero,
        criteria,
        searchFiles: options.search || [],
        configPath: options.config,
      });
    } catch (error) {
      console.error('\n❌ Workflow failed');
      if (error instanceof Error) {
        console.error(`   ${error.message}\n`);
      }
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume an interrupted workflow')
  .requiredOption('--run-id <id>', 'Run ID to resume (e.g., run-2025-01-05-abc123)')
  .option('--api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('--config <file>', 'Path to config.yaml', 'config/config.yaml')
  .addHelpText('after', `
Examples:
  $ reviewscope resume --run-id run-2025-01-05-abc123

Notes:
  • Find run IDs in the outputs/ directory
  • The workflow will continue from where it left off
  • Useful if the process was interrupted or if you're adding PDFs after abstract screening
`)
  .action(async (options) => {
    try {
      console.log('🔬 ReviewScope - Resuming Workflow\n');

      // Check API key
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error('❌ Error: ANTHROPIC_API_KEY not set\n');
        console.error('Set via: export ANTHROPIC_API_KEY=your-key-here\n');
        process.exit(1);
      }

      // Check if state file exists
      const statePath = path.join('outputs', options.runId, 'state.json');
      try {
        await fs.access(statePath);
      } catch {
        console.error(`❌ Error: Run ID not found: ${options.runId}\n`);
        console.error('Available runs:');
        try {
          const runs = await fs.readdir('outputs');
          runs.forEach(run => console.error(`  • ${run}`));
        } catch {
          console.error('  (no runs found in outputs/ directory)');
        }
        console.error('');
        process.exit(1);
      }

      // Load state
      const stateJson = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(stateJson);

      console.log(`📋 Resuming from stage: ${state.current_stage}`);
      console.log(`   Run ID: ${options.runId}`);
      console.log(`   Studies: ${state.studies?.length || 0}`);
      console.log('');

      // Create workflow and resume
      const workflow = new ScopingReviewWorkflow(apiKey, {
        runId: options.runId,
        configPath: options.config,
      });

      await workflow.run({
        criteria: state.criteria,
        searchFiles: [], // Already loaded from state
        configPath: options.config,
      });
    } catch (error) {
      console.error('\n❌ Resume failed');
      if (error instanceof Error) {
        console.error(`   ${error.message}\n`);
      }
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate criteria and config files')
  .requiredOption('--criteria <file>', 'Path to criteria YAML file')
  .option('--config <file>', 'Path to config.yaml', 'config/config.yaml')
  .addHelpText('after', `
Examples:
  $ reviewscope validate --criteria my-criteria.yaml

This checks:
  • YAML syntax is correct
  • All required PCC fields are present
  • Inclusion/exclusion criteria are defined
  • Config file is valid
`)
  .action(async (options) => {
    try {
      console.log('🔍 Validating configuration...\n');

      // Validate criteria
      try {
        const criteriaYaml = await fs.readFile(options.criteria, 'utf-8');
        const criteria = CriteriaSchema.parse(yaml.load(criteriaYaml));
        console.log('✅ Criteria file is valid\n');
        console.log('PCC Framework:');
        console.log(`  Population: ${criteria.pcc.population}`);
        console.log(`  Concept: ${criteria.pcc.concept}`);
        console.log(`  Context: ${criteria.pcc.context}\n`);
        console.log('Criteria:');
        console.log(`  Inclusion: ${criteria.inclusion.length} criteria`);
        criteria.inclusion.forEach((c, i) => console.log(`    ${i + 1}. ${c.substring(0, 80)}...`));
        console.log(`\n  Exclusion: ${criteria.exclusion.length} criteria`);
        criteria.exclusion.forEach((c, i) => console.log(`    ${i + 1}. ${c.substring(0, 80)}...`));
        console.log('');
      } catch (error) {
        console.error('❌ Criteria file is invalid\n');
        if (error instanceof Error) {
          console.error(`   ${error.message}\n`);
        }
        process.exit(1);
      }

      // Validate config
      try {
        const { ConfigSchema } = await import('./state/schemas.js');
        const configYaml = await fs.readFile(options.config, 'utf-8');
        const config = ConfigSchema.parse(yaml.load(configYaml));
        console.log('✅ Config file is valid\n');
        console.log('Settings:');
        console.log(`  Model: ${config.model}`);
        console.log(`  Seed: ${config.seed}`);
        console.log(`  Screening temperature: ${config.temperature.screening}`);
        console.log(`  Adjudication temperature: ${config.temperature.adjudication}`);
        console.log(`  Extraction temperature: ${config.temperature.extraction}\n`);
      } catch (error) {
        console.error('❌ Config file is invalid\n');
        if (error instanceof Error) {
          console.error(`   ${error.message}\n`);
        }
        process.exit(1);
      }

      console.log('✅ All configuration files are valid!\n');
    } catch (error) {
      console.error('❌ Validation failed');
      if (error instanceof Error) {
        console.error(`   ${error.message}\n`);
      }
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new scoping review project')
  .argument('[directory]', 'Project directory', '.')
  .addHelpText('after', `
Examples:
  $ reviewscope init                    # Initialize in current directory
  $ reviewscope init my-diabetes-review # Create new directory

This creates:
  • criteria.yaml - Sample criteria file (edit this!)
  • inputs/ - Place your search exports here
  • pdfs/ - PDFs will go here
  • outputs/ - Results will be saved here
  • README.md - Quick start guide
`)
  .action(async (directory) => {
    try {
      console.log('🚀 ReviewScope - Project Initialization\n');

      const dir = directory || '.';
      const isCurrentDir = dir === '.';

      // Create directories
      await fs.mkdir(`${dir}/inputs`, { recursive: true });
      await fs.mkdir(`${dir}/pdfs`, { recursive: true });
      await fs.mkdir(`${dir}/outputs`, { recursive: true });

      console.log('📁 Created directories:');
      console.log(`  ✓ ${dir}/inputs/ - for search exports`);
      console.log(`  ✓ ${dir}/pdfs/ - for full-text PDFs`);
      console.log(`  ✓ ${dir}/outputs/ - for results\n`);

      // Create sample criteria file
      const sampleCriteria = {
        pcc: {
          population: 'Adults aged 18+ with [your condition]',
          concept: '[Your intervention or phenomenon of interest]',
          context: '[Geographic/temporal/setting context]',
        },
        inclusion: [
          'Peer-reviewed journal articles',
          'English language',
          'Published [start year] to present',
          'Empirical studies (RCTs, cohort, qualitative, mixed methods)',
          '[Add specific inclusion criteria]',
        ],
        exclusion: [
          'Animal studies or in vitro research',
          'Protocols without results',
          'Conference abstracts or dissertations',
          'Systematic reviews or meta-analyses',
          '[Add specific exclusion criteria]',
        ],
      };

      await fs.writeFile(
        `${dir}/criteria.yaml`,
        yaml.dump(sampleCriteria, { lineWidth: 100 }),
        'utf-8'
      );
      console.log('📝 Created criteria.yaml (template - edit this!)');

      // Create helpful README
      const readme = `# Scoping Review Project

Created with ReviewScope - Automated Scoping Review System

## Quick Start Guide

### 1. Configure Your Review

Edit **criteria.yaml** with your specific:
- **Population**: Who are you studying?
- **Concept**: What intervention/phenomenon?
- **Context**: Where/when/what setting?
- **Inclusion criteria**: What must studies include?
- **Exclusion criteria**: What disqualifies studies?

### 2. Gather Search Results

Export your database searches and place them in the **inputs/** directory:
- **PubMed**: Export as MEDLINE or XML
- **Embase/Scopus/Web of Science**: Export as RIS
- **Other databases**: Export as RIS or plain text

### 3. Set Up API Key

Get your Anthropic API key from: https://console.anthropic.com/

Then set it:
\`\`\`bash
export ANTHROPIC_API_KEY=your-api-key-here
\`\`\`

### 4. Run Your Review

\`\`\`bash
reviewscope run --criteria criteria.yaml --search inputs/*.ris
\`\`\`

### 5. Download PDFs

After abstract screening, the tool will generate a CSV file listing studies that need PDFs.

1. Open **outputs/[run-id]/studies_for_fulltext_screening.csv**
2. Download PDFs using the DOI links
3. Save PDFs to **pdfs/** directory with the filenames shown in the CSV
4. Re-run or resume the workflow

### 6. Review Results

Find your results in **outputs/[run-id]/**:
- PRISMA flow diagram
- Included studies CSV
- Data extraction results
- Manuscript templates

## Directory Structure

\`\`\`
${isCurrentDir ? '.' : directory}/
├── criteria.yaml          # Your review criteria (EDIT THIS!)
├── inputs/                # Place search exports here
├── pdfs/                  # Place full-text PDFs here
├── outputs/               # Results go here
│   └── [run-id]/
│       ├── state.json
│       ├── studies_for_fulltext_screening.csv
│       ├── figures/
│       ├── tables/
│       └── manuscript/
└── README.md              # This file
\`\`\`

## Commands

- \`reviewscope validate --criteria criteria.yaml\` - Check your criteria file
- \`reviewscope run --criteria criteria.yaml --search inputs/*.ris\` - Start review
- \`reviewscope resume --run-id [run-id]\` - Resume interrupted workflow

## Need Help?

- Run \`reviewscope --help\` for all commands
- Run \`reviewscope <command> --help\` for command-specific help

## Tips

- **Validate first**: Run \`reviewscope validate\` before starting
- **Resumable**: Workflows can be interrupted and resumed
- **Reproducible**: Uses seed and temperature settings for consistency
- **Multi-agent**: 3 independent AI agents screen each study with majority voting

---

Built with ReviewScope
`;

      await fs.writeFile(`${dir}/README.md`, readme, 'utf-8');
      console.log('📄 Created README.md (quick start guide)\n');

      console.log('✅ Project initialized successfully!\n');
      console.log('📋 Next steps:');
      if (!isCurrentDir) {
        console.log(`  1. cd ${dir}`);
      }
      console.log(`  ${isCurrentDir ? '1' : '2'}. Edit criteria.yaml with your review criteria`);
      console.log(`  ${isCurrentDir ? '2' : '3'}. Add search exports to inputs/`);
      console.log(`  ${isCurrentDir ? '3' : '4'}. Set ANTHROPIC_API_KEY: export ANTHROPIC_API_KEY=your-key`);
      console.log(`  ${isCurrentDir ? '4' : '5'}. Validate: reviewscope validate --criteria criteria.yaml`);
      console.log(`  ${isCurrentDir ? '5' : '6'}. Run: reviewscope run --criteria criteria.yaml --search inputs/*\n`);
    } catch (error) {
      console.error('❌ Initialization failed');
      if (error instanceof Error) {
        console.error(`   ${error.message}\n`);
      }
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check status of a workflow run')
  .argument('[run-id]', 'Run ID to check (shows latest if not specified)')
  .addHelpText('after', `
Examples:
  $ reviewscope status                        # Show latest run
  $ reviewscope status run-2025-01-05-abc123  # Show specific run

Shows:
  • Current stage of the workflow
  • Studies processed
  • Next steps
`)
  .action(async (runId) => {
    try {
      console.log('🔬 ReviewScope - Workflow Status\n');

      // Find run ID if not provided
      let targetRunId = runId;
      if (!targetRunId) {
        try {
          const runs = await fs.readdir('outputs');
          const sortedRuns = runs
            .filter(r => r.startsWith('run-'))
            .sort()
            .reverse();

          if (sortedRuns.length === 0) {
            console.error('❌ No workflow runs found in outputs/ directory\n');
            console.error('Start a new workflow with: reviewscope run --criteria criteria.yaml --search inputs/*\n');
            process.exit(1);
          }

          targetRunId = sortedRuns[0];
          console.log(`📋 Showing latest run: ${targetRunId}\n`);
        } catch {
          console.error('❌ No workflow runs found\n');
          process.exit(1);
        }
      }

      // Load state
      const statePath = path.join('outputs', targetRunId, 'state.json');
      try {
        const stateJson = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(stateJson);

        console.log('Run Information:');
        console.log(`  Run ID: ${targetRunId}`);
        console.log(`  Stage: ${state.current_stage}`);
        console.log(`  Created: ${new Date(state.created_at).toLocaleString()}`);
        console.log(`  Updated: ${new Date(state.updated_at).toLocaleString()}\n`);

        console.log('Progress:');
        console.log(`  Total studies: ${state.studies?.length || 0}`);
        console.log(`  Deduplicated: ${state.prisma_counts?.deduplicated || 0}`);
        console.log(`  Abstract screened: ${state.prisma_counts?.title_abstract_screened || 0}`);
        console.log(`  Abstract excluded: ${state.prisma_counts?.abstract_excluded || 0}`);
        console.log(`  Full-text retrieved: ${state.prisma_counts?.fulltext_retrieved || 0}`);
        console.log(`  Final included: ${state.prisma_counts?.included || 0}\n`);

        // Stage-specific guidance
        const stageGuide: Record<string, string> = {
          init: '🔄 Workflow initialized. Ready to ingest search results.',
          ingested: '✅ Search results ingested. Ready for abstract screening.',
          abstract_screening: '✅ Abstract screening complete. Download PDFs for full-text screening.',
          pdf_fetching: '⏸️  Waiting for PDFs. Place PDFs in pdfs/ directory and resume.',
          pdf_to_markdown: '🔄 Converting PDFs to markdown format.',
          fulltext_screening: '🔄 Full-text screening in progress.',
          extraction: '🔄 Extracting data from included studies.',
          synthesis: '🔄 Generating visualizations and outputs.',
          complete: '✅ Workflow complete! Check outputs/ directory for results.',
        };

        console.log('Status:');
        console.log(`  ${stageGuide[state.current_stage] || 'Unknown stage'}\n`);

        if (state.current_stage === 'abstract_screening' || state.current_stage === 'pdf_fetching') {
          const csvPath = path.join('outputs', targetRunId, 'studies_for_fulltext_screening.csv');
          try {
            await fs.access(csvPath);
            console.log('Next Steps:');
            console.log(`  1. Open: ${csvPath}`);
            console.log(`  2. Download PDFs using DOI links`);
            console.log(`  3. Save PDFs to pdfs/ directory`);
            console.log(`  4. Resume: reviewscope resume --run-id ${targetRunId}\n`);
          } catch {
            console.log('Next Steps:');
            console.log(`  Resume workflow: reviewscope resume --run-id ${targetRunId}\n`);
          }
        } else if (state.current_stage !== 'complete') {
          console.log('Next Steps:');
          console.log(`  Resume workflow: reviewscope resume --run-id ${targetRunId}\n`);
        } else {
          console.log('Results:');
          console.log(`  Output directory: outputs/${targetRunId}/\n`);
        }
      } catch (error) {
        console.error(`❌ Could not load workflow state: ${targetRunId}\n`);
        console.error('Available runs:');
        try {
          const runs = await fs.readdir('outputs');
          runs.filter(r => r.startsWith('run-')).forEach(run => console.error(`  • ${run}`));
        } catch {
          console.error('  (no runs found)');
        }
        console.error('');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to check status');
      if (error instanceof Error) {
        console.error(`   ${error.message}\n`);
      }
      process.exit(1);
    }
  });

program.parse();
