import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readData(name: string): unknown {
  const path = fileURLToPath(new URL(`../../data/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const examplePages = (): unknown[][] => readData('pages.json') as unknown[][];
export const exampleContracts = (): unknown => readData('contracts.json');
export const examplePrices = (): unknown => readData('prices.json');
export const expectedReport = (): Record<string, unknown> => readData('expected-report.json') as Record<string, unknown>;
