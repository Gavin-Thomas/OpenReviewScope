/**
 * Core TypeScript schemas for AUTOSCOPE scoping review system
 * Defines all data structures for studies, screening, extraction, and PRISMA tracking
 */

import { z } from 'zod';

// ============================================================================
// STUDY & BIBLIOGRAPHIC DATA
// ============================================================================

export const StudySchema = z.object({
  study_id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().int(),
  journal: z.string(),
  doi: z.string().nullable(),
  abstract: z.string().nullable(),
  keywords: z.array(z.string()).nullable(),
  source_file: z.string(),
  raw_record: z.record(z.any()),
  publisher_url: z.string().nullable().optional(),
});

export type Study = z.infer<typeof StudySchema>;

// ============================================================================
// CRITERIA (PCC + INCLUSION/EXCLUSION)
// ============================================================================

export const PCCSchema = z.object({
  population: z.string(),
  concept: z.string(),
  context: z.string(),
});

export const CriteriaSchema = z.object({
  pcc: PCCSchema,
  inclusion: z.array(z.string()),
  exclusion: z.array(z.string()),
});

export type PCC = z.infer<typeof PCCSchema>;
export type Criteria = z.infer<typeof CriteriaSchema>;

// ============================================================================
// SCREENING DECISIONS
// ============================================================================

export const EvidenceQuoteSchema = z.object({
  text: z.string(),
  location: z.string(), // e.g., "Abstract lines 3-6", "PDF p.4, Methods"
});

export type EvidenceQuote = z.infer<typeof EvidenceQuoteSchema>;

export const ScreeningDecisionSchema = z.object({
  stage: z.enum(['abstract', 'fulltext']),
  agent_id: z.string(),
  study_id: z.string(),
  decision: z.enum(['include', 'exclude', 'unsure']),
  reasons: z.array(z.string()).min(2, 'At least 2 reasons required'),
  evidence_quotes: z
    .array(EvidenceQuoteSchema)
    .min(1, 'At least 1 quote required'),
  timestamp: z.string(),
  model: z.string(),
  prompt_hash: z.string(),
  seed: z.number(),
});

export type ScreeningDecision = z.infer<typeof ScreeningDecisionSchema>;

// ============================================================================
// CONSENSUS DECISIONS
// ============================================================================

export const ConsensusDecisionSchema = z.object({
  stage: z.enum(['abstract', 'fulltext']),
  study_id: z.string(),
  votes: z.array(ScreeningDecisionSchema),
  consensus: z.enum(['include', 'exclude', 'escalate_to_adjudicator']),
  final_decision: z.enum(['include', 'exclude']),
  adjudicator_rationale: z.string().nullable(),
  timestamp: z.string(),
});

export type ConsensusDecision = z.infer<typeof ConsensusDecisionSchema>;

// ============================================================================
// DATA EXTRACTION - Enhanced for Comprehensive Scoping Reviews
// ============================================================================

export const ExtractionRecordSchema = z.object({
  study_id: z.string(),

  // Study Identifiers & Basic Info
  authors_full: z.string().nullable(),
  publication_type: z.string().nullable(), // Journal article, conference, thesis, etc.

  // Methodology
  design: z.string().nullable(),
  design_details: z.string().nullable(), // Specific design elements
  methodology_approach: z.string().nullable(), // Quantitative, qualitative, mixed-methods
  data_collection_methods: z.array(z.string()).nullable(),
  analysis_methods: z.array(z.string()).nullable(),
  theoretical_framework: z.string().nullable(),

  // Population & Setting
  setting: z.string().nullable(),
  setting_type: z.string().nullable(), // Clinical, community, school, etc.
  country: z.string().nullable(),
  region: z.string().nullable(), // Geographic region
  income_level: z.string().nullable(), // HIC, LMIC, etc.
  population_details: z.string().nullable(),
  sample_size: z.string().nullable(),
  participant_characteristics: z.array(z.string()).nullable(),
  inclusion_criteria_reported: z.string().nullable(),
  exclusion_criteria_reported: z.string().nullable(),

  // Intervention/Concept (flexible for different review types)
  intervention_or_concept: z.string().nullable(),
  intervention_type: z.string().nullable(),
  intervention_duration: z.string().nullable(),
  intervention_intensity: z.string().nullable(),
  intervention_delivery: z.string().nullable(),
  comparators: z.string().nullable(),

  // Outcomes & Measures
  outcomes: z.array(z.string()).nullable(),
  primary_outcomes: z.array(z.string()).nullable(),
  secondary_outcomes: z.array(z.string()).nullable(),
  measures: z.array(z.string()).nullable(),
  measurement_timepoints: z.array(z.string()).nullable(),

  // Results & Findings
  timeframe: z.string().nullable(),
  key_findings: z.array(z.string()).nullable(),
  effect_sizes: z.array(z.string()).nullable(),
  statistical_significance: z.string().nullable(),

  // Quality & Limitations
  funding_source: z.string().nullable(),
  funding_type: z.string().nullable(), // Government, industry, mixed, none
  conflicts_of_interest: z.string().nullable(),
  study_limitations: z.array(z.string()).nullable(),
  risk_of_bias: z.string().nullable(),
  quality_score: z.string().nullable(),

  // Additional Information
  tables_figures_mentions: z.array(z.string()).nullable(),
  recommendations: z.array(z.string()).nullable(),
  future_research_suggestions: z.array(z.string()).nullable(),
  notes: z.array(z.string()).nullable(),

  // Extraction Metadata
  data_completeness: z.string().nullable(), // High, medium, low
  extraction_confidence: z.string().nullable(), // High, medium, low
  unclear_items: z.array(z.string()).nullable(),
});

export type ExtractionRecord = z.infer<typeof ExtractionRecordSchema>;

// ============================================================================
// PRISMA COUNTS & FLOW
// ============================================================================

export const FullTextExclusionSchema = z.object({
  study_id: z.string(),
  reason: z.string(),
});

export const PrismaCountsSchema = z.object({
  identified: z.number().int(),
  deduplicated: z.number().int(),
  title_abstract_screened: z.number().int(),
  abstract_excluded: z.number().int(),
  fulltext_retrieved: z.number().int(),
  fulltext_excluded: z.array(FullTextExclusionSchema),
  included: z.number().int(),
});

export type PrismaCounts = z.infer<typeof PrismaCountsSchema>;
export type FullTextExclusion = z.infer<typeof FullTextExclusionSchema>;

// ============================================================================
// PDF FETCHING
// ============================================================================

export const FetchStatusSchema = z.union([
  z.literal('ok'),
  z.string().regex(/^fail:.+/),
  z.literal('not-found'),
]);

export const FetchResultSchema = z.object({
  study_id: z.string(),
  status: FetchStatusSchema,
  file_path: z.string().optional(),
  file_sha256: z.string().optional(),
  attempt_ts: z.string(),
  mode: z.enum(['openurl_browser', 'legacy_api']),
  source_url: z.string().optional(),
  doi_used: z.string().optional(),
  oa_source: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  bytes: z.number().optional(),
  user_agent_profile: z.string().optional(),
  notes: z.string().optional(),
  navigation_hops: z.array(z.string()).optional(), // For OpenURL mode
});

export type FetchResult = z.infer<typeof FetchResultSchema>;
export type FetchStatus = z.infer<typeof FetchStatusSchema>;

// ============================================================================
// GLOBAL STATE
// ============================================================================

export const GlobalStateSchema = z.object({
  run_id: z.string(),
  config: z.record(z.any()),
  criteria: CriteriaSchema.nullable(),
  prospero_protocol: z.string().nullable(), // Raw text or parsed
  studies: z.array(StudySchema),
  prisma_counts: PrismaCountsSchema,
  abstract_decisions: z.array(ScreeningDecisionSchema),
  abstract_consensus: z.array(ConsensusDecisionSchema),
  fulltext_decisions: z.array(ScreeningDecisionSchema),
  fulltext_consensus: z.array(ConsensusDecisionSchema),
  extractions: z.array(ExtractionRecordSchema),
  pdf_fetch_results: z.array(FetchResultSchema),
  missing_pdfs: z.array(z.string()), // study_ids
  current_stage: z.enum([
    'init',
    'ingested',
    'abstract_screening',
    'pdf_fetching',
    'pdf_to_markdown',
    'fulltext_screening',
    'extraction',
    'synthesis',
    'complete',
  ]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type GlobalState = z.infer<typeof GlobalStateSchema>;

// ============================================================================
// CONFIG
// ============================================================================

export const ConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4-5-20250929'),
  temperature: z.object({
    screening: z.number().default(0.1),
    adjudication: z.number().default(0.0),
    extraction: z.number().default(0.1),
    figures: z.number().default(0.3),
  }),
  seed: z.number().int().default(42),
  top_p: z.number().default(1.0),
  max_tokens: z.number().default(4096),
  ocr_enabled: z.boolean().default(true),
  dedupe_thresholds: z.object({
    title_similarity: z.number().default(0.85),
  }),
  pdf_fetch: z.object({
    mode_priority: z.array(z.enum(['openurl_browser', 'legacy_api'])),
    max_concurrency: z.number().default(4),
    host_rate_limits: z.object({
      default_rpm: z.number().default(30),
    }),
    retries: z.object({
      network: z.object({
        max: z.number().default(3),
        backoff_seconds: z.array(z.number()).default([1, 3, 7]),
      }),
      http403_probe: z.boolean().default(true),
    }),
    user_agent: z.string().default('AutoScopeBot/1.0 (+contact)'),
    campus_mode: z.enum(['auto', 'on', 'off']).default('auto'),
    accept_html_follow_pdf: z.boolean().default(true),
    validate_pdf: z.object({
      check_prolog: z.boolean().default(true),
      check_eof: z.boolean().default(true),
      min_pages: z.number().default(1),
    }),
    fuzzy_title_match_threshold: z.number().default(0.72),
    reuse_ok_entries: z.boolean().default(true),
    logs_dir: z.string().default('outputs/'),
    pdfs_dir: z.string().default('pdfs/'),
  }),
  outputs_dir: z.string().default('outputs/').optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// AGENT RESPONSE SCHEMAS (for validation)
// ============================================================================

export const AbstractScreeningResponseSchema = z.object({
  decision: z.enum(['include', 'exclude', 'unsure']),
  reasons: z.array(z.string()).min(2),
  evidence_quotes: z.array(EvidenceQuoteSchema).min(1),
});

export const FullTextScreeningResponseSchema = z.object({
  decision: z.enum(['include', 'exclude', 'unsure']),
  reasons: z.array(z.string()).min(2),
  evidence_quotes: z.array(EvidenceQuoteSchema).min(2),
});

export const AdjudicatorResponseSchema = z.object({
  final_decision: z.enum(['include', 'exclude']),
  adjudicator_rationale: z.string(),
});

export type AbstractScreeningResponse = z.infer<
  typeof AbstractScreeningResponseSchema
>;
export type FullTextScreeningResponse = z.infer<
  typeof FullTextScreeningResponseSchema
>;
export type AdjudicatorResponse = z.infer<typeof AdjudicatorResponseSchema>;
