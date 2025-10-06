#!/usr/bin/env node
/**
 * AUTOSCOPE - Automated Scoping Review System
 * CLI entry point
 */

import { Command } from 'commander';
import { ScopingReviewWorkflow } from './workflows/scopingReview.js';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import { Criteria, CriteriaSchema } from './state/schemas.js';

const program = new Command();

program
  .name('autoscope')
  .description('Automated Scoping Review with Claude Agents SDK')
  .version('1.0.0');

program
  .command('run')
  .description('Run complete scoping review workflow')
  .requiredOption('--criteria <file>', 'Path to criteria YAML file')
  .option('--prospero <file>', 'Path to PROSPERO protocol')
  .option('--search <files...>', 'Search export files (.ris, .xml, .txt)')
  .option('--config <file>', 'Path to config.yaml', 'config/config.yaml')
  .option('--run-id <id>', 'Custom run ID')
  .action(async (options) => {
    try {
      console.log('🔬 AUTOSCOPE - Automated Scoping Review System\n');

      // Load criteria
      const criteriaYaml = await fs.readFile(options.criteria, 'utf-8');
      const criteria = CriteriaSchema.parse(yaml.load(criteriaYaml));

      // Create workflow
      const workflow = new ScopingReviewWorkflow({
        runId: options.runId,
        configPath: options.config,
      });

      // Run
      await workflow.run({
        prospero: options.prospero,
        criteria,
        searchFiles: options.search || [],
        configPath: options.config,
      });
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate criteria and config files')
  .requiredOption('--criteria <file>', 'Path to criteria YAML file')
  .option('--config <file>', 'Path to config.yaml', 'config/config.yaml')
  .action(async (options) => {
    try {
      console.log('✓ Validating configuration...\n');

      // Validate criteria
      const criteriaYaml = await fs.readFile(options.criteria, 'utf-8');
      const criteria = CriteriaSchema.parse(yaml.load(criteriaYaml));
      console.log('✓ Criteria valid');
      console.log(`  Population: ${criteria.pcc.population}`);
      console.log(`  Concept: ${criteria.pcc.concept}`);
      console.log(`  Context: ${criteria.pcc.context}`);
      console.log(`  Inclusion: ${criteria.inclusion.length} criteria`);
      console.log(`  Exclusion: ${criteria.exclusion.length} criteria\n`);

      // Validate config
      const { ConfigSchema } = await import('./state/schemas.js');
      const configYaml = await fs.readFile(options.config, 'utf-8');
      const config = ConfigSchema.parse(yaml.load(configYaml));
      console.log('✓ Config valid');
      console.log(`  Model: ${config.model}`);
      console.log(`  Seed: ${config.seed}`);
      console.log(
        `  Screening temp: ${config.temperature.screening}\n`
      );
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new scoping review project')
  .option('--dir <path>', 'Project directory', '.')
  .action(async (options) => {
    try {
      console.log('🚀 Initializing AUTOSCOPE project...\n');

      const dir = options.dir;

      // Create directories
      await fs.mkdir(`${dir}/inputs`, { recursive: true });
      await fs.mkdir(`${dir}/pdfs`, { recursive: true });
      await fs.mkdir(`${dir}/outputs`, { recursive: true });

      // Create sample criteria file
      const sampleCriteria = {
        pcc: {
          population: 'Adults with chronic disease',
          concept: 'Self-management interventions',
          context: 'Primary care or community settings',
        },
        inclusion: [
          'Peer-reviewed publications',
          'English language',
          'Published 2010-present',
          'Empirical studies (quantitative, qualitative, or mixed methods)',
        ],
        exclusion: [
          'Animal studies',
          'Protocols without results',
          'Conference abstracts',
          'Systematic reviews and meta-analyses',
        ],
      };

      await fs.writeFile(
        `${dir}/criteria.yaml`,
        yaml.dump(sampleCriteria),
        'utf-8'
      );

      // Create sample README
      const readme = `# Scoping Review Project

## Quick Start

1. Edit \`criteria.yaml\` with your PCC and inclusion/exclusion criteria
2. Place search exports in \`inputs/\` directory
3. Run: \`autoscope run --criteria criteria.yaml --search inputs/*.ris\`

## Directory Structure

- \`inputs/\` - Search exports (.ris, .xml, .txt)
- \`pdfs/\` - Full-text PDFs (after abstract screening)
- \`outputs/\` - Results and analysis

## Documentation

See: https://github.com/autoscope/autoscope
`;

      await fs.writeFile(`${dir}/README.md`, readme, 'utf-8');

      console.log('✓ Project initialized!');
      console.log(`\nNext steps:`);
      console.log(`  1. Edit criteria.yaml`);
      console.log(`  2. Add search exports to inputs/`);
      console.log(
        `  3. Run: autoscope run --criteria criteria.yaml --search inputs/*.ris\n`
      );
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program.parse();
