import fs from 'node:fs';
import { z } from 'zod';
import {
  blindMappingSchema,
  blindRatingSchema,
  evaluateDmQuality,
  systemOutputSchema,
  validateScenarioSet,
} from '../lib/evaluation/dm-quality';

const readJson = (flag: string) => {
  const index = process.argv.indexOf(flag);
  if (index < 0 || !process.argv[index + 1])
    throw new Error(`${flag} is required`);
  return JSON.parse(fs.readFileSync(process.argv[index + 1], 'utf8'));
};
const report = evaluateDmQuality({
  scenarios: validateScenarioSet(readJson('--scenarios')),
  baseline: z
    .array(systemOutputSchema)
    .length(120)
    .parse(readJson('--baseline')),
  candidate: z
    .array(systemOutputSchema)
    .length(120)
    .parse(readJson('--candidate')),
  mappings: z
    .array(blindMappingSchema)
    .length(120)
    .parse(readJson('--mapping')),
  ratings: z.array(blindRatingSchema).length(120).parse(readJson('--ratings')),
});
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
