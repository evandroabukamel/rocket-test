import { describe, expect, it } from 'vitest';
import { InvalidTermsConfigError, termsFromJson } from '../../../src/infrastructure/config/termsFromJson';
import { charge } from '../../support/builders';
import { exampleContracts, examplePrices } from '../../support/fixtures';

describe('termsFromJson (tabelas do enunciado → catálogo)', () => {
  it('monta o catálogo a partir dos arquivos de exemplo', () => {
    const terms = termsFromJson(exampleContracts(), examplePrices());
    expect(terms.termsFor(charge(8, 'delta', 'X', 1n, 'BRL')).bps).toBe(2000);
    expect(String(terms.termsFor(charge(12, 'aurora', 'G', 1n, 'ETH')).price)).toBe('19000.00');
  });

  it.each([
    ['bps acima de 10000', [{ operator: 'aurora', from_id: 1, engine_bps: 10_001 }], []],
    ['bps fracionário', [{ operator: 'aurora', from_id: 1, engine_bps: 15.5 }], []],
    ['from_id ausente', [{ operator: 'aurora', engine_bps: 1500 }], []],
    ['from_id repetido', [
      { operator: 'aurora', from_id: 1, engine_bps: 1500 },
      { operator: 'aurora', from_id: 1, engine_bps: 1000 },
    ], []],
    ['cotação como number', [], [{ currency: 'ETH', from_id: 1, brl: 20000 }]],
    ['cotação negativa', [], [{ currency: 'ETH', from_id: 1, brl: '-1.00' }]],
    ['moeda desconhecida', [], [{ currency: 'DOGE', from_id: 1, brl: '1.00' }]],
    ['cotação para FUN', [], [{ currency: 'FUN', from_id: 1, brl: '1.00' }]],
    ['não é lista', {}, []],
  ])('configuração inválida falha na inicialização: %s', (_case, contracts, prices) => {
    expect(() => termsFromJson(contracts, prices)).toThrow(InvalidTermsConfigError);
  });
});
