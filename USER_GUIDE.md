# ReviewScope User Guide

**Automated Scoping Review System - Complete Guide for Researchers**

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [Running Your First Review](#running-your-first-review)
4. [Understanding the Workflow](#understanding-the-workflow)
5. [Commands Reference](#commands-reference)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Getting Started

ReviewScope is an AI-powered tool that automates the scoping review process following PRISMA-ScR guidelines. It uses Claude AI to screen studies, extract data, and generate publication-ready outputs.

### Prerequisites

- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
- **Anthropic API Key** - Sign up at [console.anthropic.com](https://console.anthropic.com/)
- **Search exports** from databases (PubMed, Embase, etc.)

### What ReviewScope Does

✅ **Abstract Screening** - 3 AI agents independently screen each abstract
✅ **Consensus Decision-Making** - Majority voting with adjudication for ties
✅ **PDF Management** - Generates download lists and validates PDFs
✅ **Full-Text Screening** - Reviews complete PDFs against criteria
✅ **Data Extraction** - Extracts study characteristics automatically
✅ **PRISMA Diagrams** - Auto-generates flow charts
✅ **Manuscript Templates** - Word and LaTeX templates ready to fill in

---

## Installation

### Step 1: Install ReviewScope

```bash
# Clone or download the repository
cd ReviewScope
npm install
npm run build
```

### Step 2: Set Your API Key

Get your API key from [console.anthropic.com](https://console.anthropic.com/), then:

```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

**Tip**: Add this to your `~/.bashrc` or `~/.zshrc` to make it permanent.

### Step 3: Verify Installation

```bash
node dist/index.real.js --help
```

You should see the ReviewScope help menu.

---

## Running Your First Review

### Quick Start (5 Steps)

#### 1. Initialize a Project

```bash
node dist/index.real.js init my-diabetes-review
cd my-diabetes-review
```

This creates:
- `criteria.yaml` - Your inclusion/exclusion criteria
- `inputs/` - For search exports
- `pdfs/` - For full-text PDFs
- `outputs/` - For results

#### 2. Edit Your Criteria

Open `criteria.yaml` and customize it for your review:

```yaml
pcc:
  population: "Adults aged 18+ with type 2 diabetes"
  concept: "Digital health interventions for self-management"
  context: "Primary care settings in high-income countries"

inclusion:
  - "Peer-reviewed journal articles"
  - "English language"
  - "Published 2015-2024"
  - "Empirical studies (RCT, cohort, qualitative)"

exclusion:
  - "Type 1 diabetes or gestational diabetes"
  - "Pediatric populations"
  - "Protocols without results"
  - "Conference abstracts"
```

#### 3. Add Search Exports

Export your database searches and place them in `inputs/`:

**PubMed**:
1. Search → Send to → File
2. Format: MEDLINE or XML
3. Save to `inputs/pubmed.txt` or `inputs/pubmed.xml`

**Embase/Scopus/Web of Science**:
1. Export → RIS format
2. Save to `inputs/embase.ris`

#### 4. Validate Your Setup

```bash
node dist/index.real.js validate --criteria criteria.yaml
```

This checks for errors before you start.

#### 5. Run the Workflow

```bash
node dist/index.real.js run \
  --criteria criteria.yaml \
  --search inputs/*.ris inputs/*.txt
```

---

## Understanding the Workflow

### Workflow Stages

```
1. Initialization      → Load criteria and config
2. Ingestion          → Parse and deduplicate search results
3. Abstract Screening → 3 AI agents review each abstract
4. PDF Collection     → YOU download PDFs using generated CSV
5. Full-Text Screening → 3 AI agents review full PDFs
6. Data Extraction    → Extract study characteristics
7. Synthesis          → Generate PRISMA diagrams and charts
8. Export             → Create manuscript templates and tables
```

### The PDF Collection Step

After abstract screening, the workflow **pauses** to let you download PDFs:

1. **Check the status**:
   ```bash
   node dist/index.real.js status
   ```

2. **Open the CSV**:
   ```
   outputs/run-[timestamp]/studies_for_fulltext_screening.csv
   ```

3. **Download PDFs**:
   - Use the DOI links in the CSV
   - Save as `{Study_ID}.pdf` (shown in CSV)
   - Place in the `pdfs/` directory

4. **Resume the workflow**:
   ```bash
   node dist/index.real.js resume --run-id run-[timestamp]
   ```

### Multi-Agent Consensus

Each study is reviewed by **3 independent AI agents**:

- If 2 or 3 agree → Consensus decision
- If votes are split → **Adjudicator** reviews and makes final call
- All decisions are logged with evidence quotes

---

## Commands Reference

### `init` - Initialize Project

```bash
node dist/index.real.js init [directory]
```

Creates a new project with template files.

**Options**:
- `[directory]` - Project directory (default: current directory)

**Example**:
```bash
node dist/index.real.js init my-review
```

---

### `run` - Start New Workflow

```bash
node dist/index.real.js run --criteria <file> --search <files...>
```

**Required**:
- `--criteria <file>` - Path to criteria YAML file

**Optional**:
- `--search <files...>` - Search export files (.ris, .xml, .txt)
- `--prospero <file>` - PROSPERO protocol file
- `--config <file>` - Custom config (default: `config/config.yaml`)
- `--run-id <id>` - Custom run ID
- `--api-key <key>` - API key (or use env var)

**Example**:
```bash
node dist/index.real.js run \
  --criteria criteria.yaml \
  --search inputs/pubmed.txt inputs/embase.ris \
  --run-id diabetes-2025
```

---

### `resume` - Continue Interrupted Workflow

```bash
node dist/index.real.js resume --run-id <id>
```

**Required**:
- `--run-id <id>` - Run ID to resume

**Example**:
```bash
node dist/index.real.js resume --run-id run-2025-01-05T12-34-56-abc123
```

**When to use**:
- After adding PDFs to `pdfs/` directory
- If the workflow was interrupted
- To re-run later stages

---

### `status` - Check Workflow Status

```bash
node dist/index.real.js status [run-id]
```

**Optional**:
- `[run-id]` - Specific run to check (default: latest)

**Example**:
```bash
node dist/index.real.js status
node dist/index.real.js status run-2025-01-05T12-34-56-abc123
```

Shows:
- Current stage
- Studies processed
- Next steps

---

### `validate` - Validate Configuration

```bash
node dist/index.real.js validate --criteria <file>
```

**Required**:
- `--criteria <file>` - Criteria file to validate

**Optional**:
- `--config <file>` - Config file to validate

**Example**:
```bash
node dist/index.real.js validate --criteria criteria.yaml
```

Checks:
- YAML syntax
- Required PCC fields
- Criteria format

---

## Troubleshooting

### Common Issues

#### "ANTHROPIC_API_KEY not set"

**Solution**:
```bash
export ANTHROPIC_API_KEY=your-key-here
```

Make it permanent:
```bash
echo 'export ANTHROPIC_API_KEY=your-key-here' >> ~/.bashrc
source ~/.bashrc
```

---

#### "No studies found" or "0 records parsed"

**Possible causes**:
1. Wrong file format
2. File encoding issue
3. Empty file

**Solution**:
```bash
# Check file content
head -20 inputs/yourfile.ris

# Try different format
# PubMed: Use MEDLINE (.txt) or XML
# Embase/WoS: Use RIS format
```

---

#### "Criteria file is invalid"

**Common mistakes**:
- Missing PCC fields
- Wrong indentation (YAML is indent-sensitive)
- Missing quotes around text with special characters

**Solution**:
```bash
# Validate first
node dist/index.real.js validate --criteria criteria.yaml

# Check YAML syntax
# Use 2 spaces for indentation (not tabs)
# Quote strings with colons or special chars
```

---

#### "Run ID not found"

**Solution**:
```bash
# List available runs
ls outputs/

# Check status of latest run
node dist/index.real.js status
```

---

#### PDFs Won't Process

**Possible causes**:
1. Incorrect filename
2. Corrupted PDF
3. PDF in wrong directory

**Solution**:
```bash
# Check PDF filenames match study IDs
ls pdfs/

# Verify PDF is valid
file pdfs/study_id.pdf
# Should say: "PDF document, version X.X"

# Check the CSV for correct filenames
cat outputs/run-*/studies_for_fulltext_screening.csv
```

---

## Best Practices

### 1. Validate Before Running

Always validate your criteria file first:
```bash
node dist/index.real.js validate --criteria criteria.yaml
```

### 2. Use Specific Criteria

**Good**:
```yaml
inclusion:
  - "Randomized controlled trials"
  - "Published in peer-reviewed journals"
  - "English language"
  - "Adult participants (≥18 years)"
```

**Too vague**:
```yaml
inclusion:
  - "Relevant studies"
  - "Good quality"
```

### 3. Test with Small Sample First

Before running your full review:
1. Create a small test file (10-20 studies)
2. Run the workflow
3. Review the decisions
4. Adjust criteria if needed
5. Run full review

### 4. Save Your Run IDs

Keep track of run IDs for your projects:
```bash
# Save to a file
echo "diabetes-review: run-2025-01-05T12-34-56-abc123" >> run-ids.txt
```

### 5. Back Up Your Results

Periodically backup the `outputs/` directory:
```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz outputs/

# Or copy to safe location
cp -r outputs/ /backup/location/
```

### 6. Check Status Regularly

For long-running reviews:
```bash
node dist/index.real.js status
```

### 7. Use Resume, Not Re-run

If interrupted, always use `resume`:
```bash
# Good
node dist/index.real.js resume --run-id run-xxx

# Don't start over
# node dist/index.real.js run --criteria ... (will create new run)
```

---

## Output Structure

After completion, your `outputs/run-[id]/` directory contains:

```
outputs/run-2025-01-05T12-34-56-abc123/
├── state.json                           # Complete workflow state
├── studies_for_fulltext_screening.csv   # Studies needing PDFs
├── figures/
│   ├── prisma_flow.svg                  # PRISMA diagram
│   ├── study_types.svg                  # Study design chart
│   ├── geographic.svg                   # Geographic distribution
│   └── timeline.svg                     # Publication timeline
├── tables/
│   ├── study_characteristics.csv        # Included studies table
│   ├── abstract_decisions.csv           # All abstract decisions
│   └── fulltext_decisions.csv           # All full-text decisions
└── manuscript/
    ├── template.docx                    # Word template
    └── template.tex                     # LaTeX template
```

---

## Getting Help

### Command Help

```bash
node dist/index.real.js --help
node dist/index.real.js <command> --help
```

### Check Logs

```bash
# View state file
cat outputs/run-*/state.json | jq .

# Check decisions
head outputs/run-*/tables/abstract_decisions.csv
```

---

## Quick Reference Card

```bash
# Setup
npm install && npm run build
export ANTHROPIC_API_KEY=your-key

# New project
node dist/index.real.js init my-review
cd my-review

# Validate
node dist/index.real.js validate --criteria criteria.yaml

# Run
node dist/index.real.js run --criteria criteria.yaml --search inputs/*

# Check status
node dist/index.real.js status

# Resume
node dist/index.real.js resume --run-id run-xxx
```

---

**Built with ReviewScope** - Automated scoping reviews powered by Claude AI
