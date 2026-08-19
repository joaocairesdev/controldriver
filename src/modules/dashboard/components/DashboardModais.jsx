import ModalBase from "../../../shared/components/modals/ModalBase";
import ToggleSwitch from "../../../shared/components/ui/ToggleSwitch";

export function ModalRateioDashboard({ rateio, fechar }) {
  return (
    <ModalBase
      aberto
      titulo="Rateio pelo uso do veículo"
      descricao="Custos rateados são divididos entre trabalho e uso pessoal conforme os quilômetros do período."
      onClose={fechar}
      largura="max-w-lg"
    >
      <div className="space-y-3 rounded-2xl border border-gray-800 bg-[#0B1120] p-4 text-sm">
        <p>KM total: <strong>{Number(rateio?.kmTotal || 0).toLocaleString("pt-BR")}</strong></p>
        <p>KM de trabalho: <strong>{Number(rateio?.kmTrabalho || 0).toLocaleString("pt-BR")}</strong></p>
        <p>KM pessoal: <strong>{Number(rateio?.kmPessoal || 0).toLocaleString("pt-BR")}</strong></p>
        <p>Parte de trabalho: <strong className="text-green-400">{Math.round(rateio?.percentualTrabalho || 0)}%</strong></p>
        <p>Parte pessoal: <strong className="text-blue-400">{Math.round(rateio?.percentualPessoal || 0)}%</strong></p>
      </div>

      {!rateio?.calculado && (
        <p className="text-sm text-yellow-400 mt-4">Ainda não existe KM total suficiente para calcular o rateio deste período.</p>
      )}
    </ModalBase>
  );
}

export function ModalContasAtrasadasDashboard({ config, alterarConfig, fechar }) {
  const opcoes = [
    { chave: "mostrarAtrasadas", titulo: "Contas atrasadas", descricao: "Faturas e contas vencidas ainda em aberto." },
    { chave: "mostrarNegativas", titulo: "Contas negativas", descricao: "Contas bancárias, carteira ou TAG com saldo negativo." },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Contas atrasadas / negativas</h2>
            <p className="text-gray-400 text-sm mt-2">Escolha o que aparece no card financeiro.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black">×</button>
        </div>

        <div className="mt-5 space-y-3">
          {opcoes.map((opcao) => {
            const ativo = Boolean(config?.[opcao.chave]);
            return (
              <button
                key={opcao.chave}
                type="button"
                onClick={() => alterarConfig({ [opcao.chave]: !ativo })}
                className={`w-full rounded-2xl p-4 flex items-center justify-between gap-4 text-left border transition ${
                  ativo ? "bg-green-500/10 border-green-500/50" : "bg-[#0B1120] border-gray-800 hover:border-green-500/40"
                }`}
              >
                <div>
                  <p className="font-black">{opcao.titulo}</p>
                  <p className="text-sm text-gray-500 mt-1">{opcao.descricao}</p>
                </div>
                <div className={`w-14 h-8 rounded-full p-1 transition ${ativo ? "bg-green-500" : "bg-gray-700"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition ${ativo ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>
            );
          })}
        </div>

        <button type="button" onClick={fechar} className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3">
          Concluir
        </button>
      </div>
    </div>
  );
}

export function ModalContasPagarDashboard({ diasSelecionados, alterarDias, fechar }) {
  const opcoes = [
    { dias: 7, titulo: "Próximos 7 dias", descricao: "Melhor para acompanhar o curto prazo." },
    { dias: 15, titulo: "Próximos 15 dias", descricao: "Boa visão para a quinzena." },
    { dias: 30, titulo: "Próximos 30 dias", descricao: "Visão mensal das obrigações." },
    { dias: 60, titulo: "Próximos 60 dias", descricao: "Planejamento mais aberto." },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4">
      <div className="w-full max-w-lg bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Contas a pagar no Dashboard</h2>
            <p className="text-gray-400 text-sm mt-2">
              Escolha o período de vencimentos exibido no card inicial.
            </p>
          </div>

          <button
            type="button"
            onClick={fechar}
            className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black"
          >
            ×
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {opcoes.map((opcao) => {
            const ativo = Number(diasSelecionados) === Number(opcao.dias);

            return (
              <button
                key={opcao.dias}
                type="button"
                onClick={() => alterarDias(opcao.dias)}
                className={`w-full rounded-2xl p-4 flex items-center justify-between gap-4 text-left border transition ${
                  ativo
                    ? "bg-green-500/10 border-green-500/50"
                    : "bg-[#0B1120] border-gray-800 hover:border-green-500/40"
                }`}
              >
                <div>
                  <p className="font-black">{opcao.titulo}</p>
                  <p className="text-sm text-gray-500 mt-1">{opcao.descricao}</p>
                </div>

                <div className={`w-14 h-8 rounded-full p-1 transition ${ativo ? "bg-green-500" : "bg-gray-700"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition ${ativo ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={fechar}
          className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}

export function ModalContasDashboard({
  contas,
  contasSelecionadas,
  plataformas,
  plataformasSelecionadas,
  alternarConta,
  alternarPlataforma,
  selecionarTodas,
  fechar,
  formatarMoeda,
}) {
  return (
    <ModalBase
      aberto
      titulo="Saldo Consolidado"
      descricao="Escolha quais contas e plataformas participam do saldo exibido no Dashboard."
      onClose={fechar}
      largura="max-w-lg"
      z="z-[110]"
      rodape={(
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={selecionarTodas} className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3">
            Ativar todas
          </button>
          <button type="button" onClick={fechar} className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3">
            Concluir
          </button>
        </div>
      )}
    >
      <section aria-labelledby="contas-saldo-titulo">
        <h3 id="contas-saldo-titulo" className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">Contas</h3>
        <div className="mt-3 space-y-3">
          {contas.map((conta) => {
            const ativo = contasSelecionadas.includes(String(conta.id));
            return (
              <div
                key={conta.id}
                className="w-full bg-[#0B1120] border border-gray-800 hover:border-green-500/50 rounded-2xl p-4 flex items-center justify-between gap-4 text-left"
              >
                <div className="min-w-0">
                  <p className="font-black truncate">{conta.nome}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatarMoeda(conta.saldo_atual)}</p>
                </div>

                <ToggleSwitch
                  ativo={ativo}
                  onChange={() => alternarConta(conta.id)}
                  ariaLabel={`${conta.nome} participa do Saldo Consolidado`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="plataformas-saldo-titulo">
        <h3 id="plataformas-saldo-titulo" className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">Plataformas</h3>
        <div className="mt-3 space-y-3">
          {plataformas.map((plataforma) => {
            const ativo = plataformasSelecionadas.includes(String(plataforma.id));
            return (
              <div
                key={plataforma.id}
                className="w-full bg-[#0B1120] border border-gray-800 hover:border-green-500/50 rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-black truncate">{plataforma.nome}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatarMoeda(plataforma.saldo)}</p>
                  <p className="text-xs text-gray-500 mt-1">Participa do Saldo Consolidado</p>
                </div>

                <ToggleSwitch
                  ativo={ativo}
                  onChange={() => alternarPlataforma(plataforma.id)}
                  ariaLabel={`${plataforma.nome} participa do Saldo Consolidado`}
                />
              </div>
            );
          })}
        </div>
      </section>
    </ModalBase>
  );
}

export function ModalPeriodo(props) {
  const {
    periodo,
    meses,
    diasSemana,
    dataSelecionada,
    mesSelecionado,
    anoSelecionado,
    semanaSelecionada,
    setMesSelecionado,
    setAnoSelecionado,
    setSemanaSelecionada,
    alterarMes,
    selecionarHoje,
    selecionarSemanaAtual,
    selecionarMesAtual,
    selecionarAnoAtual,
    diasDoMesCalendario,
    diaTemMovimento,
    semanaTemMovimento,
    mesTemMovimento,
    anoTemMovimento,
    selecionarDia,
    anosComDados,
    pegarSemanaPorNumero,
    formatarDataBR,
    setModalAnoAberto,
    setModalMesAnoAberto,
    setEtapaMesAno,
    fechar,
  } = props;

  const agora = new Date();
  const hojeLocal = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  const acoesPeriodoAtual = {
    dia: { label: "Hoje", executar: selecionarHoje, ativo: dataSelecionada === hojeLocal },
    semana: {
      label: "Esta semana",
      executar: selecionarSemanaAtual,
      ativo: Number(semanaSelecionada) === numeroSemanaISO(agora) && Number(anoSelecionado) === agora.getFullYear(),
    },
    mes: {
      label: "Este mês",
      executar: selecionarMesAtual,
      ativo: Number(mesSelecionado) === agora.getMonth() + 1 && Number(anoSelecionado) === agora.getFullYear(),
    },
    ano: { label: "Este ano", executar: selecionarAnoAtual, ativo: Number(anoSelecionado) === agora.getFullYear() },
  };
  const acaoPeriodoAtual = acoesPeriodoAtual[periodo];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#111827] border border-gray-800 rounded-2xl p-5 scrollbar-hide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Selecionar Período</h2>
            <p className="text-gray-400 mt-2">Escolha o período que deseja visualizar.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={acaoPeriodoAtual.executar}
              aria-pressed={acaoPeriodoAtual.ativo}
              className={`h-10 rounded-xl border px-3 text-sm font-bold transition ${acaoPeriodoAtual.ativo ? "border-green-400 bg-green-500/10 text-green-400" : "border-gray-700 text-gray-200 hover:border-green-400 hover:text-green-400"}`}
            >
              {acaoPeriodoAtual.label}
            </button>
            <button type="button" onClick={fechar} aria-label="Fechar" className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">
              ×
            </button>
          </div>
        </div>

        {periodo === "dia" && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => alterarMes(-1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">‹</button>
              <button
                type="button"
                onClick={() => {
                  setEtapaMesAno("ano");
                  setModalMesAnoAberto(true);
                }}
                className="flex-1 text-center hover:text-green-400 transition cursor-pointer py-2 rounded-xl hover:bg-white/5"
              >
                <span className="text-xl sm:text-2xl font-bold">{meses[Number(mesSelecionado) - 1]}</span>
                <span className="text-xl sm:text-2xl font-bold mx-2 text-gray-500">/</span>
                <span className="text-xl sm:text-2xl font-bold">{anoSelecionado}</span>
              </button>
              <button type="button" onClick={() => alterarMes(1)} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white text-xl">›</button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mt-4 min-h-[292px]">
              {diasSemana.map((dia) => <div key={dia} className="text-center text-[11px] text-gray-500 font-bold h-5">{dia}</div>)}
              {diasDoMesCalendario().map((dia, index) => {
                if (!dia) return <div key={`vazio-${index}`} className="h-10" />;
                const data = `${anoSelecionado}-${String(mesSelecionado).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
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
          </div>
        )}

        {periodo === "semana" && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span />
              <button type="button" onClick={() => setModalAnoAberto(true)} className="hover:text-green-400 transition cursor-pointer">
                <span className="text-gray-400 text-sm mr-2">Ano</span><span className="text-lg font-bold">{anoSelecionado}</span>
              </button>
            </div>

            <p className="text-gray-400 text-sm mt-3">
              Semana selecionada: <span className="text-white font-semibold">{semanaSelecionada}ª</span> • {formatarDataBR(pegarSemanaPorNumero(Number(anoSelecionado), Number(semanaSelecionada)).inicio)} à {formatarDataBR(pegarSemanaPorNumero(Number(anoSelecionado), Number(semanaSelecionada)).fim)}
            </p>

            <div className="grid grid-cols-4 gap-2 mt-4 max-h-56 overflow-y-auto pr-1 scrollbar-hide">
              {Array.from({ length: 53 }, (_, i) => i + 1).map((semana) => {
                const ativa = Number(semanaSelecionada) === semana;
                const temMovimento = semanaTemMovimento(semana);
                return (
                  <button
                    key={semana}
                    type="button"
                    disabled={!temMovimento}
                    onClick={() => temMovimento && setSemanaSelecionada(semana)}
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
              })}
            </div>
          </div>
        )}

        {periodo === "mes" && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span />
              <button type="button" onClick={() => setModalAnoAberto(true)} className="hover:text-green-400 transition cursor-pointer">
                <span className="text-gray-400 text-sm mr-2">Ano</span><span className="text-lg font-bold">{anoSelecionado}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
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
              <p className="text-sm text-gray-400">Somente anos com lançamentos aparecem aqui.</p>
              <span />
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
          <button type="button" onClick={fechar} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">Cancelar</button>
          <button type="button" onClick={fechar} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">Aplicar</button>
        </div>
      </div>
    </div>
  );
}

function numeroSemanaISO(data) {
  const referencia = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  referencia.setUTCDate(referencia.getUTCDate() + 4 - (referencia.getUTCDay() || 7));
  const inicioAno = new Date(Date.UTC(referencia.getUTCFullYear(), 0, 1));
  return Math.ceil((((referencia - inicioAno) / 86400000) + 1) / 7);
}

export function ModalAno({ anos, anoSelecionado, setAnoSelecionado, fechar }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Selecionar Ano</h2>
            <p className="text-gray-400 mt-2">Somente anos com lançamentos aparecem aqui.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">×</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          {anos.map((ano) => (
            <button
              key={ano}
              type="button"
              onClick={() => {
                setAnoSelecionado(ano);
                fechar();
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
  );
}

export function ModalMesAno({ etapa, setEtapa, anos, meses, anoSelecionado, setAnoSelecionado, mesSelecionado, setMesSelecionado, mesTemMovimento, fechar }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{etapa === "ano" ? "Selecionar Ano" : "Selecionar Mês"}</h2>
            <p className="text-gray-400 mt-2">Primeiro escolha o ano, depois escolha o mês.</p>
          </div>
          <button type="button" onClick={fechar} className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold">×</button>
        </div>

        {etapa === "ano" ? (
          <div className="grid grid-cols-3 gap-3 mt-6">
            {anos.map((ano) => (
              <button
                key={ano}
                type="button"
                onClick={() => {
                  setAnoSelecionado(ano);
                  setEtapa("mes");
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
        ) : (
          <>
            <button type="button" onClick={() => setEtapa("ano")} className="mt-4 text-sm text-gray-400 hover:text-white">
              ← Voltar para anos
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
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
                      fechar();
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
  );
}
