import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  systemOutputSchema,
  validateScenarioSet,
} from '../lib/evaluation/dm-quality';
import { z } from 'zod';

const read = (flag: string) => {
  const index = process.argv.indexOf(flag);
  if (index < 0 || !process.argv[index + 1])
    throw new Error(`${flag} is required`);
  return process.argv[index + 1];
};
const baseline = z
  .array(systemOutputSchema)
  .parse(JSON.parse(fs.readFileSync(read('--baseline'), 'utf8')));
const candidate = z
  .array(systemOutputSchema)
  .parse(JSON.parse(fs.readFileSync(read('--candidate'), 'utf8')));
const scenarios = validateScenarioSet(
  JSON.parse(fs.readFileSync(read('--scenarios'), 'utf8')),
);
const salt = read('--salt');
const outputPath = read('--output');
const mappingPath = read('--mapping');
const candidateById = new Map(candidate.map((row) => [row.scenarioId, row]));
const scenarioById = new Map(scenarios.map((row) => [row.id, row]));
const mappings: Array<{
  scenarioId: string;
  variantA: 'baseline' | 'candidate';
}> = [];
const bundle = baseline.map((baselineRow) => {
  const candidateRow = candidateById.get(baselineRow.scenarioId);
  const scenario = scenarioById.get(baselineRow.scenarioId);
  if (!candidateRow)
    throw new Error(`Missing candidate output for ${baselineRow.scenarioId}`);
  if (!scenario) throw new Error(`Missing scenario ${baselineRow.scenarioId}`);
  const variantA =
    crypto
      .createHash('sha256')
      .update(`${salt}:${baselineRow.scenarioId}`)
      .digest()[0] %
      2 ===
    0
      ? ('baseline' as const)
      : ('candidate' as const);
  mappings.push({ scenarioId: baselineRow.scenarioId, variantA });
  return {
    scenarioId: baselineRow.scenarioId,
    locale: scenario.locale,
    input: scenario.input,
    variantA: (variantA === 'baseline' ? baselineRow : candidateRow).response,
    variantB: (variantA === 'baseline' ? candidateRow : baselineRow).response,
  };
});
fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2));
fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
console.log(
  JSON.stringify(
    { scenarios: bundle.length, outputPath, mappingPath },
    null,
    2,
  ),
);
