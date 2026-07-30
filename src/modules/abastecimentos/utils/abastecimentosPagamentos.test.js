import test from "node:test";
import assert from "node:assert/strict";

import {
  agruparSaidasDeAbastecimentos,
  resumirFormasPagamento,
  resumirOrigensPagamento,
  somarPagamentosDoAbastecimento,
} from "./abastecimentosPagamentos.js";

test("mantém abastecimento antigo com um único pagamento", () => {
  const saida = { id: 1, valor_total: 100, forma_pagamento: "pix" };
  const agrupadas = agruparSaidasDeAbastecimentos(
    [saida],
    [{ id: 9, saida_id: 1 }]
  );

  assert.equal(agrupadas.length, 1);
  assert.equal(agrupadas[0].forma_pagamento, "pix");
  assert.deepEqual(agrupadas[0].pagamentos, [saida]);
});

test("agrupa três pagamentos sem duplicar o abastecimento no extrato", () => {
  const principal = { id: 1, valor_total: 100, forma_pagamento: "pix" };
  const adicional1 = {
    id: 2,
    saida_origem_id: 1,
    valor_total: 120,
    forma_pagamento: "credito_avista",
  };
  const adicional2 = {
    id: 3,
    saida_origem_id: 1,
    valor_total: 100,
    forma_pagamento: "dinheiro",
  };
  const outraSaida = { id: 4, valor_total: 20, forma_pagamento: "pix" };
  const agrupadas = agruparSaidasDeAbastecimentos(
    [principal, adicional1, adicional2, outraSaida],
    [{ id: 9, saida_id: 1 }]
  );

  assert.equal(agrupadas.length, 2);
  assert.equal(agrupadas[0].forma_pagamento, "multiplo");
  assert.equal(agrupadas[0].valor_total, 320);
  assert.equal(agrupadas[0].pagamentos.length, 3);
  assert.equal(somarPagamentosDoAbastecimento(principal, [adicional1, adicional2]), 320);
});

test("resume formas e origens reais no Extrato", () => {
  const pagamentos = [
    { forma_pagamento: "pix", contas: { nome: "NuBank PJ" } },
    { forma_pagamento: "dinheiro", contas: { nome: "Carteira" } },
    { forma_pagamento: "credito_avista", cartoes: { nome: "Itaú Múltiplo PF" } },
    { forma_pagamento: "debito", contas: { nome: "Conta Corrente" } },
  ];

  assert.equal(resumirFormasPagamento(pagamentos), "PIX | Dinheiro | +2");
  assert.equal(resumirOrigensPagamento(pagamentos), "NuBank PJ | Carteira | +2");
});
