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

### 1. Anulação três meses depois

O livro indexa os eventos por id e por inscrição. Uma anulação recalcula só a inscrição do alvo,
com custo proporcional aos eventos dela (normalmente 1 a 3), e os totais recebem a diferença.
Não há reprocessamento do feed. Para isso funcionar em produção, os eventos de cada inscrição
precisam ficar guardados (num banco, indexados por id) enquanto uma anulação ainda puder chegar.
O relatório de um mês fechado e enviado não é reescrito: período fechado é imutável. A mudança
entra como **ajuste no período aberto**, com referência à competência original e ao evento anulado.
Isso exige registrar cada diferença de inscrição com duas datas: quando aconteceu (competência) e
quando o livro ficou sabendo (reconhecimento). Reemitir o mês antigo é decisão do financeiro; o
livro entrega as duas visões.

### 2. Ids vistos crescem sem parar

Dá para guardar menos, em camadas:
- conteúdo completo só para inscrições ainda abertas (que podem receber estorno ou anulação);
- para as encerradas, só o resultado final;
- para saber se um id já foi visto, como os ids são crescentes: guardar o cursor e a lista de
  buracos (ids pulados). Todo id até o cursor que não está na lista já foi visto. Buraco mais velho
  que um prazo combinado com o motor é descartado;
- para separar repetição de conflito, um hash do conteúdo só dos ids dentro desse prazo.

Guardando **só o cursor**, perde-se quase tudo o que a regra 5 protege: um evento repetido abaixo
do cursor é descartado sem checar conteúdo, e um conflito passa em silêncio. Um id menor que chegue
atrasado (os ids podem pular números) é perdido. E a anulação precisa do conteúdo do alvo para
saber qual inscrição recalcular. Só o cursor serve se o motor garantir, por contrato, que só reenvia
a partir do cursor e nunca muda um evento publicado.

### 3. Cotação do ETH errada por 40 minutos

Os valores em wei estão certos; só a consolidação em reais está errada. Pela regra 3, essas
inscrições ficaram presas à cotação errada, então corrigir exige uma exceção explícita à regra.
O que eu faria:
- **evitar**: rejeitar ou segurar cotações com variação acima de um limite em relação à anterior,
  e alertar;
- **corrigir**: a tabela de cotações é versionada; publica-se uma correção para aquela janela de
  `from_id`, sem apagar a original, e recalculam-se só as inscrições com cobrança na janela (com um
  índice de id da cobrança → inscrição); as diferenças entram como ajuste (pergunta 1);
- marcar essas inscrições como "cotação em revisão" até a decisão.

Quem decide é o financeiro, conforme o que o contrato com o operador disser sobre
a fonte de cotação. A engenharia dá a ferramenta e a trilha de auditoria, e nunca corrige em silêncio.

### 4. 50 operadores e 10 milhões de eventos por mês

Nenhuma regra da seção 3 cruza operadores: tudo é por inscrição (operador + reference) ou por
operador. Então a divisão natural é **por operador**. O melhor caminho é o motor oferecer um feed
por operador, com cursor próprio. Se o feed continuar único, um roteador lê e distribui por operador
(como uma chave de partição). Dois cuidados:
- a anulação não traz o operador; o roteador precisa de um índice id → operador, e segura anulações
  cujo alvo ainda não viu;
- o conflito de um id que mudou de operador só é visível no roteador, então a regra 5 também é
  checada lá.

Cada partição tem seu snapshot; o cursor global confirmado é o menor entre as partições. Vale dizer:
10 milhões por mês são cerca de 4 eventos por segundo, e um processo dá conta da CPU. O gargalo real
é o estado e o tempo de restauração, não o processamento.

### 5. Campo novo no evento, sem combinar deploy

A regra é: mudança só aditiva, com campo opcional, e sem mudar o significado dos campos existentes.
- **Motor sobe antes**: o leitor antigo ignora campos desconhecidos (o decoder já faz isso) e a
  comparação da regra 5 usa só os campos conhecidos, então nada vira conflito.
- **Operador sobe antes**: o leitor novo trata o campo como opcional, com um valor padrão, porque
  os eventos continuam chegando sem ele.
- **No meio da troca**: o mesmo id pode chegar sem o campo e depois com o campo. "Ausente" tem de
  valer como "desconhecido", não como conteúdo diferente; senão a troca gera conflitos falsos.

Se o significado mudar, é outro `kind` ou outra versão da rota, rodando em paralelo. Testes de
contrato entre motor e leitor no CI pegam a quebra antes do deploy.

### 6. Inscrição reenviada, dois pedidos em instâncias diferentes

O operador manda uma chave de idempotência (o id do pedido dele). O motor tem uma restrição de
unicidade no banco em (operador, chave), e outra em (torneio, jogador) para o assento. A inscrição,
a cobrança e o assento são gravados na mesma transação. As duas instâncias tentam inserir; o banco
deixa uma só passar. A outra recebe a violação de unicidade, lê o registro existente e devolve
**a mesma resposta** da primeira (mesmo id de inscrição e mesmo corpo, com um indicador de que é
repetição). Se a primeira ainda estiver em andamento, a segunda responde "em processamento, tente de
novo" com a mesma chave. Mesma chave com conteúdo diferente é erro (o equivalente da regra 5). A chave
também vai para a carteira, para o débito ser idempotente. Um lock distribuído pode ajudar no
desempenho, mas quem garante é a restrição do banco.
