/**
 * State management and persistence for AUTOSCOPE
 * Handles reading/writing the global state to disk
 */

import { promises as fs } from 'fs';
import path from 'path';
import { GlobalState, GlobalStateSchema } from './schemas.js';

export class StateStore {
  private statePath: string;
  private state: GlobalState | null = null;

  constructor(runId: string, outputsDir: string = 'outputs') {
    this.statePath = path.join(outputsDir, runId, 'state.json');
  }

  /**
   * Initialize a new state
   */
  async init(config: any, runId: string): Promise<GlobalState> {
    const now = new Date().toISOString();
    this.state = {
      run_id: runId,
      config,
      criteria: null,
      prospero_protocol: null,
      studies: [],
      prisma_counts: {
        identified: 0,
        deduplicated: 0,
        title_abstract_screened: 0,
        abstract_excluded: 0,
        fulltext_retrieved: 0,
        fulltext_excluded: [],
        included: 0,
      },
      abstract_decisions: [],
      abstract_consensus: [],
      fulltext_decisions: [],
      fulltext_consensus: [],
      extractions: [],
      pdf_fetch_results: [],
      missing_pdfs: [],
      current_stage: 'init',
      created_at: now,
      updated_at: now,
    };
    await this.save();
    return this.state;
  }

  /**
   * Load state from disk
   */
  async load(): Promise<GlobalState> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.state = GlobalStateSchema.parse(parsed);
      return this.state;
    } catch (error) {
      throw new Error(
        `Failed to load state from ${this.statePath}: ${error}`
      );
    }
  }

  /**
   * Save current state to disk
   */
  async save(): Promise<void> {
    if (!this.state) {
      throw new Error('No state to save');
    }

    // Update timestamp
    this.state.updated_at = new Date().toISOString();

    // Ensure directory exists
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });

    // Validate before saving
    GlobalStateSchema.parse(this.state);

    // Write to disk
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  /**
   * Get current state (read-only)
   */
  getState(): GlobalState {
    if (!this.state) {
      throw new Error('State not initialized');
    }
    return this.state;
  }

  /**
   * Update state (partial update)
   */
  async update(updates: Partial<GlobalState>): Promise<void> {
    if (!this.state) {
      throw new Error('State not initialized');
    }

    this.state = {
      ...this.state,
      ...updates,
    };

    await this.save();
  }

  /**
   * Append to an array in state
   */
  async append<K extends keyof GlobalState>(
    key: K,
    items: GlobalState[K] extends Array<infer T> ? T | T[] : never
  ): Promise<void> {
    if (!this.state) {
      throw new Error('State not initialized');
    }

    const current = this.state[key];
    if (!Array.isArray(current)) {
      throw new Error(`${String(key)} is not an array`);
    }

    const itemsArray = Array.isArray(items) ? items : [items];
    (this.state[key] as any[]) = [...current, ...itemsArray];

    await this.save();
  }

  /**
   * Export state to a specific file
   */
  async exportTo(filePath: string): Promise<void> {
    if (!this.state) {
      throw new Error('No state to export');
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(this.state, null, 2));
  }

  /**
   * Create audit log entry
   */
  async appendAuditLog(
    entry: Record<string, any>,
    logPath?: string
  ): Promise<void> {
    const auditPath =
      logPath || path.join(path.dirname(this.statePath), 'audit_log.jsonl');
    await fs.mkdir(path.dirname(auditPath), { recursive: true });
    await fs.appendFile(auditPath, JSON.stringify(entry) + '\n');
  }
}

/**
 * Helper to create a unique run ID
 */
export function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `run-${timestamp}-${random}`;
}
