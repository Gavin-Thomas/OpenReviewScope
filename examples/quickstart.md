# AUTOSCOPE Quick Start Guide

## Installation

```bash
cd autoscope
npm install
npm run build
```

## Initialize Project

```bash
npm run dev init --dir my-review
cd my-review
```

This creates:
- `criteria.yaml` - Sample PCC and I/E criteria (edit this!)
- `inputs/` - Place your search exports here
- `pdfs/` - PDFs go here after abstract screening
- `outputs/` - Results will be saved here

## Prepare Your Review

### 1. Edit Criteria

Edit `criteria.yaml` with your specific:
- **Population**: Who are you studying?
- **Concept**: What intervention/phenomenon?
- **Context**: Where/when does it occur?
- **Inclusion**: What must studies include?
- **Exclusion**: What disqualifies studies?

### 2. Gather Search Exports

Export your database searches to:
- EndNote/Zotero → `.ris` format
- PubMed → XML or MEDLINE format
- Other → Plain text citations

Place all files in `inputs/` directory.

### 3. Optional: Add PROSPERO Protocol

If you have a registered PROSPERO protocol, save it as `prospero.pdf` or `prospero.md`.

## Run the Review

### Full Pipeline (One Command)

```bash
autoscope run \
  --criteria criteria.yaml \
  --search inputs/*.ris \
  --prospero prospero.pdf
```

This will:
1. ✅ Ingest and deduplicate records
2. ✅ Screen abstracts (3 agents vote)
3. ⏸️  Pause for PDF upload
4. ✅ Screen full texts (3 agents vote)
5. ✅ Extract data
6. ✅ Generate figures and tables
7. ✅ Export manuscript templates

### Step-by-Step (Advanced)

If you want more control:

```bash
# Validate your criteria first
autoscope validate --criteria criteria.yaml

# Run workflow with custom run ID
autoscope run \
  --criteria criteria.yaml \
  --search inputs/*.ris \
  --run-id diabetes-review-2025 \
  --config custom-config.yaml
```

## After Abstract Screening

The workflow will pause and show:

```
📄 PDF Fetching Phase

📦 42 studies need full-text PDFs

Please place PDFs in: pdfs/
Name files as: {study_id}.pdf

⚠️  Missing PDFs for 38 studies:
  • a3f7c8d9e2b1f456
  • b8e9d3a2c7f1e8d4
  ...
```

### Getting PDFs

**Option 1: Manual Download**
- Use DOIs/URLs from the study list
- Download PDFs manually
- Rename to `{study_id}.pdf`

**Option 2: Automated Fetching** _(coming soon)_
```bash
autoscope fetch-pdfs --mode openurl
```

Once PDFs are in place, the workflow continues automatically.

## Results

Find outputs in `outputs/{run_id}/`:

```
outputs/
└── diabetes-review-2025/
    ├── state.json                  # Full state snapshot
    ├── audit_log.jsonl             # Decision audit trail
    ├── decisions_abstract.jsonl    # All abstract decisions
    ├── consensus_abstract.jsonl    # Consensus results
    ├── decisions_fulltext.jsonl    # All full-text decisions
    ├── consensus_fulltext.jsonl    # Final included studies
    ├── extraction.json             # Extracted data
    ├── pdf_retrieval_report.csv    # PDF fetch audit
    ├── tables/
    │   ├── search_strategy.csv
    │   ├── study_characteristics.csv
    │   └── extraction_summary.csv
    ├── figures/
    │   ├── prisma_flow.png
    │   ├── study_types.png
    │   ├── timeline.png
    │   └── geographic_distribution.png
    └── manuscript/
        ├── template.docx           # Word manuscript
        └── template.tex            # LaTeX manuscript
```

## Interpreting Results

### Abstract Screening

```jsonl
{"stage":"abstract","agent_id":"abstract-screener-1","study_id":"a3f7...","decision":"include","reasons":["Addresses target population","Intervention aligns with concept"],"evidence_quotes":[{"text":"...","location":"Abstract lines 3-5"}],"timestamp":"..."}
```

Each decision includes:
- Agent ID (which of 3 agents)
- Decision (include/exclude/unsure)
- Reasons (≥2 required)
- Evidence quotes with locations

### Consensus

```jsonl
{"stage":"abstract","study_id":"a3f7...","votes":[...],"consensus":"include","final_decision":"include","adjudicator_rationale":null,"timestamp":"..."}
```

Shows:
- All 3 agent votes
- Consensus (majority rule)
- Adjudicator rationale (if escalated)

### PRISMA Counts

```json
{
  "identified": 1247,
  "deduplicated": 856,
  "title_abstract_screened": 856,
  "abstract_excluded": 782,
  "fulltext_retrieved": 74,
  "fulltext_excluded": [
    {"study_id": "...", "reason": "Wrong population"},
    ...
  ],
  "included": 42
}
```

## Configuration

Edit `config/config.yaml` to customize:

```yaml
temperature:
  screening: 0.1      # Lower = more deterministic
  adjudication: 0.0   # 0 = fully deterministic

seed: 42              # For reproducibility

dedupe_thresholds:
  title_similarity: 0.85  # Higher = stricter deduplication
```

## Troubleshooting

### Validation Errors

```bash
# Check your criteria file
autoscope validate --criteria criteria.yaml
```

Common issues:
- Missing PCC fields
- Empty inclusion/exclusion arrays
- Invalid YAML syntax

### No Studies Found

- Check search file format (RIS, PubMed XML, or plain text)
- Verify files are in correct encoding (UTF-8)
- Try text parser for unknown formats

### Missing PDFs

- Check `outputs/{run_id}/missing_pdfs.json`
- Cross-reference with `pdf_retrieval_report.csv`
- Manually download and place in `pdfs/`

## Next Steps

- Review consensus decisions in `outputs/{run_id}/consensus_*.jsonl`
- Examine extraction data in `extraction.json`
- Use generated tables/figures in your manuscript
- Customize Word/LaTeX templates as needed

## Support

- 📖 Full docs: [README.md](../README.md)
- 🐛 Report issues: GitHub Issues
- 💬 Questions: GitHub Discussions
