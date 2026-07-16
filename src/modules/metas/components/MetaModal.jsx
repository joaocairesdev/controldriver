import { useEffect, useMemo, useState } from "react";
import ModalBase from "../../../shared/components/modals/ModalBase";

const TIPOS_META = ["diaria", "semanal", "mensal", "anual"];
const DIAS_SEMANA = [
  { valor: 1, curto: "Seg", nome: "Segunda" },
  { valor: 2, curto: "Ter", nome: "Terça" },
  { valor: 3, curto: "Qua", nome: "Quarta" },
  { valor: 4, curto: "Qui", nome: "Quinta" },
  { valor: 5, curto: "Sex", nome: "Sexta" },
  { valor: 6, curto: "Sáb", nome: "Sábado" },
  { valor: 0, curto: "Dom", nome: "Domingo" },
];

const DESCRICOES_META = {
  diaria: {
    titulo: "Meta diária",
    texto: "Defina um valor fixo para atingir por dia.",
  },
  semanal: {
    titulo: "Meta semanal",
    texto: "Defina um valor para atingir por semana. O app distribui pelos dias escolhidos e reajusta conforme o faturamento registrado.",
  },
  mensal: {
    titulo: "Meta mensal",
    texto: "Defina um valor para atingir no mês. Selecione no calendário os dias em que pretende trabalhar.",
  },
  anual: {
    titulo: "Meta anual",
    texto: "Defina o objetivo total do ano. O app calcula quanto ainda falta e divide pelos dias restantes.",
  },
};

function dataISOApp(date = new Date()) {
  if (typeof date === "string") return date.split("T")[0];
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export default function MetaModal({ aberto, onClose, onSalvar, metaAtual, metas = [], buscarFaturamentoPeriodo }) {
  const hojeTexto = dataISOApp(new Date());
  const [etapa, setEtapa] = useState(1);
  const [tipo, setTipo] = useState(metaAtual?.tipo || "diaria");
  const [valor, setValor] = useState("");
  const [dataInicio, setDataInicio] = useState(hojeTexto);
  const [diasSemana, setDiasSemana] = useState([1, 2, 3, 4, 5, 6]);
  const [diasMes, setDiasMes] = useState([]);
  const [informarRealizadoAntes, setInformarRealizadoAntes] = useState(false);
  const [realizadosPorDia, setRealizadosPorDia] = useState({});
  const [valorRealizadoAnual, setValorRealizadoAnual] = useState("");
  const [carregandoRealizado, setCarregandoRealizado] = useState(false);
  const [realizadoAutomatico, setRealizadoAutomatico] = useState(null);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    setEtapa(1);
    setTipo(metaAtual?.tipo || "diaria");
    setErros({});
  }, [aberto, metaAtual]);

  useEffect(() => {
    if (!aberto) return;

    const meta = metas.find((item) => item.tipo === tipo) || (metaAtual?.tipo === tipo ? metaAtual : null);
    const inicio = hojeTexto;
    const realizadoSalvo = Number(meta?.valor_realizado_antes || 0);

    setValor(meta?.valor_base ? numeroParaMoedaInput(meta.valor_base) : "");
    setDataInicio(inicio);
    setDiasSemana(normalizarDiasSemana(meta?.dias_semana).length ? normalizarDiasSemana(meta?.dias_semana) : [1, 2, 3, 4, 5, 6]);
    setDiasMes(normalizarArrayNumerico(meta?.dias_mes || meta?.dias_trabalho).length ? normalizarArrayNumerico(meta?.dias_mes || meta?.dias_trabalho) : gerarDiasUteisMes(inicio));
    setInformarRealizadoAntes(tipo !== "diaria" && realizadoSalvo > 0);
    setValorRealizadoAnual(tipo === "anual" && realizadoSalvo > 0 ? numeroParaMoedaInput(realizadoSalvo) : "");
    setRealizadosPorDia({});
    setRealizadoAutomatico(null);
  }, [tipo, aberto, metas, metaAtual, hojeTexto]);

  const diasAnteriores = useMemo(() => {
    if (tipo === "semanal") return diasAnterioresSemana(hojeTexto);
    if (tipo === "mensal") return diasAnterioresMes(hojeTexto);
    return [];
  }, [tipo, hojeTexto]);

  const totalRealizadoAntes = useMemo(() => {
    if (!informarRealizadoAntes || tipo === "diaria") return 0;
    if (tipo === "anual") return moedaParaNumero(valorRealizadoAnual);
    return Object.values(realizadosPorDia).reduce((total, valorDia) => total + moedaParaNumero(valorDia), 0);
  }, [informarRealizadoAntes, tipo, realizadosPorDia, valorRealizadoAnual]);

  useEffect(() => {
    if (!aberto || !informarRealizadoAntes || tipo === "diaria" || realizadoAutomatico) return;
    carregarRealizadoAutomatico();
  }, [aberto, informarRealizadoAntes, tipo, realizadoAutomatico]);

  if (!aberto) return null;

  function alternarDiaSemana(dia) {
    setErros((atuais) => ({ ...atuais, diasSemana: undefined }));
    setDiasSemana((lista) =>
      lista.includes(dia)
        ? lista.filter((item) => item !== dia)
        : [...lista, dia].sort((a, b) => ordemDiaSemana(a) - ordemDiaSemana(b))
    );
  }

  function alternarDiaMes(dia) {
    setErros((atuais) => ({ ...atuais, diasMes: undefined }));
    setDiasMes((lista) =>
      lista.includes(dia)
        ? lista.filter((item) => item !== dia)
        : [...lista, dia].sort((a, b) => a - b)
    );
  }

  function selecionarTodosDiasMes() {
    setDiasMes(diasCalendario(dataInicio).map((dia) => dia.dia));
  }

  function selecionarDiasUteisMes() {
    setDiasMes(gerarDiasUteisMes(dataInicio));
  }

  function alterarRealizadoDia(data, valorDigitado) {
    setRealizadosPorDia((atual) => ({
      ...atual,
      [data]: formatarMoedaDigitada(valorDigitado),
    }));
  }

  async function alternarInformarRealizado() {
    const novoValor = !informarRealizadoAntes;
    setInformarRealizadoAntes(novoValor);

    if (!novoValor) {
      setRealizadosPorDia({});
      setValorRealizadoAnual("");
      setRealizadoAutomatico(null);
      return;
    }

    await carregarRealizadoAutomatico();
  }

  async function carregarRealizadoAutomatico() {
    if (!buscarFaturamentoPeriodo || tipo === "diaria") return;

    const periodo = periodoRealizadoAnterior(tipo, hojeTexto);
    if (!periodo) return;

    setCarregandoRealizado(true);
    const resultado = await buscarFaturamentoPeriodo(periodo.inicio, periodo.fim);
    setCarregandoRealizado(false);

    const total = Number(resultado?.total || 0);
    const porData = resultado?.porData || {};
    setRealizadoAutomatico({ total, porData });

    if (tipo === "anual") {
      setValorRealizadoAnual(total > 0 ? numeroParaMoedaInput(total) : "");
      return;
    }

    const preenchidos = Object.entries(porData).reduce((acc, [data, valorDia]) => {
      if (Number(valorDia || 0) > 0) acc[data] = numeroParaMoedaInput(valorDia);
      return acc;
    }, {});

    setRealizadosPorDia(preenchidos);
  }

  function validarConfiguracao() {
    const valorNumero = moedaParaNumero(valor);
    const novosErros = {};

    if (valorNumero <= 0) {
      novosErros.valor = "Informe um valor maior que zero.";
    }


    if (tipo === "semanal" && diasSemana.length === 0) {
      novosErros.diasSemana = "Selecione pelo menos um dia da semana.";
    }

    if (tipo === "mensal" && diasMes.length === 0) {
      novosErros.diasMes = "Selecione pelo menos um dia do mês.";
    }

    setErros(novosErros);
    if (Object.keys(novosErros).length) setShakeKey(Date.now());
    return Object.keys(novosErros).length === 0;
  }

  function avancar() {
    if (etapa === 1) {
      setEtapa(2);
    }
  }

  function voltar() {
    setErros({});
    if (etapa > 1) {
      setEtapa((atual) => atual - 1);
      return;
    }

    onClose();
  }

  function salvar() {
    if (!validarConfiguracao()) return;

    onSalvar({
      tipo,
      valor_base: moedaParaNumero(valor),
      data_inicio: hojeTexto,
      dias_semana: tipo === "semanal" ? diasSemana : [],
      dias_mes: tipo === "mensal" ? diasMes : [],
      valor_realizado_antes: tipo === "diaria" ? 0 : totalRealizadoAntes,
    });
  }

  const diasDoMes = diasCalendario(dataInicio);
  const cabecalhoModal = obterCabecalhoModal(etapa, tipo);

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={cabecalhoModal.titulo}
        descricao={cabecalhoModal.descricao}
        onClose={onClose}
        largura="max-w-4xl"
        confirmarAoFecharSeAlterado
        rodape={
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={voltar} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">
              {etapa === 1 ? "Cancelar" : "Voltar"}
            </button>
            {etapa === 1 ? (
              <button type="button" onClick={avancar} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">
                Próximo
              </button>
            ) : (
              <button type="button" onClick={salvar} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">
                Salvar Meta
              </button>
            )}
          </div>
        }
      >
        <EtapasIndicador etapa={etapa} />

        {etapa === 1 && (
          <section className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TIPOS_META.map((item) => {
                const ativo = tipo === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTipo(item)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      ativo
                        ? "border-green-400 bg-green-500/10 text-green-400"
                        : "border-gray-700 bg-[#0B1120] text-white hover:bg-white/5"
                    }`}
                  >
                    <p className="text-xl font-black">{DESCRICOES_META[item].titulo}</p>
                    <p className={`text-sm mt-2 ${ativo ? "text-green-100/80" : "text-gray-400"}`}>
                      {DESCRICOES_META[item].texto}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {etapa === 2 && (
          <section className="mt-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm text-gray-300">{rotuloCampoValor(tipo)}</label>
                <CampoMoeda
                  erro={erros.valor}
                  shakeKey={shakeKey}
                  valor={valor}
                  onChange={(valorDigitado) => {
                    setErros((atuais) => ({ ...atuais, valor: undefined }));
                    setValor(formatarMoedaDigitada(valorDigitado));
                  }}
                />
              </div>

            </div>


            {tipo === "semanal" && (
              <section className="mt-6">
                <div>
                  <h3 className="text-lg font-bold">Dias de trabalho da semana</h3>
                  <p className="text-sm text-gray-400 mt-1">Escolha os dias em que pretende trabalhar. A meta semanal será distribuída somente entre eles.</p>
                </div>
                <DiasSemanaCards diasSelecionados={diasSemana} alternarDia={alternarDiaSemana} />
                {erros.diasSemana && <ErroInline mensagem={erros.diasSemana} shakeKey={shakeKey} />}
              </section>
            )}

            {tipo === "mensal" && (
              <section className="mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Dias de trabalho no mês</h3>
                    <p className="text-sm text-gray-400 mt-1">Marque os dias planejados para trabalho neste mês. O app divide a meta entre os dias selecionados.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={selecionarDiasUteisMes} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Dias úteis</button>
                    <button type="button" onClick={selecionarTodosDiasMes} className="border border-gray-700 hover:border-green-400 rounded-xl px-3 py-2 text-xs font-bold">Todos</button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mt-4">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => (
                    <div key={dia} className="text-center text-xs text-gray-500 font-bold py-1">{dia}</div>
                  ))}
                  {diasDoMes.map((item, index) =>
                    item.vazio ? (
                      <div key={`vazio-${index}`} />
                    ) : (
                      <button
                        key={item.dia}
                        type="button"
                        onClick={() => alternarDiaMes(item.dia)}
                        className={`rounded-xl border p-3 text-sm font-black ${
                          diasMes.includes(item.dia)
                            ? "border-green-400 bg-green-500/10 text-green-400"
                            : "border-gray-800 bg-[#0B1120] text-gray-300 hover:bg-white/5"
                        }`}
                      >
                        {item.dia}
                      </button>
                    )
                  )}
                </div>
                {erros.diasMes && <ErroInline mensagem={erros.diasMes} shakeKey={shakeKey} />}
              </section>
            )}


            {tipo !== "diaria" && (
              <RealizadoAntesBox
                tipo={tipo}
                ativo={informarRealizadoAntes}
                alternar={alternarInformarRealizado}
                diasAnteriores={diasAnteriores}
                realizadosPorDia={realizadosPorDia}
                alterarRealizadoDia={alterarRealizadoDia}
                valorRealizadoAnual={valorRealizadoAnual}
                setValorRealizadoAnual={(valorDigitado) => setValorRealizadoAnual(formatarMoedaDigitada(valorDigitado))}
                totalRealizadoAntes={totalRealizadoAntes}
                carregandoRealizado={carregandoRealizado}
                realizadoAutomatico={realizadoAutomatico}
                buscarNovamente={carregarRealizadoAutomatico}
              />
            )}
          </section>
        )}
      </ModalBase>
    </>
  );
}

function obterCabecalhoModal(etapa, tipo) {
  if (etapa === 1) {
    return {
      titulo: "Defina sua meta",
      descricao: "Selecione uma forma de acompanhamento que faz mais sentido para sua rotina.",
    };
  }

  const mapa = {
    diaria: {
      titulo: "Meta diária",
      descricao: "Informe o valor que precisa atingir por dia.",
    },
    semanal: {
      titulo: "Meta semanal",
      descricao: "Informe o valor semanal e escolha os dias em que pretende trabalhar.",
    },
    mensal: {
      titulo: "Meta mensal",
      descricao: "Informe o valor mensal e marque no calendário os dias planejados de trabalho.",
    },
    anual: {
      titulo: "Meta anual",
      descricao: "Informe o objetivo anual. O app calcula a meta necessária de hoje pelo que ainda falta no ano.",
    },
  };

  return mapa[tipo] || mapa.diaria;
}

function rotuloCampoValor(tipo) {
  const mapa = {
    diaria: "Valor diário",
    semanal: "Valor semanal",
    mensal: "Valor mensal",
    anual: "Valor anual",
  };

  return mapa[tipo] || "Valor da meta";
}

function EtapasIndicador({ etapa }) {
  const itens = [
    { numero: 1, texto: "Definição" },
    { numero: 2, texto: "Configuração" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {itens.map((item) => (
          <div
            key={item.numero}
            className={`h-2 rounded-full transition ${etapa >= item.numero ? "bg-green-500" : "bg-gray-800"}`}
            aria-label={`Etapa ${item.numero}: ${item.texto}`}
          />
        ))}
      </div>
    </div>
  );
}

function RealizadoAntesBox({
  tipo,
  ativo,
  alternar,
  diasAnteriores,
  realizadosPorDia,
  alterarRealizadoDia,
  valorRealizadoAnual,
  setValorRealizadoAnual,
  totalRealizadoAntes,
  carregandoRealizado,
  realizadoAutomatico,
  buscarNovamente,
}) {
  return (
    <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-white">Já existe faturamento neste período?</p>
          <p className="text-sm text-gray-400 mt-1">
            {tipo === "semanal" && "Ao ativar, o app busca automaticamente o faturamento registrado do início da semana até ontem."}
            {tipo === "mensal" && "Ao ativar, o app busca automaticamente o faturamento registrado do início do mês até ontem."}
            {tipo === "anual" && "Ao ativar, o app busca automaticamente o faturamento registrado do início do ano até ontem."}
          </p>
        </div>
        <button type="button" onClick={alternar} className={`w-14 h-8 rounded-full p-1 transition ${ativo ? "bg-green-500" : "bg-gray-700"}`}>
          <span className={`block w-6 h-6 rounded-full bg-white transition ${ativo ? "translate-x-6" : "translate-x-0"}`} />
        </button>
      </div>

      {ativo && (
        <div className="mt-4 bg-[#111827] border border-gray-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-400">Faturamento encontrado automaticamente</p>
            <p className="text-xl font-black text-green-400 mt-1">
              {carregandoRealizado ? "Buscando..." : formatarMoedaBR(realizadoAutomatico?.total || totalRealizadoAntes)}
            </p>
          </div>
          <button
            type="button"
            onClick={buscarNovamente}
            disabled={carregandoRealizado}
            className="border border-gray-700 hover:border-green-400 disabled:opacity-50 rounded-xl px-3 py-2 text-xs font-bold text-white"
          >
            Buscar novamente
          </button>
        </div>
      )}

      {ativo && tipo === "anual" && (
        <div className="mt-4">
          <label className="text-sm text-gray-300">Valor já realizado no ano</label>
          <CampoMoeda valor={valorRealizadoAnual} onChange={setValorRealizadoAnual} />
        </div>
      )}

      {ativo && tipo !== "anual" && (
        <div className="mt-4">
          {diasAnteriores.length === 0 ? (
            <p className="text-sm text-gray-500">Ainda não há dias anteriores neste período para informar.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {diasAnteriores.map((dia) => (
                <div key={dia.data}>
                  <label className="text-sm text-gray-300">{dia.rotulo}</label>
                  <CampoMoeda valor={realizadosPorDia[dia.data] || ""} onChange={(valorDigitado) => alterarRealizadoDia(dia.data, valorDigitado)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ativo && (
        <div className="mt-4 border-t border-gray-800 pt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-400">Total informado</p>
          <p className="text-lg font-black text-green-400">{formatarMoedaBR(totalRealizadoAntes)}</p>
        </div>
      )}
    </div>
  );
}

function CampoMoeda({ valor, onChange, erro, shakeKey }) {
  return (
    <>
      <div key={erro ? shakeKey : "ok"} className={`flex items-center mt-2 bg-[#0B1120] border ${erro ? "border-red-500 animate-shake" : "border-gray-700"} rounded-xl overflow-hidden`}>
        <span className="px-3 text-gray-400">R$</span>
        <input type="text" inputMode="decimal" value={valor} placeholder="0,00" onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent p-3 outline-none" />
      </div>
      {erro && <ErroInline mensagem={erro} shakeKey={shakeKey} />}
    </>
  );
}

function ErroInline({ mensagem, shakeKey }) {
  return <p key={shakeKey} className="animate-shake text-xs text-red-400 font-semibold mt-2">{mensagem}</p>;
}

function DiasSemanaCards({ diasSelecionados, alternarDia }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
      {DIAS_SEMANA.map((dia) => {
        const ativo = diasSelecionados.includes(dia.valor);
        return (
          <button
            key={dia.valor}
            type="button"
            onClick={() => alternarDia(dia.valor)}
            className={`rounded-2xl border p-4 text-left transition ${
              ativo
                ? "border-green-400 bg-green-500/10 text-green-400"
                : "border-gray-700 bg-[#0B1120] text-gray-300 hover:bg-white/5"
            }`}
          >
            <p className="text-lg font-black">{dia.curto}</p>
            <p className="text-xs text-gray-500 mt-1">{dia.nome}</p>
          </button>
        );
      })}
    </div>
  );
}

function InfoBox({ titulo, texto }) {
  return (
    <div className="mt-6 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
      <p className="font-bold text-white">{titulo}</p>
      <p className="text-sm text-gray-400 mt-1">{texto}</p>
    </div>
  );
}

function ResumoItem({ titulo, valor }) {
  return (
    <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="text-lg font-black text-white mt-1">{valor}</p>
    </div>
  );
}

function periodoRealizadoAnterior(tipo, hojeTexto) {
  const ontem = adicionarDiasISO(hojeTexto, -1);
  if (ontem >= hojeTexto) return null;

  if (tipo === "semanal") {
    const semana = intervaloSemana(hojeTexto);
    return semana.inicio <= ontem ? { inicio: semana.inicio, fim: ontem } : null;
  }

  if (tipo === "mensal") {
    const mes = intervaloMes(hojeTexto);
    return mes.inicio <= ontem ? { inicio: mes.inicio, fim: ontem } : null;
  }

  if (tipo === "anual") {
    const ano = String(hojeTexto).slice(0, 4);
    const inicio = `${ano}-01-01`;
    return inicio <= ontem ? { inicio, fim: ontem } : null;
  }

  return null;
}

function montarRealizadosIniciais(tipo, hojeTexto, valorSalvo) {
  if (!valorSalvo || valorSalvo <= 0) return {};
  const dias = tipo === "semanal" ? diasAnterioresSemana(hojeTexto) : tipo === "mensal" ? diasAnterioresMes(hojeTexto) : [];
  if (!dias.length) return {};
  return { [dias[0].data]: numeroParaMoedaInput(valorSalvo) };
}

function diasAnterioresSemana(hojeTexto) {
  const semana = intervaloSemana(hojeTexto);
  return listarDatas(semana.inicio, adicionarDiasISO(hojeTexto, -1)).map((data) => ({
    data,
    rotulo: `${nomeDiaSemana(data)} • ${formatarDataBR(data)}`,
  }));
}

function diasAnterioresMes(hojeTexto) {
  const mes = intervaloMes(hojeTexto);
  return listarDatas(mes.inicio, adicionarDiasISO(hojeTexto, -1)).map((data) => ({
    data,
    rotulo: `${formatarDataBR(data)} • ${nomeDiaSemana(data)}`,
  }));
}

function listarDatas(inicio, fim) {
  if (!inicio || !fim || inicio > fim) return [];
  const datas = [];
  const data = new Date(`${inicio}T00:00:00`);
  const fimData = new Date(`${fim}T00:00:00`);
  while (data <= fimData) {
    datas.push(dataISOApp(data));
    data.setDate(data.getDate() + 1);
  }
  return datas;
}

function intervaloSemana(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const diaSemana = data.getDay();
  const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;
  data.setDate(data.getDate() + diferenca);
  const inicio = dataISOApp(data);
  return { inicio, fim: adicionarDiasISO(inicio, 6) };
}

function intervaloMes(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const ano = data.getFullYear();
  const mes = data.getMonth() + 1;
  return {
    inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
    fim: dataISOApp(new Date(ano, mes, 0)),
  };
}

function adicionarDiasISO(dataISOTexto, quantidade) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  data.setDate(data.getDate() + quantidade);
  return dataISOApp(data);
}

function gerarDiasUteisMes(dataInicio) {
  return diasCalendario(dataInicio)
    .filter((item) => !item.vazio && item.diaSemana >= 1 && item.diaSemana <= 5)
    .map((item) => item.dia);
}

function diasCalendario(dataInicio) {
  const data = new Date(`${dataInicio}T00:00:00`);
  const ano = data.getFullYear();
  const mes = data.getMonth() + 1;
  const total = new Date(ano, mes, 0).getDate();
  const primeiro = new Date(ano, mes - 1, 1).getDay();
  const dias = [];

  for (let i = 0; i < primeiro; i++) dias.push({ vazio: true });
  for (let dia = 1; dia <= total; dia++) {
    dias.push({ dia, diaSemana: new Date(ano, mes - 1, dia).getDay() });
  }

  return dias;
}

function textoTipo(tipo) {
  const mapa = {
    diaria: "Meta Diária",
    semanal: "Meta Semanal",
    mensal: "Meta Mensal",
    anual: "Meta Anual",
  };
  return mapa[tipo] || "Meta";
}

function textoRegraCalculo(tipo) {
  const mapa = {
    diaria: "A meta necessária hoje será sempre o valor diário informado.",
    semanal: "Na semana de criação, o valor é redistribuído pelos dias restantes. Nas próximas semanas, a meta semanal cheia será dividida pelos dias escolhidos.",
    mensal: "No mês de criação, o valor é redistribuído pelos dias restantes selecionados. Nos próximos meses, usa os dias selecionados daquele mês.",
    anual: "O app pega o que falta da meta anual e divide pelos dias restantes do ano.",
  };
  return mapa[tipo] || "";
}

function textoDiasSemana(dias) {
  const lista = normalizarDiasSemana(dias);
  if (!lista.length) return "-";
  return DIAS_SEMANA.filter((dia) => lista.includes(dia.valor)).map((dia) => dia.curto).join(", ");
}

function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

function nomeDiaSemana(dataISOTexto) {
  const data = new Date(`${dataISOTexto}T00:00:00`);
  const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return nomes[data.getDay()];
}

function formatarMoedaDigitada(valor) {
  let texto = String(valor || "").replace(/\D/g, "");
  const numero = Number(texto || 0) / 100;
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moedaParaNumero(valor) {
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, "").replace(",", "."));
}

function numeroParaMoedaInput(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarMoedaBR(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizarArrayNumerico(valor) {
  if (Array.isArray(valor)) return valor.map(Number).filter((item) => !Number.isNaN(item));
  if (typeof valor === "string") {
    try {
      const convertido = JSON.parse(valor);
      return Array.isArray(convertido) ? convertido.map(Number).filter((item) => !Number.isNaN(item)) : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function normalizarDiasSemana(valor) {
  return normalizarArrayNumerico(valor).filter((dia) => dia >= 0 && dia <= 6);
}

function ordemDiaSemana(dia) {
  return dia === 0 ? 7 : dia;
}
