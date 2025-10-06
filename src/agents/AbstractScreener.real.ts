/**
 * Abstract Screening Agent - FULL IMPLEMENTATION
 * Reviews study abstracts against PCC and I/E criteria
 * Uses Anthropic SDK directly for reliability
 */

import Anthropic from '@anthropic-ai/sdk';
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

You MUST respond with ONLY valid JSON in this exact format:
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
   * Screen a single study abstract using Anthropic API
   */
  async screen(
    study: Study,
    criteria: Criteria,
    prosperoProtocol?: string
  ): Promise<ScreeningDecision> {
    const userPrompt = this.buildPrompt(study);
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
      const validated = AbstractScreeningResponseSchema.parse(parsedResponse);

      // Create decision object
      const decision: ScreeningDecision = {
        stage: 'abstract',
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
      console.error(`Error screening study ${study.study_id}:`, error);
      throw error;
    }
  }

  /**
   * Screen multiple studies in batch (with rate limiting)
   */
  async screenBatch(
    studies: Study[],
    criteria: Criteria,
    prosperoProtocol?: string,
    batchSize: number = 5,
    delayMs: number = 1000
  ): Promise<ScreeningDecision[]> {
    const decisions: ScreeningDecision[] = [];

    for (let i = 0; i < studies.length; i += batchSize) {
      const batch = studies.slice(i, i + batchSize);

      // Process batch in parallel
      const batchDecisions = await Promise.all(
        batch.map((study) => this.screen(study, criteria, prosperoProtocol))
      );

      decisions.push(...batchDecisions);

      // Rate limiting delay
      if (i + batchSize < studies.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return decisions;
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
}

/**
 * Create 3 abstract screening agents with deterministic IDs
 */
export function createAbstractScreeningAgents(
  apiKey: string,
  model: string,
  temperature: number,
  seed: number
): AbstractScreeningAgent[] {
  return [
    new AbstractScreeningAgent('abstract-screener-1', apiKey, model, temperature, seed),
    new AbstractScreeningAgent('abstract-screener-2', apiKey, model, temperature, seed + 1),
    new AbstractScreeningAgent('abstract-screener-3', apiKey, model, temperature, seed + 2),
  ];
}
