/**
 * Adjudicator Agent - FULL IMPLEMENTATION
 * Resolves ties and conflicts in screening decisions
 * Most deterministic agent (temperature=0.0)
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Study,
  Criteria,
  ScreeningDecision,
  AdjudicatorResponse,
  AdjudicatorResponseSchema,
} from '../state/schemas.js';
import { ExtractedPdf } from '../tools/pdfExtract.js';

export class AdjudicatorAgent {
  private model: string;
  private temperature: number;
  private seed: number;
  private anthropic: Anthropic;

  constructor(
    apiKey: string,
    model: string = 'claude-sonnet-4-20250514',
    temperature: number = 0.0, // Most deterministic
    seed: number = 42
  ) {
    this.model = model;
    this.temperature = temperature;
    this.seed = seed;
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate system prompt for adjudication
   */
  getSystemPrompt(criteria: Criteria, prosperoProtocol?: string): string {
    return `You are an expert adjudicator for scoping review screening following PRISMA-ScR.

Your role is to make final decisions when screening agents disagree or vote is tied.

CRITICAL REQUIREMENTS:
1. Review all agent votes and their evidence carefully
2. Apply PCC criteria strictly and objectively
3. Cite specific quotes with page/section locations (for full-text)
4. Provide clear, concise rationale for your decision
5. Default to inclusion when evidence is borderline but meets criteria
6. Be conservative: exclude only when clearly violates criteria

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
  "final_decision": "include|exclude",
  "adjudicator_rationale": "Clear rationale citing specific evidence from votes and quotes with locations"
}`;
  }

  /**
   * Adjudicate a conflict using Anthropic API
   */
  async adjudicate(
    study: Study,
    votes: ScreeningDecision[],
    criteria: Criteria,
    stage: 'abstract' | 'fulltext',
    pdfText?: ExtractedPdf,
    prosperoProtocol?: string
  ): Promise<AdjudicatorResponse> {
    const userPrompt = this.buildPrompt(study, votes, stage, pdfText);
    const systemPrompt = this.getSystemPrompt(criteria, prosperoProtocol);

    try {
      const message = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
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
      const validated = AdjudicatorResponseSchema.parse(parsedResponse);

      return validated;
    } catch (error) {
      console.error(`Error adjudicating study ${study.study_id}:`, error);
      throw error;
    }
  }

  /**
   * Build adjudication prompt
   */
  private buildPrompt(
    study: Study,
    votes: ScreeningDecision[],
    stage: 'abstract' | 'fulltext',
    pdfText?: ExtractedPdf
  ): string {
    let prompt = `ADJUDICATION REQUEST - ${stage.toUpperCase()} SCREENING

STUDY INFORMATION:
Title: ${study.title}
Authors: ${study.authors.join(', ')}
Year: ${study.year}
Journal: ${study.journal}
DOI: ${study.doi || 'N/A'}

`;

    if (stage === 'abstract') {
      prompt += `ABSTRACT:\n${study.abstract || 'No abstract available'}\n\n`;
    } else if (pdfText) {
      const firstPages = pdfText.pages.slice(0, 5);
      prompt += `FULL TEXT (first 5 pages):\n${firstPages
        .map((p) => `PAGE ${p.page_number}:\n${p.text.substring(0, 1500)}`)
        .join('\n\n')}\n\n`;
    }

    prompt += `AGENT VOTES (${votes.length} agents):\n\n`;

    votes.forEach((vote, i) => {
      prompt += `AGENT ${i + 1} (${vote.agent_id}):
Decision: ${vote.decision}
Reasons:
${vote.reasons.map((r, j) => `  ${j + 1}. ${r}`).join('\n')}

Evidence Quotes:
${vote.evidence_quotes.map((q, j) => `  ${j + 1}. "${q.text}" (${q.location})`).join('\n')}

`;
    });

    const includeCount = votes.filter((v) => v.decision === 'include').length;
    const excludeCount = votes.filter((v) => v.decision === 'exclude').length;
    const unsureCount = votes.filter((v) => v.decision === 'unsure').length;

    prompt += `VOTE SUMMARY:
Include: ${includeCount}
Exclude: ${excludeCount}
Unsure: ${unsureCount}

Please provide your final adjudication decision in JSON format.`;

    return prompt;
  }
}
