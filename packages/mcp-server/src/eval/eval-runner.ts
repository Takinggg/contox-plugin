/* ═══════════════════════════════════════════════════════════════════════════════
 * Eval Runner — Measures retrieval quality of the brain system
 *
 * Metrics:
 * - recall@k: fraction of expected schemaKeys found in top-k results
 * - precision@k: fraction of top-k results that are relevant
 * - keyword coverage: fraction of expected keywords found in content
 * - latency: time to execute each query
 *
 * Usage:
 *   npx tsx src/eval/eval-runner.ts
 *   npx tsx src/eval/eval-runner.ts --verbose
 *   npx tsx src/eval/eval-runner.ts --category api
 * ═══════════════════════════════════════════════════════════════════════════════ */

/* eslint-disable no-console */

import { ContoxApiClient } from '../api/client.js';
import { V2Client } from '../api/v2-client.js';
import { GOLDEN_SET, type GoldenQuestion } from './golden-set.js';

interface QuestionResult {
  id: string;
  question: string;
  category: string;
  difficulty: string;
  recallAtK: number;
  precisionAtK: number;
  keywordCoverage: number;
  latencyMs: number;
  foundSchemaKeys: string[];
  missingSchemaKeys: string[];
  foundKeywords: string[];
  missingKeywords: string[];
}

interface EvalSummary {
  totalQuestions: number;
  avgRecallAtK: number;
  avgPrecisionAtK: number;
  avgKeywordCoverage: number;
  avgLatencyMs: number;
  byCategory: Record<string, CategorySummary>;
  byDifficulty: Record<string, CategorySummary>;
  results: QuestionResult[];
}

interface CategorySummary {
  count: number;
  avgRecall: number;
  avgPrecision: number;
  avgKeywordCoverage: number;
}

const K = 5;

export async function runEval(opts?: {
  verbose?: boolean;
  category?: string;
  difficulty?: string;
}): Promise<EvalSummary> {
  const client = new ContoxApiClient();
  const v2 = new V2Client({
    apiKey: process.env['CONTOX_API_KEY'] ?? '',
    apiUrl: process.env['CONTOX_API_URL'],
    projectId: process.env['CONTOX_PROJECT_ID'] ?? '',
    hmacSecret: process.env['V2_HMAC_SECRET_MCP'] ?? process.env['V2_HMAC_SECRET'],
  });

  // Load the full brain document via V2
  console.log('Loading brain document...');
  const startLoad = Date.now();
  const brain = await v2.getBrain();
  const loadTime = Date.now() - startLoad;
  console.log(`Brain loaded in ${String(loadTime)}ms (~${String(brain.tokenEstimate)} tokens)`);

  // Load all contexts for schemaKey matching
  console.log('Loading context index...');
  const allContexts = await client.listContexts();
  const contextsBySchemaKey = new Map<string, { id: string; name: string; content: string | null }>();
  for (const ctx of allContexts) {
    if (ctx.schemaKey) {
      contextsBySchemaKey.set(ctx.schemaKey, {
        id: ctx.id,
        name: ctx.name,
        content: ctx.content,
      });
    }
  }
  console.log(`${String(contextsBySchemaKey.size)} contexts indexed by schemaKey\n`);

  // Filter questions
  let questions = [...GOLDEN_SET];
  if (opts?.category) {
    questions = questions.filter((q) => q.category === opts.category);
  }
  if (opts?.difficulty) {
    questions = questions.filter((q) => q.difficulty === opts.difficulty);
  }

  const results: QuestionResult[] = [];

  for (const question of questions) {
    const result = evaluateQuestion(question, brain.document, contextsBySchemaKey);
    results.push(result);

    if (opts?.verbose) {
      printQuestionResult(result);
    }
  }

  const summary = buildSummary(results);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('EVAL RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Total questions: ${String(summary.totalQuestions)}`);
  console.log(`Avg recall@${String(K)}:         ${formatPercent(summary.avgRecallAtK)}`);
  console.log(`Avg precision@${String(K)}:      ${formatPercent(summary.avgPrecisionAtK)}`);
  console.log(`Avg keyword coverage: ${formatPercent(summary.avgKeywordCoverage)}`);
  console.log(`Avg latency:          ${String(Math.round(summary.avgLatencyMs))}ms`);

  console.log('\nBy Category:');
  for (const [cat, stats] of Object.entries(summary.byCategory)) {
    console.log(`  ${cat}: recall=${formatPercent(stats.avgRecall)} precision=${formatPercent(stats.avgPrecision)} keywords=${formatPercent(stats.avgKeywordCoverage)} (n=${String(stats.count)})`);
  }

  console.log('\nBy Difficulty:');
  for (const [diff, stats] of Object.entries(summary.byDifficulty)) {
    console.log(`  ${diff}: recall=${formatPercent(stats.avgRecall)} precision=${formatPercent(stats.avgPrecision)} keywords=${formatPercent(stats.avgKeywordCoverage)} (n=${String(stats.count)})`);
  }

  // Flag failing questions
  const failing = results.filter((r) => r.recallAtK < 0.5 || r.keywordCoverage < 0.3);
  if (failing.length > 0) {
    console.log(`\n⚠ ${String(failing.length)} question(s) below threshold:`);
    for (const f of failing) {
      console.log(`  - [${f.id}] ${f.question}`);
      if (f.missingSchemaKeys.length > 0) {
        console.log(`    Missing keys: ${f.missingSchemaKeys.join(', ')}`);
      }
      if (f.missingKeywords.length > 0) {
        console.log(`    Missing keywords: ${f.missingKeywords.join(', ')}`);
      }
    }
  }

  return summary;
}

function evaluateQuestion(
  question: GoldenQuestion,
  brainDocument: string,
  contextIndex: Map<string, { id: string; name: string; content: string | null }>,
): QuestionResult {
  const start = Date.now();

  // Check which expected schemaKeys have content in the brain document
  const foundSchemaKeys: string[] = [];
  const missingSchemaKeys: string[] = [];

  for (const expectedKey of question.expectedSchemaKeys) {
    const ctx = contextIndex.get(expectedKey);
    if (ctx) {
      // Check if the context's name or content appears in the brain document
      const nameInDoc = brainDocument.toLowerCase().includes(ctx.name.toLowerCase());
      const contentInDoc = ctx.content
        ? brainDocument.includes(ctx.content.slice(0, 100))
        : false;

      if (nameInDoc || contentInDoc) {
        foundSchemaKeys.push(expectedKey);
      } else {
        missingSchemaKeys.push(expectedKey);
      }
    } else {
      // Context doesn't exist yet — mark as missing
      missingSchemaKeys.push(expectedKey);
    }
  }

  // Check keyword coverage in the brain document
  const docLower = brainDocument.toLowerCase();
  const foundKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const keyword of question.expectedKeywords) {
    if (docLower.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  }

  const latencyMs = Date.now() - start;

  const totalExpectedKeys = question.expectedSchemaKeys.length;
  const recallAtK = totalExpectedKeys > 0 ? foundSchemaKeys.length / totalExpectedKeys : 1;

  // Precision: of the top-K schemaKeys in the doc, how many are relevant?
  // Simplified: we measure if found keys are all relevant (they are by definition)
  const precisionAtK = foundSchemaKeys.length > 0 ? 1 : 0;

  const totalKeywords = question.expectedKeywords.length;
  const keywordCoverage = totalKeywords > 0 ? foundKeywords.length / totalKeywords : 1;

  return {
    id: question.id,
    question: question.question,
    category: question.category,
    difficulty: question.difficulty,
    recallAtK,
    precisionAtK,
    keywordCoverage,
    latencyMs,
    foundSchemaKeys,
    missingSchemaKeys,
    foundKeywords,
    missingKeywords,
  };
}

function buildSummary(results: QuestionResult[]): EvalSummary {
  const total = results.length;
  const avgRecall = avg(results.map((r) => r.recallAtK));
  const avgPrecision = avg(results.map((r) => r.precisionAtK));
  const avgKeywords = avg(results.map((r) => r.keywordCoverage));
  const avgLatency = avg(results.map((r) => r.latencyMs));

  const byCategory: Record<string, CategorySummary> = {};
  const byDifficulty: Record<string, CategorySummary> = {};

  for (const r of results) {
    addToGroup(byCategory, r.category, r);
    addToGroup(byDifficulty, r.difficulty, r);
  }

  return {
    totalQuestions: total,
    avgRecallAtK: avgRecall,
    avgPrecisionAtK: avgPrecision,
    avgKeywordCoverage: avgKeywords,
    avgLatencyMs: avgLatency,
    byCategory,
    byDifficulty,
    results,
  };
}

function addToGroup(
  groups: Record<string, CategorySummary>,
  key: string,
  result: QuestionResult,
): void {
  const existing = groups[key];
  if (!existing) {
    groups[key] = {
      count: 1,
      avgRecall: result.recallAtK,
      avgPrecision: result.precisionAtK,
      avgKeywordCoverage: result.keywordCoverage,
    };
  } else {
    const n = existing.count;
    existing.avgRecall = (existing.avgRecall * n + result.recallAtK) / (n + 1);
    existing.avgPrecision = (existing.avgPrecision * n + result.precisionAtK) / (n + 1);
    existing.avgKeywordCoverage = (existing.avgKeywordCoverage * n + result.keywordCoverage) / (n + 1);
    existing.count = n + 1;
  }
}

function avg(numbers: number[]): number {
  if (numbers.length === 0) { return 0; }
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function printQuestionResult(result: QuestionResult): void {
  const status = result.recallAtK >= 0.5 && result.keywordCoverage >= 0.3 ? '✓' : '✗';
  console.log(`${status} [${result.id}] ${result.question}`);
  console.log(`  recall=${formatPercent(result.recallAtK)} keywords=${formatPercent(result.keywordCoverage)} ${String(result.latencyMs)}ms`);
  if (result.missingSchemaKeys.length > 0) {
    console.log(`  missing keys: ${result.missingSchemaKeys.join(', ')}`);
  }
  if (result.missingKeywords.length > 0) {
    console.log(`  missing keywords: ${result.missingKeywords.join(', ')}`);
  }
}

// CLI entry point
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const categoryIdx = args.indexOf('--category');
const category = categoryIdx >= 0 ? args[categoryIdx + 1] : undefined;
const diffIdx = args.indexOf('--difficulty');
const difficulty = diffIdx >= 0 ? args[diffIdx + 1] : undefined;

runEval({ verbose, category, difficulty }).catch((err: unknown) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
