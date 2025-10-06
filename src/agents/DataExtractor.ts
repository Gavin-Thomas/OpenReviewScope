/**
 * Data Extraction Agent - FULL IMPLEMENTATION
 * Extracts structured data from included full-text studies
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Study,
  ExtractionRecord,
  ExtractionRecordSchema,
} from '../state/schemas.js';
import { ExtractedPdf } from '../tools/pdfExtract.js';

export class DataExtractorAgent {
  private model: string;
  private temperature: number;
  private anthropic: Anthropic;

  constructor(
    apiKey: string,
    model: string = 'claude-sonnet-4-20250514',
    temperature: number = 0.1
  ) {
    this.model = model;
    this.temperature = temperature;
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Generate comprehensive system prompt for data extraction
   */
  getSystemPrompt(): string {
    return `You are an expert data extraction specialist for systematic scoping reviews following PRISMA-ScR guidelines.

Your task is to extract comprehensive, structured data from full-text studies for evidence synthesis.

EXTRACTION GUIDELINES:
1. Be precise and extract exact information as reported in the study
2. Use direct quotes with page numbers for key findings
3. Distinguish between primary and secondary outcomes
4. Extract all methodological details for quality assessment
5. Identify gaps, limitations, and future research needs
6. Rate your confidence in the extraction (high/medium/low)
7. Note any unclear or ambiguous items
8. Use null for fields where information is genuinely not available

EVIDENCE MAPPING FOCUS:
- Extract data to support evidence maps showing distributions across:
  * Study designs and methodological approaches
  * Geographic regions and settings
  * Population characteristics
  * Intervention types and delivery methods
  * Outcome categories and measurement approaches
  * Temporal trends and gaps

QUALITY INDICATORS:
- Report funding sources and potential conflicts
- Extract study limitations as stated by authors
- Note data collection and analysis methods
- Identify theoretical frameworks used

You MUST respond with ONLY valid JSON using this comprehensive schema:
{
  "authors_full": "Full author list as cited",
  "publication_type": "Journal article/Conference paper/Thesis/Report/etc.",

  "design": "Primary study design (RCT/Cohort/Case-control/Cross-sectional/Qualitative/Mixed-methods/etc.)",
  "design_details": "Specific design features (e.g., 'Parallel-group RCT, double-blind, placebo-controlled')",
  "methodology_approach": "Quantitative/Qualitative/Mixed-methods",
  "data_collection_methods": ["Survey", "Interview", "Observation", etc.] or null,
  "analysis_methods": ["Descriptive statistics", "Thematic analysis", "Regression", etc.] or null,
  "theoretical_framework": "Any theoretical model or framework used" or null,

  "setting": "Detailed setting description",
  "setting_type": "Clinical/Community/School/Workplace/Home/etc.",
  "country": "Country name",
  "region": "Geographic region (e.g., North America, Western Europe, Sub-Saharan Africa)",
  "income_level": "HIC/UMIC/LMIC/LIC based on World Bank classification" or null,
  "population_details": "Detailed population characteristics",
  "sample_size": "Sample size (n=X) or 'Not reported'",
  "participant_characteristics": ["Age range", "Gender distribution", "Key demographics"] or null,
  "inclusion_criteria_reported": "Summary of inclusion criteria" or null,
  "exclusion_criteria_reported": "Summary of exclusion criteria" or null,

  "intervention_or_concept": "Main intervention or concept studied",
  "intervention_type": "Behavioral/Pharmacological/Educational/Policy/etc." or null,
  "intervention_duration": "Duration if applicable (e.g., '12 weeks', '6 months')" or null,
  "intervention_intensity": "Frequency/intensity if applicable" or null,
  "intervention_delivery": "How delivered (e.g., 'Individual sessions', 'Group-based', 'Digital platform')" or null,
  "comparators": "Comparison groups" or null,

  "outcomes": ["All outcomes studied"] or null,
  "primary_outcomes": ["Primary outcomes as stated"] or null,
  "secondary_outcomes": ["Secondary outcomes"] or null,
  "measures": ["Specific measurement instruments/tools"] or null,
  "measurement_timepoints": ["Baseline", "Post-intervention", "6-month follow-up"] or null,

  "timeframe": "Study period/duration",
  "key_findings": ["Finding 1 (p.X)", "Finding 2 (p.Y)"] or null,
  "effect_sizes": ["Effect size 1", "Effect size 2"] or null,
  "statistical_significance": "Summary of significance testing" or null,

  "funding_source": "Funding organization(s)" or null,
  "funding_type": "Government/Industry/Foundation/Mixed/None/Not reported",
  "conflicts_of_interest": "COI statement summary" or null,
  "study_limitations": ["Limitation 1", "Limitation 2"] or null,
  "risk_of_bias": "Risk assessment if provided" or null,
  "quality_score": "Any quality score reported" or null,

  "tables_figures_mentions": ["Key table/figure descriptions"] or null,
  "recommendations": ["Author recommendations for practice/policy"] or null,
  "future_research_suggestions": ["Future research needs identified"] or null,
  "notes": ["Any additional important notes"] or null,

  "data_completeness": "High/Medium/Low - based on how complete the reporting was",
  "extraction_confidence": "High/Medium/Low - your confidence in the extraction",
  "unclear_items": ["Items that were unclear or ambiguous"] or null
}

IMPORTANT: Extract ALL available information. Leave fields as null only if the information is genuinely not present in the article.`;
  }

  /**
   * Extract data from a single study
   */
  async extract(
    study: Study,
    pdfText: ExtractedPdf
  ): Promise<ExtractionRecord> {
    const userPrompt = this.buildPrompt(study, pdfText);
    const systemPrompt = this.getSystemPrompt();

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

      // Add study_id
      parsedResponse.study_id = study.study_id;

      // Validate response against schema
      const validated = ExtractionRecordSchema.parse(parsedResponse);

      return validated;
    } catch (error) {
      console.error(`Error extracting data for study ${study.study_id}:`, error);
      throw error;
    }
  }

  /**
   * Build extraction prompt
   */
  private buildPrompt(study: Study, pdfText: ExtractedPdf): string {
    // Include all pages but truncate very long ones
    const pagesText = pdfText.pages
      .map((page) => {
        const text = page.text.substring(0, 2000); // Limit per page
        return `--- PAGE ${page.page_number} ---\n${text}`;
      })
      .join('\n\n');

    return `Extract data from this FULL-TEXT study:

TITLE: ${study.title}

AUTHORS: ${study.authors.join(', ')}

YEAR: ${study.year}

JOURNAL: ${study.journal}

FULL TEXT (${pdfText.total_pages} pages):

${pagesText}

Extract all required fields in JSON format.`;
  }

  /**
   * Extract data from multiple studies in batch
   */
  async extractBatch(
    studiesWithPdfs: Array<{ study: Study; pdfText: ExtractedPdf }>,
    batchSize: number = 3,
    delayMs: number = 2000
  ): Promise<ExtractionRecord[]> {
    const extractions: ExtractionRecord[] = [];

    for (let i = 0; i < studiesWithPdfs.length; i += batchSize) {
      const batch = studiesWithPdfs.slice(i, i + batchSize);

      // Process batch in parallel
      const batchExtractions = await Promise.all(
        batch.map(({ study, pdfText }) => this.extract(study, pdfText))
      );

      extractions.push(...batchExtractions);

      // Rate limiting delay
      if (i + batchSize < studiesWithPdfs.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      console.log(`Extracted ${Math.min(i + batchSize, studiesWithPdfs.length)}/${studiesWithPdfs.length} studies`);
    }

    return extractions;
  }
}
