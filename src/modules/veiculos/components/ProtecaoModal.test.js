import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const arquivo = new URL("./ProtecaoModal.jsx", import.meta.url);

test("Etapa 1 contém somente os dados básicos e navega por Continuar", async () => {
  const fonte = await readFile(arquivo, "utf8");
  const inicioEtapa1 = fonte.indexOf("{etapa === 1 ? (");
  const inicioEtapa2 = fonte.indexOf("Pagamento da proteção", inicioEtapa1);
  const etapa1 = fonte.slice(inicioEtapa1, inicioEtapa2);

  assert.match(etapa1, /Nome da proteção/);
  assert.match(etapa1, /Início da vigência/);
  assert.match(etapa1, /Fim da vigência/);
  assert.match(etapa1, /Forma de contratação/);
  assert.doesNotMatch(etapa1, /BlocoPagamento/);
  assert.match(fonte, /etapa === 1 \? "Continuar"/);
  assert.match(fonte, /const novos = obterErrosEtapa1\(\)/);
});

test("Etapa 2 identifica pagamento e preserva todas as modalidades", async () => {
  const fonte = await readFile(arquivo, "utf8");
  assert.match(fonte, /Pagamento da proteção/);
  assert.match(fonte, /formulario\.formaContratacao === "pagamento_unico"/);
  assert.match(fonte, /formulario\.formaContratacao === "mensal"/);
  assert.match(fonte, /formulario\.formaContratacao === "parcelado"/);
  assert.match(fonte, /formulario\.formaContratacao === "entrada_parcelas"/);
  assert.match(fonte, /setEtapa\(1\)/);
  assert.match(fonte, /Salvar proteção/);
});

test("Mensal usa origem primeiro, uma única data livre e seleção da agenda para histórico", async () => {
  const fonte = await readFile(arquivo, "utf8");
  assert.match(fonte, /origemPrimeiro titulo="Mensalidade"/);
  assert.match(fonte, /label: "Primeira mensalidade", tipo: "data"/);
  assert.match(fonte, /label: "Valor mensal padrão", tipo: "moeda"/);
  assert.match(fonte, /Esta proteção já estava em andamento/);
  assert.match(fonte, /tipo: "inicioControle"/);
  assert.match(fonte, /opcoes=\{agendaMensal\.map/);
  assert.doesNotMatch(fonte, /label: "Primeiro vencimento que será controlado pelo ControlDriver"/);
});
