import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raizModulo = new URL("../", import.meta.url);

test("cadastro usa três etapas e não expõe campos removidos", async () => {
  const fonte = await readFile(new URL("components/EmprestimoModal.jsx", raizModulo), "utf8");

  assert.match(fonte, /total=\{3\}/);
  assert.match(fonte, /Quem concedeu o empréstimo\?/);
  assert.match(fonte, /Dados do empréstimo/);
  assert.match(fonte, /Como o empréstimo será devolvido\?/);
  assert.doesNotMatch(fonte, /Etapa \$\{etapa\} de/);
  assert.doesNotMatch(fonte, /Observações/);
  assert.doesNotMatch(fonte, /Periodicidade/);
  assert.doesNotMatch(fonte, /Forma prevista/);
  assert.doesNotMatch(fonte, /Conta prevista/);
});

test("cadastro não pergunta a forma real usada no pagamento", async () => {
  const cadastro = await readFile(new URL("components/EmprestimoModal.jsx", raizModulo), "utf8");
  const pagamento = await readFile(new URL("../contas/components/RegistrarPagamentoModal.jsx", raizModulo), "utf8");

  assert.doesNotMatch(cadastro, /Forma do pagamento/);
  assert.match(pagamento, /Forma do pagamento/);
  assert.match(pagamento, /Pix/);
  assert.match(pagamento, /Débito/);
  assert.match(pagamento, /Dinheiro/);
});

test("extrato da conta fixa as colunas de categoria e valor no desktop", async () => {
  const fonte = await readFile(new URL("../contas/components/ModalExtratoConta.jsx", raizModulo), "utf8");

  assert.match(fonte, /sm:grid-cols-\[82px_minmax\(0,1fr\)_180px_140px\]/);
  assert.match(fonte, /sm:col-start-3 sm:row-start-1/);
  assert.match(fonte, /sm:col-start-4 sm:row-span-1/);
});
