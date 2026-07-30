import assert from "node:assert/strict";
import test from "node:test";

import { criarFeedbackAbastecimento } from "./abastecimentosFeedback.js";

test("primeiro abastecimento informa que o consumo será calculado depois", () => {
  assert.deepEqual(
    criarFeedbackAbastecimento({
      consumoKmLitro: 8.91,
      possuiAbastecimentoAnterior: false,
    }),
    {
      titulo: "⛽ Abastecimento salvo com sucesso!",
      mensagem: "O consumo será calculado automaticamente no próximo abastecimento.",
      destaque: "",
      textoBotao: "OK",
    }
  );
});

test("abastecimento com consumo disponível destaca a média", () => {
  assert.deepEqual(
    criarFeedbackAbastecimento({
      consumoKmLitro: 8.91,
      possuiAbastecimentoAnterior: true,
    }),
    {
      titulo: "⛽ Abastecimento salvo com sucesso!",
      mensagem: "Seu consumo médio foi de",
      destaque: "8,91 km/L",
      textoBotao: "OK",
    }
  );
});

test("abastecimento sem consumo válido não mostra zero ou traço", () => {
  const feedback = criarFeedbackAbastecimento({
    consumoKmLitro: 0,
    possuiAbastecimentoAnterior: true,
  });

  assert.equal(feedback.destaque, "");
  assert.doesNotMatch(feedback.mensagem, /0|-/);
  assert.match(feedback.mensagem, /próximo abastecimento/);
});
