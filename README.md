# OpenReviewScope (aka ReviewScope)

**Automated Scoping Review System** - AI-powered tool for conducting systematic scoping reviews following PRISMA-ScR guidelines.

## Overview

ReviewScope automates the complete scoping review process using Claude AI with multi-agent consensus decision-making. Designed for researchers, it handles everything from abstract screening to manuscript generation.

### What It Does

- **Abstract Screening** - 3 independent AI agents screen each study
- **Consensus Voting** - Majority vote with adjudication for ties
- **PDF Management** - Simple CSV export for PDF collection
- **Full-Text Screening** - Detailed review of complete articles
- **Data Extraction** - Automated extraction of study characteristics
- **PRISMA Diagrams** - Auto-generated flow charts
- **Publication Outputs** - Word and LaTeX manuscript templates

## Key Features

✅ **Multi-Agent Consensus** - 3 independent reviewers + adjudicator
✅ **Resumable Workflows** - Interrupt and continue anytime
✅ **Simple PDF Collection** - Clean CSV with DOI, title, authors
✅ **PRISMA-ScR Compliant** - Follows international standards
✅ **Multiple Formats** - Supports RIS, PubMed XML, MEDLINE, plain text
✅ **User-Friendly CLI** - Clear commands with helpful guidance
✅ **Reproducible** - Seed-based consistency across runs

## Quick Start for Researchers

### Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Anthropic API key** - [Get one here](https://console.anthropic.com/)
- **Database search exports** (PubMed, Embase, etc.)

### Installation (3 Steps)

```bash
# 1. Navigate to ReviewScope directory
cd ReviewScope

# 2. Install dependencies
npm install

# 3. Build the project
npm run build
```

### Your First Review (5 Minutes)

#### 1. Initialize a Project

```bash
node dist/index.real.js init my-first-review
cd my-first-review
```

#### 2. Set Your API Key

```bash
export ANTHROPIC_API_KEY=your-key-here
```

#### 3. Edit Your Criteria

Open `criteria.yaml` and customize for your review:

```yaml
pcc:
  population: "Adults aged 18+ with diabetes"
  concept: "Self-management interventions"
  context: "Primary care settings"

inclusion:
  - "Peer-reviewed journal articles"
  - "English language"
  - "Published 2015-present"

exclusion:
  - "Animal studies"
  - "Conference abstracts"
  - "Systematic reviews"
```

#### 4. Add Your Search Exports

Place search results in `inputs/` directory:
- PubMed → Export as MEDLINE or XML
- Embase/Scopus → Export as RIS

#### 5. Run the Workflow

```bash
# Validate first
node dist/index.real.js validate --criteria criteria.yaml

# Run the review
node dist/index.real.js run \
  --criteria criteria.yaml \
  --search inputs/*.ris inputs/*.txt
```

### The Workflow Pauses for PDFs

After abstract screening, you'll see:

```
📄 Studies for full-text screening:
  • outputs/run-xxx/studies_for_fulltext_screening.csv
  • 42 studies passed abstract screening

📥 Next steps:
  1. Open the CSV file to see which studies need PDFs
  2. Download PDFs using the DOI links
  3. Save PDFs to the pdfs/ directory with the filename shown
  4. Re-run the workflow to continue
```

**Resume after adding PDFs:**

```bash
node dist/index.real.js resume --run-id run-xxx
```

## Project Structure

```
ReviewScope/
├── src/
│   ├── agents/          # AI screening agents
│   │   ├── AbstractScreener.real.ts
│   │   ├── FullTextScreener.ts
│   │   ├── Adjudicator.real.ts
│   │   ├── PdfToMarkdownConverter.ts
│   │   ├── MarkdownQualityChecker.ts
│   │   └── DataExtractor.ts
│   ├── workflows/       # Workflow orchestration
│   │   ├── scopingReview.real.ts
│   │   └── consensus.ts
│   ├── tools/           # Utilities
│   │   ├── risParser.ts
│   │   ├── pubmedParser.ts
│   │   ├── pdfExtract.ts
│   │   ├── prismaFlow.ts
│   │   └── charts.ts
│   └── state/           # State management
│       ├── schemas.ts
│       └── store.ts
├── config/
│   └── config.yaml      # Default configuration
├── examples/
│   ├── sample-criteria.yaml
│   └── quickstart.md
└── test-data/
    └── sample-studies.txt

```

## Commands

### Core Commands

```bash
# Initialize new project
node dist/index.real.js init [directory]

# Validate criteria file
node dist/index.real.js validate --criteria criteria.yaml

# Run new review
node dist/index.real.js run --criteria criteria.yaml --search inputs/*

# Check workflow status
node dist/index.real.js status [run-id]

# Resume interrupted workflow
node dist/index.real.js resume --run-id run-xxx

# Get help
node dist/index.real.js --help
node dist/index.real.js <command> --help
```

## Workflow Stages

```
1. Initialize        → Load criteria and config
2. Ingest           → Parse and deduplicate search results
3. Abstract Screen  → 3 AI agents review each abstract
4. PDF Collection   → Download PDFs using generated CSV
5. Full-Text Screen → 3 AI agents review complete PDFs
6. Data Extraction  → Extract study characteristics
7. Synthesis        → Generate PRISMA diagrams and charts
8. Export           → Create manuscript templates
```

### Multi-Agent Consensus

- **3 Independent Agents** screen each study
- **Majority Vote** determines consensus
- **Adjudicator** resolves ties
- All decisions logged with evidence quotes

## Configuration

Edit `config/config.yaml` to customize:

```yaml
model: claude-3-5-sonnet-20241022  # AI model to use
temperature:
  screening: 0.3   # Agent temperature for screening
  adjudication: 0.1
  extraction: 0.2
seed: 42           # For reproducibility
ocr_enabled: false # Enable OCR for scanned PDFs
pdf_fetch:
  pdfs_dir: pdfs
  logs_dir: outputs
```

## Output Structure

Each run creates a directory in `outputs/`:

```
outputs/run-{timestamp}-{id}/
├── state.json                              # Complete workflow state
├── studies_for_fulltext_screening.csv      # Simple CSV: DOI, title, authors
├── figures/
│   ├── prisma_flow.svg                     # PRISMA flow diagram
│   ├── study_types.svg                     # Study design breakdown
│   ├── geographic.svg                      # Geographic distribution
│   └── timeline.svg                        # Publication timeline
├── tables/
│   ├── study_characteristics.csv           # Final included studies
│   ├── abstract_decisions.csv              # All abstract screening decisions
│   └── fulltext_decisions.csv              # All full-text screening decisions
└── manuscript/
    ├── template.docx                       # Word manuscript template
    └── template.tex                        # LaTeX manuscript template
```

### The PDF Collection CSV

After abstract screening, `studies_for_fulltext_screening.csv` contains:

| Study_ID | Title | Authors | DOI | Year | Journal | PDF_Filename |
|----------|-------|---------|-----|------|---------|--------------|
| abc123   | Study title here | Smith J; Jones A | 10.1234/... | 2023 | Journal Name | abc123.pdf |

**Simple workflow:**
1. Open CSV in Excel/Google Sheets
2. Use DOI to download PDFs
3. Save as `{Study_ID}.pdf` in `pdfs/` folder
4. Resume the workflow

## Documentation

- **[User Guide](USER_GUIDE.md)** - Complete guide for researchers
- **[Extraction Guide](EXTRACTION_GUIDE.md)** - 60+ fields, 9 tables, evidence synthesis
- **[Quick Reference](QUICK_REFERENCE.md)** - One-page command cheat sheet
- **[Examples](examples/)** - Sample criteria and quick starts
- **[Config Reference](config/config.yaml)** - All configuration options

## Common Scenarios

### Scenario 1: Small Review (< 100 studies)

```bash
node dist/index.real.js init small-review
cd small-review
# Edit criteria.yaml, add search exports to inputs/
node dist/index.real.js run --criteria criteria.yaml --search inputs/*
```

### Scenario 2: Large Review (> 500 studies)

Use the same commands - the workflow scales automatically. Consider:
- Higher API rate limits from Anthropic
- Running in batches if needed
- Using resume functionality

### Scenario 3: Team Collaboration

```bash
# Researcher 1: Runs abstract screening
node dist/index.real.js run --criteria criteria.yaml --search inputs/*

# Share outputs/run-xxx/ directory with team

# Researcher 2: Downloads PDFs, resumes workflow
node dist/index.real.js resume --run-id run-xxx
```

## Important Notes

### API Requirements

- **API Key**: Get from [console.anthropic.com](https://console.anthropic.com/)
- **Rate Limits**: Standard tier works for most reviews
- **Model**: Uses Claude Sonnet 4.5 (configurable)

### PDF Collection

- After abstract screening, workflow **pauses** for PDF download
- Use the generated CSV to download PDFs systematically
- PDFs must be valid (not corrupted or HTML pages)
- Filenames must match exactly as shown in CSV

### Reproducibility

- Uses seed-based randomization (default: 42)
- Same criteria + studies = same results
- All decisions logged with timestamps
- Full audit trail in state.json

## Testing

```bash
# Run test suite
npm test

# Validate a criteria file
node dist/index.real.js validate --criteria examples/sample-criteria.yaml
```

## Dependencies

- `@anthropic-ai/sdk` - Claude AI integration
- `zod` - Schema validation
- `js-yaml` - YAML parsing
- `pdf-parse` - PDF text extraction
- `commander` - CLI interface

## License

MIT

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
```bash
export ANTHROPIC_API_KEY=your-key-here
```

### "No studies found"
- Check file format (RIS, XML, or MEDLINE text)
- Verify file encoding (should be UTF-8)
- Try: `head inputs/yourfile.ris` to inspect

### "Criteria file is invalid"
```bash
node dist/index.real.js validate --criteria criteria.yaml
```
- Check YAML indentation (2 spaces, not tabs)
- Ensure all PCC fields are present
- Quote strings with special characters

### PDFs Not Processing
- Check filename matches CSV exactly
- Verify PDF is not corrupted: `file pdfs/xxx.pdf`
- Should show: "PDF document, version X.X"

### Workflow Stuck
```bash
# Check current status
node dist/index.real.js status

# Resume if interrupted
node dist/index.real.js resume --run-id run-xxx
```

## Support

- **[User Guide](USER_GUIDE.md)** - Comprehensive documentation
- **[Examples](examples/)** - Sample projects and use cases
- **Get Help**: Run `node dist/index.real.js --help`

## Citation

If you use ReviewScope in your research, please cite:

```bibtex
@software{reviewscope2025,
  title = {ReviewScope: Automated Scoping Review System},
  author = {[Author Names]},
  year = {2025},
  note = {AI-powered systematic scoping review tool}
}
```

## License

MIT

---

**ReviewScope** - Making scoping reviews faster, more consistent, and reproducible.
