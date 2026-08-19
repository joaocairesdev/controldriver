import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { calcularIndicadoresDiarios } from "./dashboardCalculos.js";
import { criarContextoDashboard } from "./dashboardHelpers.js";

const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

test("dia trabalhado exige faturamento, corridas e quilometragem positivos no total diário", () => {
  const entradas = [
    {
      data: "2026-08-01",
      km_rodados: 0,
      entrada_plataformas: [{ faturamento: 50, numero_corridas: 0 }],
    },
    {
      data: "2026-08-02",
      km_rodados: 40,
      entrada_plataformas: [{ faturamento: 100, numero_corridas: 0 }],
    },
    {
      data: "2026-08-03",
      km_rodados: 0,
      entrada_plataformas: [{ faturamento: 70, numero_corridas: 2 }],
    },
    {
      data: "2026-08-04",
      km_rodados: 30,
      entrada_plataformas: [{ faturamento: 120, numero_corridas: 3 }],
    },
  ];

  assert.deepEqual(calcularIndicadoresDiarios(entradas), {
    diasTrabalhados: 1,
    maiorFaturamento: 120,
  });
});

test("indicadores diários agregam múltiplos registros da mesma data", () => {
  const entradas = [
    {
      data: "2026-08-05",
      km_rodados: 0,
      entrada_plataformas: [{ faturamento: 60, numero_corridas: 2 }],
    },
    {
      data: "2026-08-05",
      km_rodados: 25,
      entrada_plataformas: [{ faturamento: 40, numero_corridas: 0 }],
    },
  ];

  assert.deepEqual(calcularIndicadoresDiarios(entradas), {
    diasTrabalhados: 1,
    maiorFaturamento: 100,
  });
});

test("seleção do gráfico define intervalo, título e meta do contexto inteiro", () => {
  const contexto = criarContextoDashboard({
    periodo: "ano",
    dataSelecionada: "2026-08-14",
    semanaSelecionada: 33,
    mesSelecionado: "8",
    anoSelecionado: 2026,
    meses,
    selecaoGrafico: {
      inicio: "2026-08-01",
      fim: "2026-08-31",
      periodoMeta: "mes",
      filtrosMeta: { mesSelecionado: "8", anoSelecionado: 2026 },
      rotulo: "Agosto/2026",
    },
  });

  assert.equal(contexto.periodo, "mes");
  assert.equal(contexto.complementoTitulo, "do Mês");
  assert.equal(contexto.texto, "Agosto/2026");
  assert.deepEqual({ inicio: contexto.inicio, fim: contexto.fim }, {
    inicio: "2026-08-01",
    fim: "2026-08-31",
  });
});

test("dashboard preserva os blocos do desktop e pareia totais e médias no mobile", async () => {
  const [pagina, componentes] = await Promise.all([
    readFile(new URL("../pages/Dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DashboardComponentes.jsx", import.meta.url), "utf8"),
  ]);

  assert.equal((pagina.match(/grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch/g) || []).length, 1);
  assert.match(pagina, /hidden md:block space-y-5/);
  assert.equal((pagina.match(/grid grid-cols-5 gap-3 items-stretch/g) || []).length, 2);
  assert.match(pagina, /space-y-3 md:hidden/);
  assert.match(pagina, /indicadoresTotais\.map\(\(indicadorTotal, indice\)[\s\S]*<MetricCard \{\.\.\.indicadorTotal\} \/>[\s\S]*<MetricCard \{\.\.\.indicadoresMedios\[indice\]\} \/>/);
  assert.match(pagina, /Indicadores Totais/);
  assert.match(pagina, /Indicadores Médios/);
  assert.doesNotMatch(`${pagina}\n${componentes}`, /auto-fit|auto-fill|dashboard-indicator-grid|dashboard-card--/);

  const ordemTotais = [
    "KM Rodados",
    "Horas Trabalhadas",
    "Dias Trabalhados",
    "Corridas Realizadas",
    "Maior Faturamento",
  ].map((trecho) => pagina.indexOf(trecho));
  const ordemMedias = [
    "Ganho por KM",
    "Ganho por Hora",
    "Ganho por Dia",
    "Horas Trabalhadas por Dia",
    "Ganho por Corrida Realizada",
  ].map((trecho) => pagina.indexOf(trecho));

  [...ordemTotais, ...ordemMedias].forEach((indice) => assert.notEqual(indice, -1));
  for (let indice = 1; indice < ordemTotais.length; indice += 1) {
    assert.ok(ordemTotais[indice - 1] < ordemTotais[indice]);
    assert.ok(ordemMedias[indice - 1] < ordemMedias[indice]);
  }

  assert.match(pagina, /Maior Faturamento/);
  assert.match(pagina, /Horas Trabalhadas por Dia/);
  assert.doesNotMatch(pagina, /mostrarMetricasPorDia/);
  assert.doesNotMatch(pagina, /da seleção|na seleção/);
});

test("badges aparecem somente nos cards pequenos acima de título e valor", async () => {
  const [pagina, componentes] = await Promise.all([
    readFile(new URL("../pages/Dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DashboardComponentes.jsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(pagina, /<FaturamentoCard(?:(?!\/>)[\s\S])*badge=/);
  assert.doesNotMatch(pagina, /<MetaCard(?:(?!\/>)[\s\S])*badge=/);
  assert.match(componentes, /<IndicadorBadge tipo=\{badge\} \/>[\s\S]*\{titulo\}[\s\S]*\{valor\}/);
  assert.match(componentes, /bg-blue-500\/20 text-blue-300/);
  assert.match(componentes, /bg-purple-500\/20 text-purple-300/);
});

test("cards de custos usam altura automática antes do breakpoint desktop", async () => {
  const [pagina, componentes] = await Promise.all([
    readFile(new URL("../pages/Dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DashboardComponentes.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(pagina, /xl:auto-rows-fr/);
  assert.doesNotMatch(pagina, /xl:grid-cols-2 auto-rows-fr/);
  assert.match(componentes, /h-auto xl:h-full/);
});

test("listas financeiras do dashboard não possuem limites locais e usam janela fixa de 30 dias", async () => {
  const [pagina, componentes] = await Promise.all([
    readFile(new URL("../pages/Dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DashboardComponentes.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(pagina, /limite\.setDate\(limite\.getDate\(\) \+ 30\)/);
  assert.doesNotMatch(pagina, /\.limit\((5|10)\)/);
  assert.doesNotMatch(pagina, /\.slice\(0, (5|8)\)/);
  assert.doesNotMatch(componentes, /contas\.slice\(0, 5\)/);
});

test("saldo consolidado soma somente plataformas participantes", async () => {
  const [pagina, componentes] = await Promise.all([
    readFile(new URL("../pages/Dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../components/DashboardComponentes.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(pagina, /plataformasFinanceiras\.filter\([\s\S]*plataformasSelecionadas\.includes\(String\(plataforma\.id\)\)/);
  assert.match(pagina, /const saldoGeral = saldoContas \+ saldoPlataformas/);
  assert.match(pagina, /plataformas=\{plataformasSaldoConsolidado\}/);
  assert.match(pagina, /quantidadePlataformasSaldo=\{plataformasSaldoConsolidado\.length\}/);
  assert.doesNotMatch(componentes, /plataforma\.visivel/);
  assert.match(componentes, /\{quantidadePlataformasSaldo\} plataforma\(s\) incluída\(s\) neste saldo/);
  assert.match(componentes, /plataformas\.map\(\(plataforma\)/);
});
