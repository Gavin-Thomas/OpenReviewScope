/**
 * Abstract Screening Agent
 * Reviews study abstracts against PCC and I/E criteria
 * Must provide specific reasons with quotes from abstract/title
 */

import {
  Study,
  Criteria,
  ScreeningDecision,
  AbstractScreeningResponse,
  AbstractScreeningResponseSchema,
} from '../state/schemas.js';
import { createHash } from 'crypto';

export class AbstractScreeningAgent {
  private agentId: string;
  private model: string;
  private temperature: number;
  private seed: number;

  constructor(
    agentId: string,
    model: string = 'claude-sonnet-4-5-20250929',
    temperature: number = 0.1,
    seed: number = 42
  ) {
    this.agentId = agentId;
    this.model = model;
    this.temperature = temperature;
    this.seed = seed;
  }

  /**
   * Generate system prompt for abstract screening
   */
  getSystemPrompt(criteria: Criteria, prosperoProtocol?: string): string {
    return `You are a methodical scoping-review screener following PRISMA-ScR guidelines.

Your task is to review study abstracts and titles against specific inclusion/exclusion criteria.

CRITICAL REQUIREMENTS:
1. Apply PCC (Population, Concept, Context) criteria STRICTLY
2. Do not infer beyond what is explicitly stated in the title/abstract
3. Be conservative: if unclear, mark as "unsure"
4. Always cite verbatim evidence with location (title or abstract lines)
5. Provide at least 2 clear reasons for your decision
6. Include at least 1 direct quote from the title or abstract

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
  "decision": "include|exclude|unsure",
  "reasons": ["reason 1", "reason 2"],
  "evidence_quotes": [
    {"text": "verbatim quote", "location": "Abstract lines 3-5"},
    {"text": "another quote", "location": "Title"}
  ]
}`;
  }

  /**
   * Screen a single study abstract
   */
  async screen(
    study: Study,
    criteria: Criteria,
    prosperoProtocol?: string,
    // In real implementation, this would use Claude SDK
    claudeQuery?: (prompt: string) => Promise<string>
  ): Promise<ScreeningDecision> {
    const prompt = this.buildPrompt(study);
    const systemPrompt = this.getSystemPrompt(criteria, prosperoProtocol);

    // Mock implementation - in real code, use Claude SDK
    // const response = await claudeQuery?.(prompt);
    // For now, return a mock response
    const mockResponse = this.getMockResponse(study, criteria);

    // Validate response
    const parsed = AbstractScreeningResponseSchema.parse(mockResponse);

    // Create decision object
    const decision: ScreeningDecision = {
      stage: 'abstract',
      agent_id: this.agentId,
      study_id: study.study_id,
      decision: parsed.decision,
      reasons: parsed.reasons,
      evidence_quotes: parsed.evidence_quotes,
      timestamp: new Date().toISOString(),
      model: this.model,
      prompt_hash: this.hashPrompt(systemPrompt + prompt),
      seed: this.seed,
    };

    return decision;
  }

  /**
   * Build the screening prompt for a study
   */
  private buildPrompt(study: Study): string {
    return `Review this study for screening:

TITLE: ${study.title}

AUTHORS: ${study.authors.join(', ')}

YEAR: ${study.year}

JOURNAL: ${study.journal}

ABSTRACT:
${study.abstract || 'No abstract available'}

${study.keywords ? `KEYWORDS: ${study.keywords.join(', ')}` : ''}

Provide your screening decision in JSON format.`;
  }

  /**
   * Hash prompt for reproducibility tracking
   */
  private hashPrompt(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex').substring(0, 16);
  }

  /**
   * Mock response (placeholder for real Claude API call)
   */
  private getMockResponse(
    study: Study,
    criteria: Criteria
  ): AbstractScreeningResponse {
    // This is a placeholder - real implementation would call Claude
    return {
      decision: 'include',
      reasons: [
        'Study addresses the target population',
        'Concept aligns with inclusion criteria',
      ],
      evidence_quotes: [
        {
          text: study.title.substring(0, 50),
          location: 'Title',
        },
        {
          text: study.abstract?.substring(0, 100) || 'N/A',
          location: 'Abstract lines 1-3',
        },
      ],
    };
  }
}

/**
 * Create 3 abstract screening agents with deterministic IDs
 */
export function createAbstractScreeningAgents(
  model: string,
  temperature: number,
  seed: number
): AbstractScreeningAgent[] {
  return [
    new AbstractScreeningAgent('abstract-screener-1', model, temperature, seed),
    new AbstractScreeningAgent('abstract-screener-2', model, temperature, seed + 1),
    new AbstractScreeningAgent('abstract-screener-3', model, temperature, seed + 2),
  ];
}
