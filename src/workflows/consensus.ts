/**
 * Consensus logic for multi-agent screening
 * Implements majority voting and escalation rules
 */

import {
  ScreeningDecision,
  ConsensusDecision,
} from '../state/schemas.js';

/**
 * Calculate consensus from multiple screening decisions
 * Rules:
 * - 2-1 include → include
 * - 2-1 exclude → exclude
 * - 1-1-1 or any "unsure" → escalate to adjudicator
 * - Ties → escalate to adjudicator
 */
export function calculateConsensus(
  studyId: string,
  votes: ScreeningDecision[],
  stage: 'abstract' | 'fulltext'
): {
  needsAdjudication: boolean;
  preliminaryConsensus: 'include' | 'exclude' | 'escalate_to_adjudicator';
} {
  if (votes.length !== 3) {
    throw new Error(`Expected 3 votes, got ${votes.length}`);
  }

  const includeCount = votes.filter((v) => v.decision === 'include').length;
  const excludeCount = votes.filter((v) => v.decision === 'exclude').length;
  const unsureCount = votes.filter((v) => v.decision === 'unsure').length;

  // If any agent is unsure, escalate
  if (unsureCount > 0) {
    return {
      needsAdjudication: true,
      preliminaryConsensus: 'escalate_to_adjudicator',
    };
  }

  // Clear majority include (2 or 3)
  if (includeCount >= 2) {
    return {
      needsAdjudication: false,
      preliminaryConsensus: 'include',
    };
  }

  // Clear majority exclude (2 or 3)
  if (excludeCount >= 2) {
    return {
      needsAdjudication: false,
      preliminaryConsensus: 'exclude',
    };
  }

  // 1-1-1 split or other edge case → escalate
  return {
    needsAdjudication: true,
    preliminaryConsensus: 'escalate_to_adjudicator',
  };
}

/**
 * Create consensus decision object
 */
export function createConsensusDecision(
  studyId: string,
  votes: ScreeningDecision[],
  stage: 'abstract' | 'fulltext',
  adjudicatorRationale?: string
): ConsensusDecision {
  const { needsAdjudication, preliminaryConsensus } = calculateConsensus(
    studyId,
    votes,
    stage
  );

  let finalDecision: 'include' | 'exclude';

  if (needsAdjudication) {
    // Must have adjudicator rationale
    if (!adjudicatorRationale) {
      throw new Error(
        'Adjudicator rationale required for escalated decisions'
      );
    }
    // Parse decision from rationale (or it should be passed separately)
    // For now, use a heuristic
    finalDecision = 'include'; // Placeholder
  } else {
    finalDecision = preliminaryConsensus as 'include' | 'exclude';
  }

  return {
    stage,
    study_id: studyId,
    votes,
    consensus: preliminaryConsensus,
    final_decision: finalDecision,
    adjudicator_rationale: adjudicatorRationale || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Batch consensus for multiple studies
 */
export function batchConsensus(
  studyVotes: Map<string, ScreeningDecision[]>,
  stage: 'abstract' | 'fulltext'
): {
  decisions: ConsensusDecision[];
  needsAdjudication: Map<string, ScreeningDecision[]>;
} {
  const decisions: ConsensusDecision[] = [];
  const needsAdjudication = new Map<string, ScreeningDecision[]>();

  for (const [studyId, votes] of studyVotes.entries()) {
    const { needsAdjudication: needsAdj } = calculateConsensus(
      studyId,
      votes,
      stage
    );

    if (needsAdj) {
      needsAdjudication.set(studyId, votes);
    } else {
      const decision = createConsensusDecision(studyId, votes, stage);
      decisions.push(decision);
    }
  }

  return { decisions, needsAdjudication };
}
