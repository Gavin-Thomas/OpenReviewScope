/**
 * Full-Text Screening Agent - FULL IMPLEMENTATION
 * Reviews full-text PDFs against PCC and I/E criteria
 * Requires page-level citations for all evidence
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Study,
  Criteria,
  ScreeningDecision,
  FullTextScreeningResponse,
  FullTextScreeningResponseSchema,
} from '../state/schemas.js';
import { ExtractedPdf } from '../tools/pdfExtract.js';
import { createHash } from 'crypto';

export class FullTextScreeningAgent {
  private agentId: string;
  private model: string;
  private temperature: number;
  private seed: number;
  private anthropic: Anthropic;

  constructor(
    agentId: string,
    apiKey: string,
    model: string = 'claude-sonnet-4-20250514',
    temperature: number = 0.1,
    seed: number = 42
  ) {
    this.agentId = agentId;
    this.model = model;
    this.temperature = temperature;
    this.seed = seed;
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate system prompt for full-text screening
   */
  getSystemPrompt(criteria: Criteria, prosperoProtocol?: string): string {
    return `You are a methodical scoping-review screener following PRISMA-ScR guidelines.

Your task is to review FULL-TEXT studies against specific inclusion/exclusion criteria.

CRITICAL REQUIREMENTS:
1. Apply PCC (Population, Concept, Context) criteria STRICTLY
2. Read the full text carefully - do not just skim
3. Be conservative: exclude if study does not clearly meet ALL inclusion criteria
4. Always cite verbatim evidence with PAGE NUMBERS and SECTION
5. Provide at least 2 clear reasons for your decision
6. Include at least 2 direct quotes with page references (e.g., "p.4, Methods")

PCC CRITERIA:
Population: ${criteria.pcc.population}
Concept: ${criteria.pcc.concept}
Context: ${criteria.pcc.context}

INCLUSION CRITERIA:
${criteria.inclusion.map((c, i) => `${i + 1}. ${c}`).join('\n')}

EXCLUSION CRITERIA:
${criteria.exclusion.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${prosperoProtocol ? `\nPROSPERO PROTOCOL:\n${prosperoProtocol.substring(0, 2000)}` : ''}

You MUST respond with ONLY valid JSON in this exact format:
{
  "decision": "include|exclude|unsure",
  "reasons": ["reason 1", "reason 2"],
  "evidence_quotes": [
    {"text": "verbatim quote", "location": "p.4, Methods"},
    {"text": "another quote", "location": "p.7, Results"}
  ]
}`;
  }

  /**
   * Screen a single study full-text using Anthropic API
   */
  async screen(
    study: Study,
    pdfText: ExtractedPdf,
    criteria: Criteria,
    prosperoProtocol?: string
  ): Promise<ScreeningDecision> {
    const userPrompt = this.buildPrompt(study, pdfText);
    const systemPrompt = this.getSystemPrompt(criteria, prosperoProtocol);

    try {
      const message = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        temperature: this.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extract text response
      const responseText = message.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('');

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in response: ${responseText}`);
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      // Validate response against schema
      const validated = FullTextScreeningResponseSchema.parse(parsedResponse);

      // Create decision object
      const decision: ScreeningDecision = {
        stage: 'fulltext',
        agent_id: this.agentId,
        study_id: study.study_id,
        decision: validated.decision,
        reasons: validated.reasons,
        evidence_quotes: validated.evidence_quotes,
        timestamp: new Date().toISOString(),
        model: this.model,
        prompt_hash: this.hashPrompt(systemPrompt + userPrompt),
        seed: this.seed,
      };

      return decision;
    } catch (error) {
      console.error(`Error screening full-text for study ${study.study_id}:`, error);
      throw error;
    }
  }

  /**
   * Build the screening prompt for a study with full text
   */
  private buildPrompt(study: Study, pdfText: ExtractedPdf): string {
    // Include first 10 pages or all pages if fewer
    const pagesToInclude = pdfText.pages.slice(0, 10);

    const pagesText = pagesToInclude
      .map((page) => `--- PAGE ${page.page_number} ---\n${page.text}`)
      .join('\n\n');

    return `Review this FULL-TEXT study for screening:

TITLE: ${study.title}

AUTHORS: ${study.authors.join(', ')}

YEAR: ${study.year}

JOURNAL: ${study.journal}

FULL TEXT (${pdfText.total_pages} pages total, showing first ${pagesToInclude.length} pages):

${pagesText}

${pdfText.total_pages > 10 ? `\n[... ${pdfText.total_pages - 10} more pages not shown for brevity ...]` : ''}

Provide your screening decision in JSON format with page-level citations.`;
  }

  /**
   * Hash prompt for reproducibility tracking
   */
  private hashPrompt(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex').substring(0, 16);
  }
}

/**
 * Create 3 full-text screening agents with deterministic IDs
 */
export function createFullTextScreeningAgents(
  apiKey: string,
  model: string,
  temperature: number,
  seed: number
): FullTextScreeningAgent[] {
  return [
    new FullTextScreeningAgent('fulltext-screener-1', apiKey, model, temperature, seed),
    new FullTextScreeningAgent('fulltext-screener-2', apiKey, model, temperature, seed + 1),
    new FullTextScreeningAgent('fulltext-screener-3', apiKey, model, temperature, seed + 2),
  ];
}
