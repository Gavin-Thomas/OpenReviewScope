# ReviewScope Quick Reference

## Essential Commands

```bash
# Setup (one time)
npm install && npm run build
export ANTHROPIC_API_KEY=your-key-here

# Initialize new project
node dist/index.real.js init my-review
cd my-review

# Validate before running
node dist/index.real.js validate --criteria criteria.yaml

# Start new review
node dist/index.real.js run --criteria criteria.yaml --search inputs/*

# Check status
node dist/index.real.js status

# Resume after interruption
node dist/index.real.js resume --run-id run-xxx

# Get help on any command
node dist/index.real.js <command> --help
```

## Workflow Steps

1. **Initialize** → `node dist/index.real.js init my-review`
2. **Edit criteria.yaml** → Set PCC and inclusion/exclusion criteria
3. **Add search exports** → Place .ris/.xml/.txt files in `inputs/`
4. **Validate** → `node dist/index.real.js validate --criteria criteria.yaml`
5. **Run** → `node dist/index.real.js run --criteria criteria.yaml --search inputs/*`
6. **Download PDFs** → After abstract screening, open CSV and download PDFs
7. **Resume** → `node dist/index.real.js resume --run-id run-xxx`
8. **Review results** → Check `outputs/run-xxx/` directory

## File Locations

- **Criteria file**: `criteria.yaml` (PCC + inclusion/exclusion)
- **Search exports**: `inputs/*.ris`, `inputs/*.xml`, `inputs/*.txt`
- **PDFs**: `pdfs/{study_id}.pdf`
- **Results**: `outputs/run-{timestamp}/`
- **CSV for PDFs**: `outputs/run-xxx/studies_for_fulltext_screening.csv`

## Common Scenarios

### First Time Setup
```bash
cd ReviewScope
npm install
npm run build
export ANTHROPIC_API_KEY=sk-ant-xxx
node dist/index.real.js init my-first-review
cd my-first-review
# Edit criteria.yaml, add files to inputs/
node dist/index.real.js run --criteria criteria.yaml --search inputs/*
```

### Resume After Adding PDFs
```bash
# Check what's needed
node dist/index.real.js status

# Download PDFs using the CSV
open outputs/run-xxx/studies_for_fulltext_screening.csv

# Save PDFs to pdfs/ directory

# Continue workflow
node dist/index.real.js resume --run-id run-xxx
```

### Check Progress
```bash
# Status of latest run
node dist/index.real.js status

# Status of specific run
node dist/index.real.js status run-2025-01-05-abc123

# List all runs
ls outputs/
```

## Criteria File Template

```yaml
pcc:
  population: "Who are you studying?"
  concept: "What intervention or phenomenon?"
  context: "Where/when does it occur?"

inclusion:
  - "Peer-reviewed journal articles"
  - "English language"
  - "Published [year] to present"
  - "Add specific inclusion criteria"

exclusion:
  - "Animal studies"
  - "Conference abstracts"
  - "Add specific exclusion criteria"
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "API key not set" | `export ANTHROPIC_API_KEY=your-key` |
| "No studies found" | Check file format (.ris, .xml, .txt) |
| "Invalid criteria" | Run `validate --criteria criteria.yaml` |
| "PDF not found" | Check filename matches CSV exactly |
| Workflow interrupted | Use `resume --run-id run-xxx` |

## Output Files

After completion, find in `outputs/run-xxx/`:

- `state.json` - Complete workflow state
- `studies_for_fulltext_screening.csv` - Studies needing PDFs
- `figures/prisma_flow.svg` - PRISMA diagram
- `tables/study_characteristics.csv` - Final included studies
- `manuscript/template.docx` - Word manuscript template
- `manuscript/template.tex` - LaTeX manuscript template

## Tips

✅ Always validate criteria before running
✅ Use resume, don't re-run from scratch
✅ Keep PDFs in the pdfs/ directory
✅ Check status before resuming
✅ Save run IDs for your projects

## Getting Help

```bash
# General help
node dist/index.real.js --help

# Command-specific help
node dist/index.real.js run --help
node dist/index.real.js resume --help
node dist/index.real.js validate --help
```

## API Key Setup

Get your API key: https://console.anthropic.com/

**Temporary** (current session):
```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
```

**Permanent** (add to shell config):
```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-xxx' >> ~/.bashrc
source ~/.bashrc
```

## Database Export Formats

| Database | Format | Extension |
|----------|--------|-----------|
| PubMed | MEDLINE or XML | .txt or .xml |
| Embase | RIS | .ris |
| Scopus | RIS | .ris |
| Web of Science | RIS | .ris |
| Cochrane | RIS | .ris |

---

**Full Documentation**: See [USER_GUIDE.md](USER_GUIDE.md)
