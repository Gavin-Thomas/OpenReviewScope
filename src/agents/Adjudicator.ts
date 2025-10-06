/**
 * Adjudicator Agent
 * Resolves ties and conflicts in screening decisions
 * Applies PCC criteria with evidence-based rationale
 */

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

  constructor(
    model: string = 'claude-sonnet-4-5-20250929',
    temperature: number = 0.0, // Most deterministic
    seed: number = 42
  ) {
    this.model = model;
    this.temperature = temperature;
    this.seed = seed;
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

OUTPUT FORMAT (JSON only):
{
  "final_decision": "include|exclude",
  "adjudicator_rationale": "Clear rationale citing specific evidence from votes and quotes with locations"
}`;
  }

  /**
   * Adjudicate a conflict
   */
  async adjudicate(
    study: Study,
    votes: ScreeningDecision[],
    criteria: Criteria,
    stage: 'abstract' | 'fulltext',
    pdfText?: ExtractedPdf,
    prosperoProtocol?: string
  ): Promise<AdjudicatorResponse> {
    const prompt = this.buildPrompt(study, votes, stage, pdfText);
    const systemPrompt = this.getSystemPrompt(criteria, prosperoProtocol);

    // Mock implementation - real code would use Claude SDK
    const mockResponse = this.getMockResponse(votes);

    // Validate response
    const parsed = AdjudicatorResponseSchema.parse(mockResponse);

    return parsed;
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
      prompt += `FULL TEXT (first 3 pages):\n${pdfText.pages
        .slice(0, 3)
        .map((p) => `PAGE ${p.page_number}:\n${p.text.substring(0, 1000)}`)
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

    prompt += `VOTE SUMMARY:
Include: ${votes.filter((v) => v.decision === 'include').length}
Exclude: ${votes.filter((v) => v.decision === 'exclude').length}
Unsure: ${votes.filter((v) => v.decision === 'unsure').length}

Please provide your final adjudication decision in JSON format.`;

    return prompt;
  }

  /**
   * Mock response (placeholder)
   */
  private getMockResponse(votes: ScreeningDecision[]): AdjudicatorResponse {
    const includeCount = votes.filter((v) => v.decision === 'include').length;
    const excludeCount = votes.filter((v) => v.decision === 'exclude').length;

    // Simple majority
    const decision = includeCount >= excludeCount ? 'include' : 'exclude';

    return {
      final_decision: decision,
      adjudicator_rationale: `After reviewing all agent votes and evidence, the study ${decision === 'include' ? 'meets' : 'does not meet'} the inclusion criteria. ${includeCount} agents voted to include while ${excludeCount} voted to exclude. The preponderance of evidence supports ${decision}.`,
    };
  }
}
