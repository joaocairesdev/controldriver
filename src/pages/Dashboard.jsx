import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Dashboard() {
  const hoje = new Date().toISOString().split("T")[0];

  const [periodo, setPeriodo] = useState("dia");
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [semanaSelecionada, setSemanaSelecionada] = useState(
    getSemanaDoAno(new Date())
  );
  const [mesSelecionado, setMesSelecionado] = useState(
    String(new Date().getMonth() + 1)
  );
  const [anoSelecionado, setAnoSelecionado] = useState(
    new Date().getFullYear()
  );

  const [modalPeriodoAberto, setModalPeriodoAberto] = useState(false);
  const [modalAnoAberto, setModalAnoAberto] = useState(false);
  const [modalMesAnoAberto, setModalMesAnoAberto] = useState(false);
  const [etapaMesAno, setEtapaMesAno] = useState("ano");

  const [contas, setContas] = useState([]);
  const [datasComMovimento, setDatasComMovimento] = useState([]);

const [metricas, setMetricas] = useState({
  faturamento: 0,
  custoCombustivel: 0,
  km: 0,
  corridas: 0,
  minutosTrabalhados: 0,
});

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  useEffect(() => {
    carregarFinanceiro();
    carregarDatasComMovimento();
  }, []);

  useEffect(() => {
    carregarPerformance();
  }, [
    periodo,
    dataSelecionada,
    semanaSelecionada,
    mesSelecionado,
    anoSelecionado,
  ]);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarNumero(valor) {
    return Number(valor || 0).toLocaleString("pt-BR");
  }

  function formatarHoras(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function dataISO(date) {
    return date.toISOString().split("T")[0];
  }

  function formatarDataBR(dataISOTexto) {
    if (!dataISOTexto) return "";
    const [ano, mes, dia] = String(dataISOTexto).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function getSemanaDoAno(data) {
    const inicioAno = new Date(data.getFullYear(), 0, 1);
    const dias = Math.floor((data - inicioAno) / 86400000);
    return Math.ceil((dias + inicioAno.getDay() + 1) / 7);
  }

  function pegarSemanaPorNumero(ano, numeroSemana) {
    const primeiroDiaAno = new Date(ano, 0, 1);
    const diasAteSemana = (numeroSemana - 1) * 7;

    const dataBase = new Date(primeiroDiaAno);
    dataBase.setDate(primeiroDiaAno.getDate() + diasAteSemana);

    const diaSemana = dataBase.getDay();
    const diferencaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

    const segunda = new Date(dataBase);
    segunda.setDate(dataBase.getDate() + diferencaSegunda);

    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);

    return {
      inicio: dataISO(segunda),
      fim: dataISO(domingo),
    };
  }

  function intervaloDatas() {
    if (periodo === "dia") {
      return { inicio: dataSelecionada, fim: dataSelecionada };
    }

    if (periodo === "semana") {
      return pegarSemanaPorNumero(
        Number(anoSelecionado),
        Number(semanaSelecionada)
      );
    }

    if (periodo === "mes") {
      const inicio = new Date(
        Number(anoSelecionado),
        Number(mesSelecionado) - 1,
        1
      );

      const fim = new Date(
        Number(anoSelecionado),
        Number(mesSelecionado),
        0
      );

      return {
        inicio: dataISO(inicio),
        fim: dataISO(fim),
      };
    }

    return {
      inicio: `${anoSelecionado}-01-01`,
      fim: `${anoSelecionado}-12-31`,
    };
  }

  function intervalParaMinutos(intervalo) {
    if (!intervalo) return 0;

    const partes = String(intervalo).split(":");
    const horas = Number(partes[0] || 0);
    const minutos = Number(partes[1] || 0);

    return horas * 60 + minutos;
  }

  function anosComDados() {
    const anos = [
      ...new Set(datasComMovimento.map((data) => Number(data.slice(0, 4)))),
    ].sort((a, b) => a - b);

    return anos.length > 0 ? anos : [new Date().getFullYear()];
  }

  function diaTemMovimento(data) {
    return datasComMovimento.includes(data);
  }

  function semanaTemMovimento(semana) {
    const datas = pegarSemanaPorNumero(Number(anoSelecionado), semana);

    return datasComMovimento.some((data) => {
      return data >= datas.inicio && data <= datas.fim;
    });
  }

  function mesTemMovimento(mes) {
    const mesTexto = String(mes).padStart(2, "0");

    return datasComMovimento.some((data) =>
      data.startsWith(`${anoSelecionado}-${mesTexto}`)
    );
  }

  function anoTemMovimento(ano) {
    return datasComMovimento.some((data) => data.startsWith(`${ano}-`));
  }

  function diasDoMesCalendario() {
    const ano = Number(anoSelecionado);
    const mes = Number(mesSelecionado);

    const primeiroDia = new Date(ano, mes - 1, 1);
    const ultimoDia = new Date(ano, mes, 0);

    const totalDias = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay();

    const dias = [];

    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }

    for (let dia = 1; dia <= totalDias; dia++) {
      dias.push(dia);
    }

    while (dias.length < 42) {
      dias.push(null);
    }

    return dias;
  }

  function alterarMes(delta) {
    let novoMes = Number(mesSelecionado) + delta;
    let novoAno = Number(anoSelecionado);

    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    }

    if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }

    setMesSelecionado(String(novoMes));
    setAnoSelecionado(novoAno);
  }

  function selecionarHoje() {
    const agora = new Date();

    setDataSelecionada(dataISO(agora));
    setMesSelecionado(String(agora.getMonth() + 1));
    setAnoSelecionado(agora.getFullYear());
  }

  function selecionarSemanaAtual() {
    const agora = new Date();

    setSemanaSelecionada(getSemanaDoAno(agora));
    setAnoSelecionado(agora.getFullYear());
  }

  function selecionarMesAtual() {
    const agora = new Date();

    setMesSelecionado(String(agora.getMonth() + 1));
    setAnoSelecionado(agora.getFullYear());
  }

  function selecionarAnoAtual() {
    setAnoSelecionado(new Date().getFullYear());
  }

  async function carregarDatasComMovimento() {
    const { data } = await supabase.from("entradas").select("data");

    if (!data) return;

    const datasUnicas = [...new Set(data.map((item) => item.data))];

    setDatasComMovimento(datasUnicas);
  }

  async function carregarFinanceiro() {
    const { data: contasData } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .order("id");

    const { data: entradasData } = await supabase.from("entradas").select(`
        id,
        conta_id,
        entrada_plataformas (
          faturamento,
          valor_reembolso
        )
      `);

    const contasComSaldo = (contasData || []).map((conta) => {
      const entradasDaConta = (entradasData || []).filter(
        (entrada) => entrada.conta_id === conta.id
      );

      const totalEntradas = entradasDaConta.reduce((total, entrada) => {
        const totalPlataformas = entrada.entrada_plataformas.reduce(
          (soma, item) =>
            soma +
            Number(item.faturamento || 0) +
            Number(item.valor_reembolso || 0),
          0
        );

        return total + totalPlataformas;
      }, 0);

      return {
        ...conta,
        saldo_atual: Number(conta.saldo_inicial || 0) + totalEntradas,
      };
    });

    setContas(contasComSaldo);
  }

  async function carregarPerformance() {
    const { inicio, fim } = intervaloDatas();

    const { data: entradasData } = await supabase
      .from("entradas")
      .select(`
        id,
        data,
        km_rodados,
        horas_trabalhadas,
        custo_estimado_combustivel,
        entrada_plataformas (
          faturamento,
          numero_corridas,
          valor_reembolso
        )
      `)
      .gte("data", inicio)
      .lte("data", fim);

    const resumo = (entradasData || []).reduce(
      (acc, entrada) => {
        const totalEntrada = entrada.entrada_plataformas.reduce(
          (soma, item) =>
            soma +
            Number(item.faturamento || 0) +
            Number(item.valor_reembolso || 0),
          0
        );

        const totalCorridas = entrada.entrada_plataformas.reduce(
          (soma, item) => soma + Number(item.numero_corridas || 0),
          0
        );

        acc.faturamento += totalEntrada;
        acc.custoCombustivel += Number(
  entrada.custo_estimado_combustivel || 0
);
        acc.km += Number(entrada.km_rodados || 0);
        acc.corridas += totalCorridas;
        acc.minutosTrabalhados += intervalParaMinutos(
          entrada.horas_trabalhadas
        );

        return acc;
      },
      {
  faturamento: 0,
  custoCombustivel: 0,
  km: 0,
  corridas: 0,
  minutosTrabalhados: 0,
}
    );

    setMetricas(resumo);
  }

  function textoPeriodoSelecionado() {
    if (periodo === "dia") return formatarDataBR(dataSelecionada);

    if (periodo === "semana") {
      const semana = pegarSemanaPorNumero(
        Number(anoSelecionado),
        Number(semanaSelecionada)
      );

      return `${semanaSelecionada}ª Semana • ${formatarDataBR(
        semana.inicio
      )} à ${formatarDataBR(semana.fim)}`;
    }

    if (periodo === "mes") {
      return `${meses[Number(mesSelecionado) - 1]} / ${anoSelecionado}`;
    }

    return String(anoSelecionado);
  }

  function selecionarDia(dia) {
    const data = `${anoSelecionado}-${String(mesSelecionado).padStart(
      2,
      "0"
    )}-${String(dia).padStart(2, "0")}`;

    if (!diaTemMovimento(data)) return;

    setDataSelecionada(data);
  }

  const saldoGeral = contas.reduce(
    (total, conta) => total + Number(conta.saldo_atual || 0),
    0
  );

  const horasDecimal = metricas.minutosTrabalhados / 60;

  const lucroOperacional =
  metricas.faturamento - metricas.custoCombustivel;

  const ganhoPorKm =
    metricas.km > 0 ? metricas.faturamento / metricas.km : 0;

  const ganhoPorHora =
    horasDecimal > 0 ? metricas.faturamento / horasDecimal : 0;

  const ganhoPorCorrida =
    metricas.corridas > 0 ? metricas.faturamento / metricas.corridas : 0;

  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <section className="mt-8">
        <h2 className="text-xl font-bold mb-4">Financeiro</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400">Saldo Atual Geral</p>

            <h3 className="text-4xl font-bold text-green-400 mt-2">
              {formatarMoeda(saldoGeral)}
            </h3>

            <div className="mt-4 space-y-2">
              {contas.slice(0, 3).map((conta) => (
                <div
                  key={conta.id}
                  className="flex justify-between text-sm text-gray-400"
                >
                  <span>{conta.nome}</span>
                  <span>{formatarMoeda(conta.saldo_atual)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400">Total da Reserva</p>

            <h3 className="text-4xl font-bold text-blue-400 mt-2">
              {formatarMoeda(0)}
            </h3>

            <div className="mt-4 space-y-2 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>Manutenção</span>
                <span>{formatarMoeda(0)}</span>
              </div>

              <div className="flex justify-between">
                <span>Impostos</span>
                <span>{formatarMoeda(0)}</span>
              </div>

              <div className="flex justify-between">
                <span>Emergência</span>
                <span>{formatarMoeda(0)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Performance</h2>

        <div className="mb-6 flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-3">
            {["dia", "semana", "mes", "ano"].map((item) => (
              <button
                key={item}
                onClick={() => setPeriodo(item)}
                className={`px-4 py-2 rounded-xl border capitalize ${
                  periodo === item
                    ? "border-green-400 bg-green-500/10 text-green-400"
                    : "border-gray-700 text-gray-300 hover:bg-white/5"
                }`}
              >
                {item === "mes" ? "Mês" : item}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setModalPeriodoAberto(true)}
            className="bg-[#111827] border border-gray-700 hover:border-green-400 rounded-xl px-4 py-3 text-gray-200 font-semibold text-left w-fit max-w-[520px]"
          >
            {textoPeriodoSelecionado()}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <MetricCard
            titulo="Faturamento Bruto"
            valor={formatarMoeda(metricas.faturamento)}
          />

          <MetricCard
  titulo="Custos da Operação"
  valor={formatarMoeda(metricas.custoCombustivel)}
/>

          <MetricCard
  titulo="Lucro Operacional"
  valor={formatarMoeda(lucroOperacional)}
/>

          <MetricCard titulo="KM Rodados" valor={formatarNumero(metricas.km)} />

          <MetricCard
            titulo="Nº de Corridas"
            valor={formatarNumero(metricas.corridas)}
          />

          <MetricCard
            titulo="Tempo Trabalhado"
            valor={formatarHoras(metricas.minutosTrabalhados)}
          />

          <MetricCard
            titulo="Ganho médio por KM"
            valor={formatarMoeda(ganhoPorKm)}
          />

          <MetricCard
            titulo="Ganho médio por Hora"
            valor={formatarMoeda(ganhoPorHora)}
          />

          <MetricCard
            titulo="Ganho médio por Corrida"
            valor={formatarMoeda(ganhoPorCorrida)}
          />
        </div>
      </section>

      {modalPeriodoAberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-5"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Selecionar Período</h2>

                <p className="text-gray-400 mt-2">
                  Escolha o período que deseja visualizar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalPeriodoAberto(false)}
                className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                ×
              </button>
            </div>

            {periodo === "dia" && (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => alterarMes(-1)}
                    className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEtapaMesAno("ano");
                      setModalMesAnoAberto(true);
                    }}
                    className="flex-1 text-center hover:text-green-400 transition cursor-pointer py-2 rounded-xl hover:bg-white/5"
                  >
                    <span className="text-2xl font-bold">
                      {meses[Number(mesSelecionado) - 1]}
                    </span>

                    <span className="text-2xl font-bold mx-2 text-gray-500">
                      /
                    </span>

                    <span className="text-2xl font-bold">{anoSelecionado}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => alterarMes(1)}
                    className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl"
                  >
                    ›
                  </button>
                </div>

                <button
                  type="button"
                  onClick={selecionarHoje}
                  className="mt-3 text-sm text-green-400 hover:text-green-300 font-semibold"
                >
                  Hoje
                </button>

                <div className="grid grid-cols-7 gap-1.5 mt-4 min-h-[292px]">
                  {diasSemana.map((dia) => (
                    <div
                      key={dia}
                      className="text-center text-[11px] text-gray-500 font-bold h-5"
                    >
                      {dia}
                    </div>
                  ))}

                  {diasDoMesCalendario().map((dia, index) => {
                    if (!dia) {
                      return <div key={`vazio-${index}`} className="h-10" />;
                    }

                    const data = `${anoSelecionado}-${String(
                      mesSelecionado
                    ).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

                    const ativo = dataSelecionada === data;
                    const temMovimento = diaTemMovimento(data);

                    return (
                      <button
                        key={data}
                        type="button"
                        disabled={!temMovimento}
                        onClick={() => selecionarDia(dia)}
                        className={`h-10 rounded-lg border text-xs font-bold transition ${
                          ativo
                            ? "border-green-400 bg-green-500/10 text-green-400"
                            : temMovimento
                            ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                            : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                        }`}
                      >
                        {dia}
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Apenas dias destacados possuem lançamentos.
                </p>
              </div>
            )}

            {periodo === "semana" && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={selecionarSemanaAtual}
                    className="text-sm text-green-400 hover:text-green-300 font-semibold"
                  >
                    Esta semana
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalAnoAberto(true)}
                    className="hover:text-green-400 transition cursor-pointer"
                  >
                    <span className="text-gray-400 text-sm mr-2">Ano</span>

                    <span className="text-lg font-bold">{anoSelecionado}</span>
                  </button>
                </div>

                <p className="text-gray-400 text-sm mt-3">
                  Semana selecionada:{" "}
                  <span className="text-white font-semibold">
                    {semanaSelecionada}ª
                  </span>{" "}
                  •{" "}
                  {formatarDataBR(
                    pegarSemanaPorNumero(
                      Number(anoSelecionado),
                      Number(semanaSelecionada)
                    ).inicio
                  )}{" "}
                  à{" "}
                  {formatarDataBR(
                    pegarSemanaPorNumero(
                      Number(anoSelecionado),
                      Number(semanaSelecionada)
                    ).fim
                  )}
                </p>

                <div
                  className="grid grid-cols-4 gap-2 mt-4 max-h-56 overflow-y-auto pr-1"
                  style={{ scrollbarWidth: "none" }}
                >
                  {Array.from({ length: 53 }, (_, i) => i + 1).map(
                    (semana) => {
                      const ativa = Number(semanaSelecionada) === semana;
                      const temMovimento = semanaTemMovimento(semana);

                      return (
                        <button
                          key={semana}
                          type="button"
                          disabled={!temMovimento}
                          onClick={() =>
                            temMovimento && setSemanaSelecionada(semana)
                          }
                          className={`rounded-lg border p-2 text-sm font-bold transition ${
                            ativa
                              ? "border-green-400 bg-green-500/10 text-green-400"
                              : temMovimento
                              ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                              : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                          }`}
                        >
                          {semana}ª
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {periodo === "mes" && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={selecionarMesAtual}
                    className="text-sm text-green-400 hover:text-green-300 font-semibold"
                  >
                    Este mês
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalAnoAberto(true)}
                    className="hover:text-green-400 transition cursor-pointer"
                  >
                    <span className="text-gray-400 text-sm mr-2">Ano</span>

                    <span className="text-lg font-bold">{anoSelecionado}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  {meses.map((mes, index) => {
                    const valor = String(index + 1);
                    const ativo = mesSelecionado === valor;
                    const temMovimento = mesTemMovimento(index + 1);

                    return (
                      <button
                        key={mes}
                        type="button"
                        disabled={!temMovimento}
                        onClick={() => temMovimento && setMesSelecionado(valor)}
                        className={`rounded-xl border p-3 font-semibold ${
                          ativo
                            ? "border-green-400 bg-green-500/10 text-green-400"
                            : temMovimento
                            ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                            : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                        }`}
                      >
                        {mes}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {periodo === "ano" && (
              <div className="mt-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-400">
                    Somente anos com lançamentos aparecem aqui.
                  </p>

                  <button
                    type="button"
                    onClick={selecionarAnoAtual}
                    className="text-sm text-green-400 hover:text-green-300 font-semibold"
                  >
                    Este ano
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  {anosComDados().map((ano) => {
                    const ativo = Number(anoSelecionado) === ano;
                    const temMovimento = anoTemMovimento(ano);

                    return (
                      <button
                        key={ano}
                        type="button"
                        disabled={!temMovimento}
                        onClick={() => temMovimento && setAnoSelecionado(ano)}
                        className={`rounded-xl border p-3 font-semibold ${
                          ativo
                            ? "border-green-400 bg-green-500/10 text-green-400"
                            : temMovimento
                            ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                            : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                        }`}
                      >
                        {ano}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => setModalPeriodoAberto(false)}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => setModalPeriodoAberto(false)}
                className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAnoAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Selecionar Ano</h2>

                <p className="text-gray-400 mt-2">
                  Somente anos com lançamentos aparecem aqui.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalAnoAberto(false)}
                className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              {anosComDados().map((ano) => (
                <button
                  key={ano}
                  type="button"
                  onClick={() => {
                    setAnoSelecionado(ano);
                    setModalAnoAberto(false);
                  }}
                  className={`rounded-xl border p-3 font-semibold ${
                    Number(anoSelecionado) === ano
                      ? "border-green-400 bg-green-500/10 text-green-400"
                      : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                  }`}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalMesAnoAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {etapaMesAno === "ano" ? "Selecionar Ano" : "Selecionar Mês"}
                </h2>

                <p className="text-gray-400 mt-2">
                  Primeiro escolha o ano, depois escolha o mês.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalMesAnoAberto(false)}
                className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                ×
              </button>
            </div>

            {etapaMesAno === "ano" && (
              <div className="grid grid-cols-3 gap-3 mt-6">
                {anosComDados().map((ano) => (
                  <button
                    key={ano}
                    type="button"
                    onClick={() => {
                      setAnoSelecionado(ano);
                      setEtapaMesAno("mes");
                    }}
                    className={`rounded-xl border p-3 font-semibold ${
                      Number(anoSelecionado) === ano
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                    }`}
                  >
                    {ano}
                  </button>
                ))}
              </div>
            )}

            {etapaMesAno === "mes" && (
              <>
                <button
                  type="button"
                  onClick={() => setEtapaMesAno("ano")}
                  className="mt-4 text-sm text-gray-400 hover:text-white"
                >
                  ← Voltar para anos
                </button>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  {meses.map((mes, index) => {
                    const valor = String(index + 1);
                    const ativo = mesSelecionado === valor;
                    const temMovimento = mesTemMovimento(index + 1);

                    return (
                      <button
                        key={mes}
                        type="button"
                        disabled={!temMovimento}
                        onClick={() => {
                          if (!temMovimento) return;
                          setMesSelecionado(valor);
                          setModalMesAnoAberto(false);
                        }}
                        className={`rounded-xl border p-3 font-semibold ${
                          ativo
                            ? "border-green-400 bg-green-500/10 text-green-400"
                            : temMovimento
                            ? "border-gray-600 bg-[#0B1120] text-white hover:bg-white/5"
                            : "border-gray-800 bg-[#0B1120] text-gray-600 opacity-40 cursor-not-allowed"
                        }`}
                      >
                        {mes}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ titulo, valor }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5">
      <p className="text-sm text-gray-400">{titulo}</p>
      <h3 className="text-2xl font-bold mt-2">{valor}</h3>
    </div>
  );
}
