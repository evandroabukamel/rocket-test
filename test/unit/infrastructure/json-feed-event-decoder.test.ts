import { describe, expect, it } from 'vitest';
import { JsonFeedEventDecoder } from '../../../src/infrastructure/feed/JsonFeedEventDecoder';

const decoder = new JsonFeedEventDecoder();

describe('JsonFeedEventDecoder (formato do fio → domínio)', () => {
  it('decodifica cobrança com amount em bigint', () => {
    expect(
      decoder.decode({ id: 3, kind: 'charge', operator: 'delta', reference: 'C', amount: '25000000000000000000', currency: 'ETH' }),
    ).toEqual({
      ok: true,
      event: { id: 3, kind: 'charge', operator: 'delta', reference: 'C', amount: 25n * 10n ** 18n, currency: 'ETH' },
    });
  });

  it('decodifica estorno', () => {
    expect(decoder.decode({ id: 4, kind: 'refund', operator: 'aurora', reference: 'A', amount: '500', currency: 'BRL' })).toEqual({
      ok: true,
      event: { id: 4, kind: 'refund', operator: 'aurora', reference: 'A', amount: 500n, currency: 'BRL' },
    });
  });

  it('decodifica anulação (voids_id → voidsId)', () => {
    expect(decoder.decode({ id: 11, kind: 'void', voids_id: 8 })).toEqual({
      ok: true,
      event: { id: 11, kind: 'void', voidsId: 8 },
    });
  });

  it('ignora campos desconhecidos (motor mais novo que o leitor)', () => {
    const result = decoder.decode({
      id: 1,
      kind: 'charge',
      operator: 'aurora',
      reference: 'A',
      amount: '500',
      currency: 'BRL',
      table_id: 'T-9',
    });
    expect(result).toEqual({
      ok: true,
      event: { id: 1, kind: 'charge', operator: 'aurora', reference: 'A', amount: 500n, currency: 'BRL' },
    });
  });

  const valid = { id: 1, kind: 'charge', operator: 'aurora', reference: 'A', amount: '500', currency: 'BRL' };

  it.each([
    ['amount como number', { ...valid, amount: 500 }],
    ['amount zero', { ...valid, amount: '0' }],
    ['amount decimal', { ...valid, amount: '5.00' }],
    ['moeda desconhecida', { ...valid, currency: 'DOGE' }],
    ['kind desconhecido', { ...valid, kind: 'bonus' }],
    ['sem operator', { ...valid, operator: undefined }],
    ['operator vazio', { ...valid, operator: '' }],
    ['sem reference', { ...valid, reference: undefined }],
    ['anulação sem voids_id', { id: 1, kind: 'void' }],
    ['anulação de si mesma', { id: 1, kind: 'void', voids_id: 1 }],
  ])('rejeita %s, devolvendo o id para o relatório', (_case, raw) => {
    expect(decoder.decode(raw)).toEqual({ ok: false, eventId: 1, reason: expect.any(String) });
  });

  it.each([
    ['não é objeto', 'charge'],
    ['null', null],
    ['array', [1]],
    ['sem id', { ...valid, id: undefined }],
    ['id texto', { ...valid, id: '1' }],
    ['id negativo', { ...valid, id: -1 }],
    ['id fracionário', { ...valid, id: 1.5 }],
    ['id acima do inteiro seguro', { ...valid, id: 2 ** 53 }],
  ])('rejeita %s sem id legível', (_case, raw) => {
    expect(decoder.decode(raw)).toEqual({ ok: false, eventId: null, reason: expect.any(String) });
  });
});
