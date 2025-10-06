/**
 * Markdown Quality Checker Agent
 * Reviews markdown conversions from two converter agents and selects the best one
 */

import Anthropic from '@anthropic-ai/sdk';
import { ExtractedPdf } from '../tools/pdfExtract.js';
import { MarkdownConversion } from './PdfToMarkdownConverter.js';
import { z } from 'zod';

const QualityCheckSchema = z.object({
  selected_version: z.enum(['agent_1', 'agent_2', 'hybrid']).describe('Which version to use'),
  quality_scores: z.object({
    agent_1: z.number().min(1).max(10),
    agent_2: z.number().min(1).max(10),
  }),
  rationale: z.string().describe('Explanation of selection decision'),
  improvements_needed: z.array(z.string()).optional().describe('List of improvements if hybrid approach'),
  final_markdown: z.string().optional().describe('Final markdown if hybrid version created'),
});

export type QualityCheck = z.infer<typeof QualityCheckSchema>;

export class MarkdownQualityChecker {
  private anthropic: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Compare two markdown conversions and select the best
   */
  async check(
    studyId: string,
    pdfText: ExtractedPdf,
    title: string,
    conversion1: MarkdownConversion,
    conversion2: MarkdownConversion
  ): Promise<QualityCheck> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(
      studyId,
      pdfText,
      title,
      conversion1,
      conversion2
    );

    try {
      const message = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 8192,
        temperature: 0.0, // Deterministic for quality assessment
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON block found in response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      return QualityCheckSchema.parse(parsed);
    } catch (error) {
      console.error(`Error checking quality for ${studyId}:`, error);
      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert quality assurance reviewer for scientific document conversions.

Your task is to compare two markdown conversions of the same PDF and determine which is superior, or create a hybrid version combining the best of both.

Evaluation criteria:
1. **Structure**: Proper heading hierarchy, section identification
2. **Completeness**: All important content preserved
3. **Formatting**: Clean markdown syntax, proper lists, tables
4. **Accuracy**: Scientific content correctly represented
5. **Readability**: Clear, well-organized, easy to navigate
6. **Artifacts**: Minimal OCR errors, hyphenation issues, formatting glitches

Decision options:
- Select "agent_1" if first version is clearly superior
- Select "agent_2" if second version is clearly superior
- Select "hybrid" if you can create a better version by combining both

Be rigorous and objective. Provide clear rationale for your decision.`;
  }

  private buildUserPrompt(
    studyId: string,
    pdfText: ExtractedPdf,
    title: string,
    conversion1: MarkdownConversion,
    conversion2: MarkdownConversion
  ): string {
    // Sample of original PDF for reference
    const sampleText = pdfText.pages
      .slice(0, 3)
      .map((p) => `[Page ${p.page_number}]\n${p.text.substring(0, 1000)}`)
      .join('\n\n');

    return `Compare these two markdown conversions and select the best version.

**Study ID:** ${studyId}
**Title:** ${title}

**Original PDF Sample (first 3 pages):**
${sampleText}

**Version 1 (Agent 1):**
Self-assessed quality: ${conversion1.quality_score}/10
Sections: ${conversion1.sections_identified.join(', ')}
Notes: ${conversion1.notes || 'None'}

Markdown:
${conversion1.markdown.substring(0, 5000)}${conversion1.markdown.length > 5000 ? '\n...[truncated]' : ''}

**Version 2 (Agent 2):**
Self-assessed quality: ${conversion2.quality_score}/10
Sections: ${conversion2.sections_identified.join(', ')}
Notes: ${conversion2.notes || 'None'}

Markdown:
${conversion2.markdown.substring(0, 5000)}${conversion2.markdown.length > 5000 ? '\n...[truncated]' : ''}

**Your Task:**
1. Evaluate both versions against quality criteria
2. Assign objective quality scores (1-10) to each
3. Select the best version OR create a hybrid if you can improve on both
4. Provide clear rationale for your decision

**Output Format:**
\`\`\`json
{
  "selected_version": "agent_1" | "agent_2" | "hybrid",
  "quality_scores": {
    "agent_1": 8,
    "agent_2": 7
  },
  "rationale": "Detailed explanation of why this version was selected...",
  "improvements_needed": ["List if hybrid"],
  "final_markdown": "Full markdown if hybrid version created"
}
\`\`\``;
  }
}
