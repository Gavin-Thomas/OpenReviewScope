/**
 * Chart Generation for Scoping Review Synthesis
 * Creates publication-ready charts
 */

import { ExtractionRecord } from '../state/schemas.js';
import { promises as fs } from 'fs';
import path from 'path';

export class ChartGenerator {
  /**
   * Generate study types distribution bar chart (as SVG)
   */
  async generateStudyTypesChart(
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const designCounts: Record<string, number> = {};

    extractions.forEach((e) => {
      const design = e.design || 'Unknown';
      designCounts[design] = (designCounts[design] || 0) + 1;
    });

    const svg = this.createBarChartSvg(
      'Distribution of Study Designs',
      designCounts
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, svg);
    return outputPath;
  }

  /**
   * Generate geographic distribution chart
   */
  async generateGeographicChart(
    extractions: ExtractionRecord[],
    outputPath: string
  ): Promise<string> {
    const countryCounts: Record<string, number> = {};

    extractions.forEach((e) => {
      const country = e.country || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    const svg = this.createBarChartSvg(
      'Geographic Distribution of Studies',
      countryCounts
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, svg);
    return outputPath;
  }

  /**
   * Generate publication timeline
   */
  async generateTimelineChart(
    studies: Array<{ year: number }>,
    outputPath: string
  ): Promise<string> {
    const yearCounts: Record<string, number> = {};

    studies.forEach((s) => {
      const year = s.year.toString();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });

    const svg = this.createLineChartSvg(
      'Publications Over Time',
      yearCounts
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true});
    await fs.writeFile(outputPath, svg);
    return outputPath;
  }

  /**
   * Create a simple bar chart SVG
   */
  private createBarChartSvg(
    title: string,
    data: Record<string, number>
  ): string {
    const width = 800;
    const height = 500;
    const margin = { top: 60, right: 40, bottom: 100, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const maxValue = Math.max(...entries.map((e) => e[1]));
    const barWidth = chartWidth / entries.length - 10;

    let bars = '';
    entries.forEach(([label, value], i) => {
      const barHeight = (value / maxValue) * chartHeight;
      const x = margin.left + i * (barWidth + 10);
      const y = margin.top + chartHeight - barHeight;

      bars += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"
              fill="#1976d2" stroke="#0d47a1" stroke-width="1"/>
        <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle"
              font-family="Arial" font-size="12" font-weight="bold">${value}</text>
        <text x="${x + barWidth / 2}" y="${margin.top + chartHeight + 20}"
              text-anchor="end" font-family="Arial" font-size="10"
              transform="rotate(-45, ${x + barWidth / 2}, ${margin.top + chartHeight + 20})">
          ${label}
        </text>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>

  <!-- Title -->
  <text x="${width / 2}" y="30" text-anchor="middle"
        font-family="Arial" font-size="18" font-weight="bold">
    ${title}
  </text>

  <!-- Y-axis -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}"
        stroke="#333" stroke-width="2"/>

  <!-- X-axis -->
  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}"
        stroke="#333" stroke-width="2"/>

  <!-- Bars and labels -->
  ${bars}

  <!-- Y-axis label -->
  <text x="20" y="${margin.top + chartHeight / 2}" text-anchor="middle"
        font-family="Arial" font-size="12" font-weight="bold"
        transform="rotate(-90, 20, ${margin.top + chartHeight / 2})">
    Count
  </text>
</svg>`;
  }

  /**
   * Create a simple line chart SVG
   */
  private createLineChartSvg(
    title: string,
    data: Record<string, number>
  ): string {
    const width = 800;
    const height = 400;
    const margin = { top: 60, right: 40, bottom: 60, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const entries = Object.entries(data).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    const maxValue = Math.max(...entries.map((e) => e[1]));
    const stepX = chartWidth / (entries.length - 1 || 1);

    let points = '';
    let labels = '';
    entries.forEach(([year, value], i) => {
      const x = margin.left + i * stepX;
      const y = margin.top + chartHeight - (value / maxValue) * chartHeight;

      points += `${x},${y} `;

      // Labels every few years
      if (i % Math.ceil(entries.length / 10) === 0 || i === entries.length - 1) {
        labels += `<text x="${x}" y="${margin.top + chartHeight + 20}"
                         text-anchor="middle" font-family="Arial" font-size="10">
                   ${year}
                 </text>`;
      }

      // Data points
      labels += `<circle cx="${x}" cy="${y}" r="4" fill="#1976d2"/>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>

  <!-- Title -->
  <text x="${width / 2}" y="30" text-anchor="middle"
        font-family="Arial" font-size="18" font-weight="bold">
    ${title}
  </text>

  <!-- Axes -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}"
        stroke="#333" stroke-width="2"/>
  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}"
        stroke="#333" stroke-width="2"/>

  <!-- Line -->
  <polyline points="${points}" fill="none" stroke="#1976d2" stroke-width="2"/>

  <!-- Points and labels -->
  ${labels}

  <!-- Axis labels -->
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle"
        font-family="Arial" font-size="12" font-weight="bold">
    Year
  </text>
  <text x="20" y="${margin.top + chartHeight / 2}" text-anchor="middle"
        font-family="Arial" font-size="12" font-weight="bold"
        transform="rotate(-90, 20, ${margin.top + chartHeight / 2})">
    Publications
  </text>
</svg>`;
  }

  /**
   * Generate summary statistics
   */
  generateSummaryStats(extractions: ExtractionRecord[]): Record<string, any> {
    const designs: Record<string, number> = {};
    const countries: Record<string, number> = {};
    const outcomes: Record<string, number> = {};

    extractions.forEach((e) => {
      // Design distribution
      const design = e.design || 'Unknown';
      designs[design] = (designs[design] || 0) + 1;

      // Country distribution
      const country = e.country || 'Unknown';
      countries[country] = (countries[country] || 0) + 1;

      // Outcome frequency
      e.outcomes?.forEach((outcome) => {
        outcomes[outcome] = (outcomes[outcome] || 0) + 1;
      });
    });

    return {
      total_studies: extractions.length,
      design_distribution: designs,
      country_distribution: countries,
      outcome_frequency: outcomes,
      studies_with_sample_size: extractions.filter((e) => e.sample_size).length,
      studies_with_timeframe: extractions.filter((e) => e.timeframe).length,
    };
  }
}
