/**
 * Extraction Table Generators for Scoping Reviews
 * Creates publication-quality tables for evidence synthesis
 */

import { ExtractionRecord, Study } from '../state/schemas.js';
import { promises as fs } from 'fs';
import path from 'path';

export class ExtractionTableGenerator {
  /**
   * Escape CSV field
   */
  private escapeCsv(field: string | null | undefined): string {
    if (!field) return '';
    const cleaned = String(field).replace(/\n/g, ' ').replace(/\r/g, '').trim();
    if (cleaned.includes(',') || cleaned.includes('"') || cleaned.includes('\n')) {
      return `"${cleaned.replace(/"/g, '""')}"`;
    }
    return cleaned;
  }

  /**
   * Array to string helper
   */
  private arrayToString(arr: string[] | null | undefined): string {
    if (!arr || arr.length === 0) return '';
    return arr.join('; ');
  }

  /**
   * Generate Table 1: Study Characteristics
   * Standard table for scoping reviews showing basic study information
   */
  async generateStudyCharacteristicsTable(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(extractions.map((e) => [e.study_id, e]));

    const headers = [
      'Author(s)',
      'Year',
      'Country',
      'Study Design',
      'Population',
      'Sample Size',
      'Setting',
      'Key Findings',
    ];

    const rows = studies.map((study) => {
      const ext = extractionMap.get(study.study_id);
      return [
        this.escapeCsv(study.authors[0] + (study.authors.length > 1 ? ' et al.' : '')),
        study.year,
        this.escapeCsv(ext?.country || 'Not reported'),
        this.escapeCsv(ext?.design || 'Not reported'),
        this.escapeCsv(ext?.population_details || 'Not reported'),
        this.escapeCsv(ext?.sample_size || 'Not reported'),
        this.escapeCsv(ext?.setting || 'Not reported'),
        this.escapeCsv(this.arrayToString(ext?.key_findings?.slice(0, 2))),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Table 2: Methodological Characteristics
   * Detailed methodology for quality assessment
   */
  async generateMethodologyTable(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(extractions.map((e) => [e.study_id, e]));

    const headers = [
      'Study ID',
      'Author(s)',
      'Year',
      'Study Design',
      'Design Details',
      'Methodology Approach',
      'Data Collection Methods',
      'Analysis Methods',
      'Theoretical Framework',
      'Sample Size',
      'Quality/Risk of Bias',
    ];

    const rows = studies.map((study) => {
      const ext = extractionMap.get(study.study_id);
      return [
        study.study_id,
        this.escapeCsv(study.authors[0] + ' et al.'),
        study.year,
        this.escapeCsv(ext?.design),
        this.escapeCsv(ext?.design_details),
        this.escapeCsv(ext?.methodology_approach),
        this.escapeCsv(this.arrayToString(ext?.data_collection_methods)),
        this.escapeCsv(this.arrayToString(ext?.analysis_methods)),
        this.escapeCsv(ext?.theoretical_framework),
        this.escapeCsv(ext?.sample_size),
        this.escapeCsv(ext?.risk_of_bias),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Table 3: Intervention/Concept Characteristics
   * For intervention or concept-focused scoping reviews
   */
  async generateInterventionTable(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(extractions.map((e) => [e.study_id, e]));

    const headers = [
      'Study ID',
      'Author(s)',
      'Year',
      'Intervention/Concept',
      'Type',
      'Duration',
      'Intensity',
      'Delivery Method',
      'Comparator',
      'Setting',
      'Population',
    ];

    const rows = studies.map((study) => {
      const ext = extractionMap.get(study.study_id);
      return [
        study.study_id,
        this.escapeCsv(study.authors[0] + ' et al.'),
        study.year,
        this.escapeCsv(ext?.intervention_or_concept),
        this.escapeCsv(ext?.intervention_type),
        this.escapeCsv(ext?.intervention_duration),
        this.escapeCsv(ext?.intervention_intensity),
        this.escapeCsv(ext?.intervention_delivery),
        this.escapeCsv(ext?.comparators),
        this.escapeCsv(ext?.setting_type),
        this.escapeCsv(ext?.population_details),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Table 4: Outcomes and Findings
   * Comprehensive outcomes table
   */
  async generateOutcomesTable(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(extractions.map((e) => [e.study_id, e]));

    const headers = [
      'Study ID',
      'Author(s)',
      'Year',
      'Primary Outcomes',
      'Secondary Outcomes',
      'Measurement Instruments',
      'Timepoints',
      'Key Findings',
      'Effect Sizes',
      'Statistical Significance',
    ];

    const rows = studies.map((study) => {
      const ext = extractionMap.get(study.study_id);
      return [
        study.study_id,
        this.escapeCsv(study.authors[0] + ' et al.'),
        study.year,
        this.escapeCsv(this.arrayToString(ext?.primary_outcomes)),
        this.escapeCsv(this.arrayToString(ext?.secondary_outcomes)),
        this.escapeCsv(this.arrayToString(ext?.measures)),
        this.escapeCsv(this.arrayToString(ext?.measurement_timepoints)),
        this.escapeCsv(this.arrayToString(ext?.key_findings)),
        this.escapeCsv(this.arrayToString(ext?.effect_sizes)),
        this.escapeCsv(ext?.statistical_significance),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Table 5: Evidence Map - Study Distribution
   * Matrix showing study distribution across key dimensions
   */
  async generateEvidenceMapTable(
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    // Create matrix of design x setting type
    const matrix: Record<string, Record<string, number>> = {};

    extractions.forEach((ext) => {
      const design = ext.design || 'Not reported';
      const settingType = ext.setting_type || 'Not reported';

      if (!matrix[design]) {
        matrix[design] = {};
      }
      matrix[design][settingType] = (matrix[design][settingType] || 0) + 1;
    });

    // Get all unique setting types
    const settingTypes = Array.from(
      new Set(extractions.map((e) => e.setting_type || 'Not reported'))
    ).sort();

    const headers = ['Study Design', ...settingTypes, 'Total'];

    const rows = Object.entries(matrix)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([design, settings]) => {
        const settingCounts = settingTypes.map((st) => settings[st] || 0);
        const total = settingCounts.reduce((a, b) => a + b, 0);
        return [design, ...settingCounts, total];
      });

    // Add totals row
    const columnTotals = settingTypes.map((st) =>
      Object.values(matrix).reduce((sum, settings) => sum + (settings[st] || 0), 0)
    );
    const grandTotal = columnTotals.reduce((a, b) => a + b, 0);
    rows.push(['TOTAL', ...columnTotals, grandTotal]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Table 6: Geographic Distribution
   * Countries and regions represented
   */
  async generateGeographicTable(
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const geographicData: Record<string, { countries: Set<string>; count: number }> = {};

    extractions.forEach((ext) => {
      const region = ext.region || 'Not reported';
      const country = ext.country || 'Not reported';

      if (!geographicData[region]) {
        geographicData[region] = { countries: new Set(), count: 0 };
      }
      geographicData[region].countries.add(country);
      geographicData[region].count++;
    });

    const headers = ['Region', 'Countries', 'Number of Studies', 'Income Level Distribution'];

    const rows = Object.entries(geographicData)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([region, data]) => {
        // Get income level distribution for this region
        const regionExtractions = extractions.filter((e) => (e.region || 'Not reported') === region);
        const incomeLevels = regionExtractions
          .map((e) => e.income_level)
          .filter(Boolean)
          .reduce((acc: Record<string, number>, level) => {
            acc[level!] = (acc[level!] || 0) + 1;
            return acc;
          }, {});

        const incomeStr = Object.entries(incomeLevels)
          .map(([level, count]) => `${level}:${count}`)
          .join('; ');

        return [
          region,
          Array.from(data.countries).join('; '),
          data.count,
          incomeStr || 'Not reported',
        ];
      });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Table 7: Gaps and Future Research
   * Synthesis of limitations and future research needs
   */
  async generateGapsTable(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(extractions.map((e) => [e.study_id, e]));

    const headers = [
      'Study ID',
      'Author(s)',
      'Year',
      'Study Limitations',
      'Future Research Suggestions',
      'Unclear/Missing Data Items',
    ];

    const rows = studies.map((study) => {
      const ext = extractionMap.get(study.study_id);
      return [
        study.study_id,
        this.escapeCsv(study.authors[0] + ' et al.'),
        study.year,
        this.escapeCsv(this.arrayToString(ext?.study_limitations)),
        this.escapeCsv(this.arrayToString(ext?.future_research_suggestions)),
        this.escapeCsv(this.arrayToString(ext?.unclear_items)),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Table 8: Funding and Quality
   * Funding sources and quality indicators
   */
  async generateFundingQualityTable(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(extractions.map((e) => [e.study_id, e]));

    const headers = [
      'Study ID',
      'Author(s)',
      'Year',
      'Funding Source',
      'Funding Type',
      'Conflicts of Interest',
      'Risk of Bias',
      'Data Completeness',
      'Extraction Confidence',
    ];

    const rows = studies.map((study) => {
      const ext = extractionMap.get(study.study_id);
      return [
        study.study_id,
        this.escapeCsv(study.authors[0] + ' et al.'),
        study.year,
        this.escapeCsv(ext?.funding_source),
        this.escapeCsv(ext?.funding_type),
        this.escapeCsv(ext?.conflicts_of_interest),
        this.escapeCsv(ext?.risk_of_bias),
        this.escapeCsv(ext?.data_completeness),
        this.escapeCsv(ext?.extraction_confidence),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate Complete Extraction Dataset
   * All extracted data in one comprehensive table
   */
  async generateCompleteDataset(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const extractionMap = new Map(extractions.map((e) => [e.study_id, e]));

    const headers = [
      'Study_ID',
      'Authors',
      'Year',
      'Title',
      'Journal',
      'DOI',
      'Publication_Type',
      'Design',
      'Design_Details',
      'Methodology_Approach',
      'Data_Collection_Methods',
      'Analysis_Methods',
      'Theoretical_Framework',
      'Setting',
      'Setting_Type',
      'Country',
      'Region',
      'Income_Level',
      'Population_Details',
      'Sample_Size',
      'Participant_Characteristics',
      'Inclusion_Criteria',
      'Exclusion_Criteria',
      'Intervention_Concept',
      'Intervention_Type',
      'Intervention_Duration',
      'Intervention_Intensity',
      'Intervention_Delivery',
      'Comparators',
      'Outcomes_All',
      'Primary_Outcomes',
      'Secondary_Outcomes',
      'Measures',
      'Measurement_Timepoints',
      'Timeframe',
      'Key_Findings',
      'Effect_Sizes',
      'Statistical_Significance',
      'Funding_Source',
      'Funding_Type',
      'Conflicts_of_Interest',
      'Study_Limitations',
      'Risk_of_Bias',
      'Quality_Score',
      'Recommendations',
      'Future_Research',
      'Data_Completeness',
      'Extraction_Confidence',
    ];

    const rows = studies.map((study) => {
      const ext = extractionMap.get(study.study_id);
      return [
        study.study_id,
        this.escapeCsv(study.authors.join('; ')),
        study.year,
        this.escapeCsv(study.title),
        this.escapeCsv(study.journal),
        this.escapeCsv(study.doi),
        this.escapeCsv(ext?.publication_type),
        this.escapeCsv(ext?.design),
        this.escapeCsv(ext?.design_details),
        this.escapeCsv(ext?.methodology_approach),
        this.escapeCsv(this.arrayToString(ext?.data_collection_methods)),
        this.escapeCsv(this.arrayToString(ext?.analysis_methods)),
        this.escapeCsv(ext?.theoretical_framework),
        this.escapeCsv(ext?.setting),
        this.escapeCsv(ext?.setting_type),
        this.escapeCsv(ext?.country),
        this.escapeCsv(ext?.region),
        this.escapeCsv(ext?.income_level),
        this.escapeCsv(ext?.population_details),
        this.escapeCsv(ext?.sample_size),
        this.escapeCsv(this.arrayToString(ext?.participant_characteristics)),
        this.escapeCsv(ext?.inclusion_criteria_reported),
        this.escapeCsv(ext?.exclusion_criteria_reported),
        this.escapeCsv(ext?.intervention_or_concept),
        this.escapeCsv(ext?.intervention_type),
        this.escapeCsv(ext?.intervention_duration),
        this.escapeCsv(ext?.intervention_intensity),
        this.escapeCsv(ext?.intervention_delivery),
        this.escapeCsv(ext?.comparators),
        this.escapeCsv(this.arrayToString(ext?.outcomes)),
        this.escapeCsv(this.arrayToString(ext?.primary_outcomes)),
        this.escapeCsv(this.arrayToString(ext?.secondary_outcomes)),
        this.escapeCsv(this.arrayToString(ext?.measures)),
        this.escapeCsv(this.arrayToString(ext?.measurement_timepoints)),
        this.escapeCsv(ext?.timeframe),
        this.escapeCsv(this.arrayToString(ext?.key_findings)),
        this.escapeCsv(this.arrayToString(ext?.effect_sizes)),
        this.escapeCsv(ext?.statistical_significance),
        this.escapeCsv(ext?.funding_source),
        this.escapeCsv(ext?.funding_type),
        this.escapeCsv(ext?.conflicts_of_interest),
        this.escapeCsv(this.arrayToString(ext?.study_limitations)),
        this.escapeCsv(ext?.risk_of_bias),
        this.escapeCsv(ext?.quality_score),
        this.escapeCsv(this.arrayToString(ext?.recommendations)),
        this.escapeCsv(this.arrayToString(ext?.future_research_suggestions)),
        this.escapeCsv(ext?.data_completeness),
        this.escapeCsv(ext?.extraction_confidence),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    return outputPath;
  }

  /**
   * Generate all extraction tables at once
   */
  async generateAllTables(
    studies: Study[],
    extractions: ExtractionRecord[],
    outputDir: string
  ): Promise<Record<string, string>> {
    const tables: Record<string, string> = {};

    console.log('📊 Generating extraction tables...');

    tables.study_characteristics = await this.generateStudyCharacteristicsTable(
      studies,
      extractions,
      path.join(outputDir, 'table1_study_characteristics.csv')
    );

    tables.methodology = await this.generateMethodologyTable(
      studies,
      extractions,
      path.join(outputDir, 'table2_methodology.csv')
    );

    tables.intervention = await this.generateInterventionTable(
      studies,
      extractions,
      path.join(outputDir, 'table3_interventions.csv')
    );

    tables.outcomes = await this.generateOutcomesTable(
      studies,
      extractions,
      path.join(outputDir, 'table4_outcomes.csv')
    );

    tables.evidence_map = await this.generateEvidenceMapTable(
      extractions,
      path.join(outputDir, 'table5_evidence_map.csv')
    );

    tables.geographic = await this.generateGeographicTable(
      extractions,
      path.join(outputDir, 'table6_geographic.csv')
    );

    tables.gaps = await this.generateGapsTable(
      studies,
      extractions,
      path.join(outputDir, 'table7_gaps_future_research.csv')
    );

    tables.funding_quality = await this.generateFundingQualityTable(
      studies,
      extractions,
      path.join(outputDir, 'table8_funding_quality.csv')
    );

    tables.complete_dataset = await this.generateCompleteDataset(
      studies,
      extractions,
      path.join(outputDir, 'complete_extraction_dataset.csv')
    );

    console.log(`✅ Generated ${Object.keys(tables).length} extraction tables`);
    return tables;
  }
}
