# Livro de rake multimoeda

Leitor do feed de rake do lado do operador: recebe páginas de eventos (cobrança, estorno, anulação)
e mantém o livro por operador, por moeda e consolidado em reais.

O exemplo do enunciado (`data/`) chega exatamente nos números esperados; ver
`test/acceptance/example-feed.test.ts`.

## Como rodar

Requer Node 22+.

```bash
npm install
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm start           # roda o exemplo do enunciado (data/) e imprime o relatório
npm start -- pages.json contracts.json prices.json --state state/ledger.json
```

## Arquitetura (Clean Architecture + DDD)

```
src/
  domain/            regras de negócio puras, sem I/O
    money/           Currency, MinorUnits (bigint), DecimalPrice, toBrlCents
    rake/            splitRake (regra 2)
    terms/           EffectiveSchedule, TermsCatalog (contrato + cotação vigentes no id)
    feed/            eventos de domínio, igualdade de conteúdo, chave da inscrição
    ledger/          evaluateInscription, RakeLedger (raiz de agregado), relatório, snapshot
  application/       caso de uso RakeBookService + portas (FeedEventDecoder, SnapshotStore)
  infrastructure/    adaptadores: decoder JSON do fio, tabelas JSON, snapshot em memória/arquivo
  interface/         CLI e apresentação do relatório em JSON
test/
  unit/              uma suíte por módulo, pelo menos um teste por regra
  acceptance/        exemplo do enunciado + queda entre páginas
data/                páginas, contratos, cotações e relatório esperado do enunciado
```

As dependências apontam só para dentro: `interface → application → domain`, e a `infrastructure`
implementa as portas da `application`. O domínio não conhece JSON, arquivo nem formato do fio.

## Como o dinheiro é modelado

- Toda quantia é `bigint` na menor unidade (centavo, micro-USDT, satoshi, wei, ficha). Nunca `number`.
- O texto do feed só é aceito em forma canônica (`"500"`, nunca `"0500"`, `"5.00"` nem `500`).
- A cotação é `DecimalPrice { mantissa: bigint, scale }`. `"5.40"` vira `540 / 10^2`.
- Conversão: `floor(unidades × mantissa × 100 / (10^decimais × 10^scale))`, com um único floor no final.
- **Estado derivado:** cada inscrição (operador + reference) é recalculada a partir dos seus eventos
  vivos. Anular é recalcular sem o evento anulado; os totais recebem só a diferença da inscrição tocada.

## Decisões sobre os casos que as regras não cobrem

| Caso | Decisão | Por quê |
|---|---|---|
| Identidade da inscrição | `operator + reference` | A mesma reference em dois operadores não pode se misturar. |
| Vários estornos e pouco saldo | Aplicados por id crescente; o último entra em parte, o resto vira excesso | É determinístico e bate com o exemplo (o evento 7 aplica 200 e deixa 100 de excesso). |
| Duas cobranças vivas na mesma inscrição | Vale a de menor id; a outra vira anomalia `extra_charge` | Somar cobraria duas vezes; se a primeira for anulada, a segunda passa a valer (regra 8). |
| Estorno em moeda diferente da cobrança | Não é aplicado; anomalia `currency_mismatch` | Converter seria inventar uma cotação. |
| Cobrança sem contrato ou cotação vigente | Não é contabilizada; os estornos ficam pendentes; anomalia `missing_terms` | Sem os termos não dá para prender bps e cotação (regra 3). |
| Anulação antes do alvo | Fica pendente (`pending_voids`); o alvo já nasce anulado | Mesma lógica da regra 7. |
| Anulação de anulação | Rejeitada (`void_targets_void`), inclusive quando a anulação chegou antes do alvo | A rede desfaz transações, não anulações. |
| Anulação de BRL/FUN | Aplicada como qualquer outra | O enunciado fala em reorganização de cadeia, mas o próprio exemplo anula a cobrança 8, em BRL, e espera `voided: [8]`. O feed é a fonte da verdade. |
| Segunda anulação do mesmo alvo | Rejeitada (`void_already_applied`) | Não tem efeito; fica visível no relatório. |
| Evento anulado que reaparece numa página relida | Repetição; continua anulado | A regra 5 vale antes da 8. |
| Linha de moeda zerada | Continua no relatório se houver cobrança efetiva | Bate com o exemplo (aurora BRL = 0). |
| Operador só com FUN | Não aparece em `totals_brl_cents` | Não há nada em reais para mostrar; aparecer com zero sugeriria o contrário. |
| Restauração do snapshot | Reaplica os eventos guardados, na ordem de chegada | O estado derivado sai igual por construção; o custo é O(eventos) na subida (ver pergunta 2). |
| Evento inválido no fio | Vira anomalia `invalid_event`; a página continua; o cursor avança se o id for legível | Um item ruim não pode travar o feed. |
| Campos desconhecidos no evento | Ignorados pelo decoder e fora da comparação da regra 5 | Permite o motor subir antes do leitor (pergunta 5). |
| `totals_brl_cents` na saída | Texto, não number | A soma de um mês pode passar de 2^53. |
| Configuração inválida (bps, cotação, from_id repetido) | Falha na inicialização | É erro de deploy, não do feed. |
| Checkpoint | Snapshot ao fim de cada página | Se cair no meio, a página é relida e a regra 5 absorve as repetições. |

## Respostas da seção 5

_A escrever._
