/**
 * PDF to Markdown Converter Agent
 * Converts extracted PDF text into clean, structured Markdown
 */

import Anthropic from '@anthropic-ai/sdk';
import { ExtractedPdf } from '../tools/pdfExtract.js';
import { z } from 'zod';

// Zod schema for markdown conversion response
const MarkdownConversionSchema = z.object({
  markdown: z.string().describe('Clean markdown representation of the PDF'),
  sections_identified: z.array(z.string()).describe('List of main sections found (e.g., Abstract, Methods, Results)'),
  quality_score: z.number().min(1).max(10).describe('Self-assessed quality score (1-10)'),
  notes: z.string().optional().describe('Any notes about conversion challenges'),
});

export type MarkdownConversion = z.infer<typeof MarkdownConversionSchema>;

export class PdfToMarkdownConverter {
  private anthropic: Anthropic;
  private model: string;
  private agentId: string;

  constructor(apiKey: string, model: string, agentId: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.model = model;
    this.agentId = agentId;
  }

  /**
   * Convert PDF to structured Markdown
   */
  async convert(
    studyId: string,
    pdfText: ExtractedPdf,
    title: string
  ): Promise<MarkdownConversion> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(studyId, pdfText, title);

    try {
      const message = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 8192, // Larger for full markdown output
        temperature: 0.1, // Low temp for consistent formatting
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      // Parse JSON response
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON block found in response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      return MarkdownConversionSchema.parse(parsed);
    } catch (error) {
      console.error(`Error converting PDF ${studyId}:`, error);
      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert scientific document converter specializing in converting academic PDFs to clean, well-structured Markdown.

Your task is to:
1. Convert PDF text into clean, readable Markdown
2. Preserve document structure (headings, sections, lists)
3. Identify and properly format:
   - Title and authors
   - Abstract
   - Introduction, Methods, Results, Discussion sections
   - Tables (convert to markdown tables where possible)
   - Figure captions
   - References
4. Clean up OCR artifacts and formatting issues
5. Use proper markdown syntax (# for headings, ## for subheadings, etc.)
6. Preserve scientific notation, formulas, and special characters

Quality standards:
- Use ATX-style headings (# ## ###)
- Keep paragraphs separated by blank lines
- Format lists with - or 1. 2. 3.
- Use **bold** for emphasis, *italic* for terms
- Preserve table structure when present
- Clean up hyphenation artifacts from line breaks
- Remove page numbers, headers, footers

Self-assess your conversion quality on a 1-10 scale.`;
  }

  private buildUserPrompt(
    studyId: string,
    pdfText: ExtractedPdf,
    title: string
  ): string {
    // Get first 30 pages or all pages if fewer
    const pages = pdfText.pages.slice(0, 30);
    const fullText = pages.map((p) => `[Page ${p.page_number}]\n${p.text}`).join('\n\n');

    return `Convert the following scientific paper to clean, structured Markdown.

**Study ID:** ${studyId}
**Title:** ${title}
**Total Pages:** ${pdfText.total_pages}
**Pages Provided:** ${pages.length}

**PDF Text:**
${fullText.substring(0, 100000)} ${fullText.length > 100000 ? '...[truncated]' : ''}

**Instructions:**
1. Create a well-structured markdown document
2. Identify all major sections (Abstract, Methods, Results, etc.)
3. Clean up any OCR or formatting artifacts
4. Preserve scientific content accurately
5. Use proper markdown formatting throughout

**Output Format:**
Return a JSON object with:
\`\`\`json
{
  "markdown": "# Full markdown content here...",
  "sections_identified": ["Abstract", "Methods", "Results", "Discussion"],
  "quality_score": 8,
  "notes": "Any challenges or issues encountered"
}
\`\`\`

Agent: ${this.agentId}`;
  }
}
