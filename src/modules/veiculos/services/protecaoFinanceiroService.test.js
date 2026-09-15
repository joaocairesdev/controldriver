import test from "node:test";
import assert from "node:assert/strict";

import { gerarAgendaMensalContrato } from "../../contratos/utils/contratosFinanceiros.js";
import {
  montarPlanosCobrancaProtecao,
  salvarProtecaoComContrato,
} from "./protecaoFinanceiroService.js";

const origem = {
  formaPagamento: "boleto",
  contaId: "",
  cartaoId: "",
};

function dadosBase() {
  return {
    tipoProtecao: "seguro",
    nomeProtecao: "Seguro teste",
    inicioVigencia: "2026-09-01",
    fimVigencia: "2027-08-31",
    pagamentoUnico: { valor: 1200, dataPagamento: "2026-09-10", ...origem },
    mensal: {
      valorMensal: 100,
      primeiroVencimento: "2026-09-10",
      dataInicioControleFinanceiro: "2026-09-10",
      ...origem,
    },
    parcelado: { valorTotal: 1200, numeroParcelas: 12, primeiroVencimento: "2026-09-10", ...origem },
    entrada: { valor: 200, dataPagamento: "2026-09-05", formaPagamento: "pix", contaId: "4", cartaoId: "" },
    parcelas: { numeroParcelas: 10, valorParcela: 100, primeiroVencimento: "2026-10-10", ...origem },
  };
}

test("pagamento único gera um plano e uma obrigação", () => {
  const planos = montarPlanosCobrancaProtecao({ ...dadosBase(), formaContratacao: "pagamento_unico" });
  assert.equal(planos.length, 1);
  assert.equal(planos[0].tipoAgendamento, "unica");
  assert.deepEqual(planos[0].parcelas, [{ numero: 1, vencimento: "2026-09-10", valor: 1200 }]);
});

test("mensal reutiliza a recorrência mensal até o fim da vigência", () => {
  const planos = montarPlanosCobrancaProtecao({
    ...dadosBase(),
    fimVigencia: "2028-08-31",
    formaContratacao: "mensal",
  });
  assert.equal(planos[0].tipoAgendamento, "recorrente");
  assert.equal(planos[0].parcelas.length, 24);
  assert.equal(planos[0].parcelas.at(-1).vencimento, "2028-08-10");
});

test("parcelado reutiliza a distribuição do motor de contratos", () => {
  const dados = dadosBase();
  dados.parcelado = { ...dados.parcelado, valorTotal: 100, numeroParcelas: 3 };
  const [plano] = montarPlanosCobrancaProtecao({ ...dados, formaContratacao: "parcelado" });
  assert.deepEqual(plano.parcelas.map((item) => item.valor), [33.33, 33.33, 33.34]);
});

test("entrada e parcelas mantêm planos e origens independentes", () => {
  const planos = montarPlanosCobrancaProtecao({ ...dadosBase(), formaContratacao: "entrada_parcelas" });
  assert.equal(planos.length, 2);
  assert.equal(planos[0].papel, "entrada");
  assert.equal(planos[0].contaPagamentoId, 4);
  assert.equal(planos[1].papel, "saldo");
  assert.equal(planos[1].parcelas.length, 10);
  assert.equal(planos[1].contaPagamentoId, null);
});

test("pagamento único no cartão preserva a origem planejada", () => {
  const dados = dadosBase();
  dados.pagamentoUnico = {
    ...dados.pagamentoUnico,
    formaPagamento: "credito_avista",
    contaId: "4",
    cartaoId: "7",
  };
  const [plano] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "pagamento_unico",
  });

  assert.equal(plano.contaPagamentoId, null);
  assert.equal(plano.cartaoPagamentoId, 7);
});

test("mensal no cartão mantém todas as cobranças no plano do cartão", () => {
  const dados = dadosBase();
  dados.mensal = {
    ...dados.mensal,
    formaPagamento: "credito_avista",
    cartaoId: "7",
  };
  const [plano] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "mensal",
  });

  assert.equal(plano.cartaoPagamentoId, 7);
  assert.equal(plano.parcelas.length, 12);
});

test("parcelado no cartão mantém cada parcela no plano do cartão", () => {
  const dados = dadosBase();
  dados.parcelado = {
    ...dados.parcelado,
    formaPagamento: "credito_avista",
    cartaoId: "7",
  };
  const [plano] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "parcelado",
  });

  assert.equal(plano.cartaoPagamentoId, 7);
  assert.equal(plano.parcelas.length, 12);
});

test("entrada via Pix e parcelas no cartão usam origens independentes", () => {
  const dados = dadosBase();
  dados.parcelas = {
    ...dados.parcelas,
    formaPagamento: "credito_avista",
    cartaoId: "7",
  };
  const [entrada, saldo] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "entrada_parcelas",
  });

  assert.equal(entrada.contaPagamentoId, 4);
  assert.equal(entrada.cartaoPagamentoId, null);
  assert.equal(saldo.contaPagamentoId, null);
  assert.equal(saldo.cartaoPagamentoId, 7);
});

test("entrada no cartão e parcelas fora do cartão usam origens independentes", () => {
  const dados = dadosBase();
  dados.entrada = {
    ...dados.entrada,
    formaPagamento: "credito_avista",
    contaId: "",
    cartaoId: "7",
  };
  dados.parcelas = {
    ...dados.parcelas,
    formaPagamento: "pix",
    contaId: "4",
  };
  const [entrada, saldo] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "entrada_parcelas",
  });

  assert.equal(entrada.contaPagamentoId, null);
  assert.equal(entrada.cartaoPagamentoId, 7);
  assert.equal(saldo.contaPagamentoId, 4);
  assert.equal(saldo.cartaoPagamentoId, null);
});

test("mensal preserva valores individuais no payload e soma o valor total do plano", () => {
  const dados = dadosBase();
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: dados.inicioVigencia,
    fimVigencia: dados.fimVigencia,
    primeiroVencimento: dados.mensal.primeiroVencimento,
    valorPadrao: dados.mensal.valorMensal,
  }).map((parcela, indice) => ({
    ...parcela,
    valor: indice === 0 ? 50 : indice < 3 ? 75 : parcela.valor,
  }));
  dados.mensal = { ...dados.mensal, agenda };

  const [plano] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "mensal",
  });

  assert.deepEqual(plano.parcelas.slice(0, 4).map((item) => item.valor), [50, 75, 75, 100]);
  assert.equal(plano.valorTotal, 1100);
});

test("mensal rejeita agenda adulterada antes da persistência", () => {
  const dados = dadosBase();
  const agenda = gerarAgendaMensalContrato({
    inicioVigencia: dados.inicioVigencia,
    fimVigencia: dados.fimVigencia,
    primeiroVencimento: dados.mensal.primeiroVencimento,
    valorPadrao: dados.mensal.valorMensal,
  });
  agenda[1] = { ...agenda[1], vencimento: "2026-10-11" };
  dados.mensal = { ...dados.mensal, agenda };

  assert.throws(() => montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "mensal",
  }), /parcela inválida/);
});

test("mensal exige início de controle correspondente à agenda", () => {
  const dados = dadosBase();
  dados.mensal.dataInicioControleFinanceiro = "2026-09-11";
  assert.throws(() => montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "mensal",
  }), /deve corresponder a um vencimento/);
});

test("salvar mensal persiste agenda completa sem criar saídas futuras", async () => {
  const registros = new Map();
  let proximoId = 1;
  const supabase = {
    from(tabela) {
      if (tabela === "categorias") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { id: 9 }, error: null }) }),
          }),
        };
      }
      return {
        insert(payload) {
          const registro = { id: proximoId++, ...payload };
          const lista = registros.get(tabela) || [];
          lista.push(registro);
          registros.set(tabela, lista);
          return {
            select: () => ({ single: async () => ({ data: registro, error: null }) }),
          };
        },
      };
    },
  };
  const dados = { ...dadosBase(), formaContratacao: "mensal" };
  dados.mensal.agenda = gerarAgendaMensalContrato({
    inicioVigencia: dados.inicioVigencia,
    fimVigencia: dados.fimVigencia,
    primeiroVencimento: dados.mensal.primeiroVencimento,
    valorPadrao: dados.mensal.valorMensal,
  }).map((parcela, indice) => ({ ...parcela, valor: indice === 0 ? 50 : parcela.valor }));

  await salvarProtecaoComContrato(supabase, {
    veiculoId: 3,
    nomeVeiculo: "Carro",
    dados,
  });

  assert.equal(registros.get("contratos_financeiros_parcelas").length, 12);
  assert.equal(registros.get("contratos_financeiros_parcelas")[0].valor, 50);
  assert.equal(registros.get("saidas"), undefined);
  assert.equal(registros.get("contratos_financeiros")[0].data_inicio_controle_financeiro, "2026-09-10");
  assert.equal(registros.get("veiculos_protecoes")[0].valor_total, 1150);
});

test("parcelado aceita o valor total como origem e preserva a última diferença", () => {
  const dados = dadosBase();
  dados.parcelado = {
    ...dados.parcelado,
    valorTotal: 100,
    valorParcela: 33.33,
    numeroParcelas: 3,
    origemCalculo: "total",
  };

  const [plano] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "parcelado",
  });

  assert.equal(plano.valorTotal, 100);
  assert.deepEqual(plano.parcelas.map((item) => item.valor), [33.33, 33.33, 33.34]);
});

test("parcelado aceita o valor da parcela como origem e calcula o total", () => {
  const dados = dadosBase();
  dados.parcelado = {
    ...dados.parcelado,
    valorTotal: 99.99,
    valorParcela: 33.33,
    numeroParcelas: 3,
    origemCalculo: "parcela",
  };

  const [plano] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "parcelado",
  });

  assert.equal(plano.valorTotal, 99.99);
  assert.deepEqual(plano.parcelas.map((item) => item.valor), [33.33, 33.33, 33.33]);
});

test("entrada e total das parcelas compõem o custo previsto em centavos", () => {
  const dados = dadosBase();
  dados.entrada = { ...dados.entrada, valor: 20 };
  dados.parcelas = {
    ...dados.parcelas,
    valorTotal: 100,
    valorParcela: 33.33,
    numeroParcelas: 3,
    origemCalculo: "total",
  };

  const planos = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "entrada_parcelas",
  });

  assert.equal(planos[1].valorTotal, 100);
  assert.deepEqual(planos[1].parcelas.map((item) => item.valor), [33.33, 33.33, 33.34]);
  assert.equal(planos.reduce((total, plano) => total + plano.valorTotal, 0), 120);
});

test("entrada e valor da parcela compõem o total sem misturar as origens", () => {
  const dados = dadosBase();
  dados.parcelas = {
    ...dados.parcelas,
    valorTotal: 300,
    valorParcela: 30,
    numeroParcelas: 10,
    origemCalculo: "parcela",
    formaPagamento: "credito_avista",
    contaId: "",
    cartaoId: "7",
  };

  const [entrada, saldo] = montarPlanosCobrancaProtecao({
    ...dados,
    formaContratacao: "entrada_parcelas",
  });

  assert.equal(saldo.valorTotal, 300);
  assert.equal(entrada.contaPagamentoId, 4);
  assert.equal(saldo.cartaoPagamentoId, 7);
});
