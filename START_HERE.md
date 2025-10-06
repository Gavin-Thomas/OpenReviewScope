# 👋 Welcome to ReviewScope!

**Automated Scoping Review System powered by Claude AI**

If this is your first time using ReviewScope, you're in the right place!

---

## ⚡ Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
npm install
npm run build
```

### 2. Set Your API Key

Get your API key from [console.anthropic.com](https://console.anthropic.com/), then:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

### 3. Create Your First Project

```bash
node dist/index.real.js init my-first-review
cd my-first-review
```

This creates:
- ✅ `criteria.yaml` - Template for your review criteria
- ✅ `inputs/` - Folder for your search exports
- ✅ `pdfs/` - Folder for full-text PDFs
- ✅ `outputs/` - Folder for results
- ✅ `README.md` - Project-specific guide

### 4. Edit Your Criteria

Open `criteria.yaml` and customize it:

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
```

### 5. Add Your Search Results

Place your database exports in the `inputs/` folder:
- **PubMed**: Export as MEDLINE (.txt) or XML
- **Embase/Scopus**: Export as RIS (.ris)

### 6. Validate Your Setup

```bash
node dist/index.real.js validate --criteria criteria.yaml
```

If you see ✅, you're ready to go!

### 7. Run Your Review

```bash
node dist/index.real.js run --criteria criteria.yaml --search inputs/*
```

The system will:
1. Parse and deduplicate your search results
2. Screen abstracts (3 AI agents + adjudicator)
3. Generate a CSV of studies needing PDFs
4. Wait for you to download PDFs
5. Screen full-text PDFs
6. Extract data from included studies
7. Generate PRISMA diagrams and manuscript templates

---

## 📋 What Happens Next?

### After Abstract Screening

The workflow will **pause** and show you:

```
📄 Studies for full-text screening:
  • outputs/run-xxx/studies_for_fulltext_screening.csv
  • 42 studies passed abstract screening

📥 Next steps:
  1. Open the CSV file
  2. Download PDFs using the DOI links
  3. Save PDFs to pdfs/ directory
  4. Resume the workflow
```

### Download PDFs

1. Open the CSV file (in Excel, Google Sheets, etc.)
2. For each study, use the DOI to find and download the PDF
3. Save the PDF with the **exact filename** shown in the CSV
4. Put it in the `pdfs/` folder

### Resume the Workflow

```bash
node dist/index.real.js resume --run-id run-xxx
```

The workflow will continue from where it left off!

---

## 📚 Documentation

Choose your learning style:

### 🚀 I want to jump in fast
→ Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (1 page)

### 📖 I want comprehensive guidance
→ Read [USER_GUIDE.md](USER_GUIDE.md) (complete guide)

### 🔍 I want detailed info
→ Read [README.md](README.md) (technical overview)

### 📝 I want to see what's new
→ Read [CHANGELOG.md](CHANGELOG.md) (version history)

---

## 💡 Pro Tips

### ✅ DO:
- Run `validate` before `run` to catch errors early
- Use `status` to check progress anytime
- Use `resume` instead of re-running
- Keep the CSV file for your records
- Back up your `outputs/` directory

### ❌ DON'T:
- Start a new run if you already have one going (use `resume` instead)
- Rename PDF files (use exact filenames from CSV)
- Delete the `outputs/` directory until your review is published
- Forget to set your API key

---

## 🆘 Common Issues

### "ANTHROPIC_API_KEY not set"
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### "No studies found"
Check your file format:
- PubMed → .txt or .xml
- Embase/Scopus → .ris

### "Criteria file is invalid"
```bash
node dist/index.real.js validate --criteria criteria.yaml
```
The error message will tell you exactly what's wrong.

### "Can't find run ID"
```bash
# List available runs
ls outputs/

# Check status
node dist/index.real.js status
```

---

## 🎯 Your First Review Checklist

- [ ] npm install && npm run build
- [ ] export ANTHROPIC_API_KEY=...
- [ ] node dist/index.real.js init my-review
- [ ] cd my-review
- [ ] Edit criteria.yaml
- [ ] Add search exports to inputs/
- [ ] node dist/index.real.js validate --criteria criteria.yaml
- [ ] node dist/index.real.js run --criteria criteria.yaml --search inputs/*
- [ ] Download PDFs (when prompted)
- [ ] node dist/index.real.js resume --run-id run-xxx
- [ ] Review results in outputs/run-xxx/

---

## 🎓 How It Works

ReviewScope uses **multi-agent AI consensus**:

1. **3 Independent AI Agents** screen each study
2. **Majority Vote** determines the decision
3. **Adjudicator** resolves ties
4. All decisions logged with evidence quotes

This approach:
- ✅ Reduces bias
- ✅ Increases reliability
- ✅ Provides transparency
- ✅ Follows PRISMA-ScR guidelines

---

## 📞 Need Help?

### Quick Help
```bash
node dist/index.real.js --help
node dist/index.real.js <command> --help
```

### Check Status
```bash
node dist/index.real.js status
```

### Read Documentation
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Commands cheat sheet
- [USER_GUIDE.md](USER_GUIDE.md) - Complete guide
- [README.md](README.md) - Technical details

---

## 🚀 Ready to Start?

You have everything you need! Here's your first command:

```bash
node dist/index.real.js init my-first-review
```

Then follow the instructions in the generated README.md file.

**Good luck with your scoping review!** 📊🔬

---

**ReviewScope** - Making scoping reviews faster, more consistent, and reproducible.
