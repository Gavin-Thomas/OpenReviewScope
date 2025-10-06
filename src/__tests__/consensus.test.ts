/**
 * Tests for consensus logic
 */

import { describe, it, expect } from 'vitest';
import { calculateConsensus } from '../workflows/consensus.js';
import { ScreeningDecision } from '../state/schemas.js';

const createMockDecision = (
  decision: 'include' | 'exclude' | 'unsure',
  agentId: string
): ScreeningDecision => ({
  stage: 'abstract',
  agent_id: agentId,
  study_id: 'test-study',
  decision,
  reasons: ['Reason 1', 'Reason 2'],
  evidence_quotes: [
    { text: 'Quote', location: 'Abstract' },
  ],
  timestamp: new Date().toISOString(),
  model: 'test-model',
  prompt_hash: 'hash123',
  seed: 42,
});

describe('Consensus Logic', () => {
  it('should return include for 3-0 include votes', () => {
    const votes = [
      createMockDecision('include', 'agent-1'),
      createMockDecision('include', 'agent-2'),
      createMockDecision('include', 'agent-3'),
    ];

    const result = calculateConsensus('test-study', votes, 'abstract');

    expect(result.needsAdjudication).toBe(false);
    expect(result.preliminaryConsensus).toBe('include');
  });

  it('should return exclude for 3-0 exclude votes', () => {
    const votes = [
      createMockDecision('exclude', 'agent-1'),
      createMockDecision('exclude', 'agent-2'),
      createMockDecision('exclude', 'agent-3'),
    ];

    const result = calculateConsensus('test-study', votes, 'abstract');

    expect(result.needsAdjudication).toBe(false);
    expect(result.preliminaryConsensus).toBe('exclude');
  });

  it('should return include for 2-1 include votes', () => {
    const votes = [
      createMockDecision('include', 'agent-1'),
      createMockDecision('include', 'agent-2'),
      createMockDecision('exclude', 'agent-3'),
    ];

    const result = calculateConsensus('test-study', votes, 'abstract');

    expect(result.needsAdjudication).toBe(false);
    expect(result.preliminaryConsensus).toBe('include');
  });

  it('should return exclude for 2-1 exclude votes', () => {
    const votes = [
      createMockDecision('exclude', 'agent-1'),
      createMockDecision('exclude', 'agent-2'),
      createMockDecision('include', 'agent-3'),
    ];

    const result = calculateConsensus('test-study', votes, 'abstract');

    expect(result.needsAdjudication).toBe(false);
    expect(result.preliminaryConsensus).toBe('exclude');
  });

  it('should escalate when any agent votes unsure', () => {
    const votes = [
      createMockDecision('include', 'agent-1'),
      createMockDecision('unsure', 'agent-2'),
      createMockDecision('include', 'agent-3'),
    ];

    const result = calculateConsensus('test-study', votes, 'abstract');

    expect(result.needsAdjudication).toBe(true);
    expect(result.preliminaryConsensus).toBe('escalate_to_adjudicator');
  });

  it('should escalate on 1-1-1 split', () => {
    const votes = [
      createMockDecision('include', 'agent-1'),
      createMockDecision('exclude', 'agent-2'),
      createMockDecision('unsure', 'agent-3'),
    ];

    const result = calculateConsensus('test-study', votes, 'abstract');

    expect(result.needsAdjudication).toBe(true);
    expect(result.preliminaryConsensus).toBe('escalate_to_adjudicator');
  });

  it('should throw error for wrong number of votes', () => {
    const votes = [
      createMockDecision('include', 'agent-1'),
      createMockDecision('include', 'agent-2'),
    ];

    expect(() => {
      calculateConsensus('test-study', votes, 'abstract');
    }).toThrow('Expected 3 votes');
  });
});
