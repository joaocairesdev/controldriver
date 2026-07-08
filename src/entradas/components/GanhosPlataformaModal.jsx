import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

import ModalBase from "../../components/modals/ModalBase";
import DatePickerModal from "../../components/modals/DatePickerModal";
import TimePickerModal from "../../components/modals/TimePickerModal";
import PlataformaEntradaModal from "./PlataformaEntradaModal";
import GerenciarPlataformasModal from "./GerenciarPlataformasModal";
import FeedbackModal from "../../components/modals/FeedbackModal";
import { FiSettings, FiTrash2 } from "react-icons/fi";
import { obterConfigPlataforma } from "../../utils/plataformasIcons";
import { formatarMoeda, moedaParaNumero } from "../../utils/moeda";
import { hojeBrasil, formatarDataBR } from "../../utils/data";

export default function GanhosPlataformaModal({ aberto, onClose, jornadaInicial = null, edicao = null, onSalvo = null }) {
  const hoje = hojeBrasil();

  const [data, setData] = useState(hoje);
  const [km, setKm] = useState("");
  const [plataformas, setPlataformas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [contaPrincipal, setContaPrincipal] = useState(null);
  const [veiculoPrincipal, setVeiculoPrincipal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [jornadaUsada, setJornadaUsada] = useState(null);
  const [lancamentosDoDia, setLancamentosDoDia] = useState({});

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalTempoAberto, setModalTempoAberto] = useState(false);
  const [modalGerenciarAberto, setModalGerenciarAberto] = useState(false);
  const [modalDadosPlataformaAberto, setModalDadosPlataformaAberto] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "", fecharDepois: false });

  const [plataformaEditando, setPlataformaEditando] = useState(null);

  const [tempoPicker, setTempoPicker] = useState({
    hora: "08",
    minuto: "00",
  });

  useEffect(() => {
    if (!aberto) return;
    carregarDados();
  }, [aberto]);

  useEffect(() => {
    if (!aberto || !edicao) return;
    aplicarEdicaoNoFormulario(edicao);
  }, [aberto, edicao]);

  useEffect(() => {
    if (!aberto || !jornadaInicial?.id) return;
    aplicarJornadaNoFormulario(jornadaInicial);
  }, [aberto, jornadaInicial?.id]);

  async function carregarDados() {
    const { data: plataformasData, error: erroPlataformas } = await supabase
      .from("plataformas")
      .select("*")
      .eq("visivel", true)
      .order("id");

    if (erroPlataformas) console.error("Erro ao carregar plataformas:", erroPlataformas);

    const { data: contaData } = await supabase
      .from("contas")
      .select("*")
      .eq("principal", true)
      .maybeSingle();

    const { data: veiculoData } = await supabase
      .from("veiculos")
      .select("*")
      .eq("principal", true)
      .maybeSingle();

    setPlataformas(plataformasData || []);
    setContaPrincipal(contaData || null);
    setVeiculoPrincipal(veiculoData || null);

    const dataBase = edicao?.data || jornadaInicial?.data || data || hoje;
    await carregarLancamentosDoDia(dataBase);

    if (edicao?.id) {
      aplicarEdicaoNoFormulario(edicao);
      return;
    }

    if (jornadaInicial?.id) {
      aplicarJornadaNoFormulario(jornadaInicial);
      return;
    }

    await carregarJornadaPorData(dataBase);
  }

  async function carregarLancamentosDoDia(dataISO) {
    if (!dataISO) {
      setLancamentosDoDia({});
      return;
    }

    const { data: entradasData, error: erroEntradas } = await supabase
      .from("entradas")
      .select("id")
      .eq("data", dataISO);

    if (erroEntradas) {
      console.error("Erro ao carregar lançamentos do dia:", erroEntradas);
      setLancamentosDoDia({});
      return;
    }

    const entradaIds = (entradasData || []).map((entrada) => entrada.id);

    if (!entradaIds.length) {
      setLancamentosDoDia({});
      return;
    }

    const { data: plataformasData, error: erroPlataformas } = await supabase
      .from("entrada_plataformas")
      .select("plataforma_id, faturamento, numero_corridas, valor_reembolso")
      .in("entrada_id", entradaIds);

    if (erroPlataformas) {
      console.error("Erro ao carregar plataformas já lançadas:", erroPlataformas);
      setLancamentosDoDia({});
      return;
    }

    const resumo = (plataformasData || []).reduce((acc, item) => {
      const id = String(item.plataforma_id);

      if (!acc[id]) {
        acc[id] = { faturamento: 0, corridas: 0, reembolso: 0 };
      }

      acc[id].faturamento += Number(item.faturamento || 0);
      acc[id].corridas += Number(item.numero_corridas || 0);
      acc[id].reembolso += Number(item.valor_reembolso || 0);

      return acc;
    }, {});

    setLancamentosDoDia(resumo);
  }

  async function carregarJornadaPorData(dataISO) {
    const { data: jornadaData } = await supabase
      .from("jornadas_trabalho")
      .select("*")
      .eq("data", dataISO)
      .eq("status", "finalizada")
      .is("lancamento_entrada_id", null)
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jornadaData?.id) {
      aplicarJornadaNoFormulario(jornadaData);
      return;
    }

    removerJornadaDoFormulario(dataISO);
  }

  function aplicarJornadaNoFormulario(jornada) {
    if (!jornada) return;

    const segundos = Number(jornada.tempo_liquido_segundos || calcularSegundosJornada(jornada));
    const horasMinutos = jornada.horas_trabalhadas || segundosParaHoraMinuto(segundos);
    const [hora, minuto] = String(horasMinutos || "00:00").split(":");

    setData(jornada.data || hoje);
    setKm(String(Math.round(Number(jornada.km_rodados || 0))));
    setTempoPicker({
      hora: String(hora || "00").padStart(2, "0"),
      minuto: String(minuto || "00").padStart(2, "0"),
    });
    setJornadaUsada({
      ...jornada,
      tempo_liquido_segundos: segundos,
      horas_trabalhadas: horasMinutos,
    });
  }

  function aplicarEdicaoNoFormulario(dados) {
    if (!dados) return;
    const [hora = "00", minuto = "00"] = String(dados.horas_trabalhadas || "00:00").split(":");

    setData(dados.data || hoje);
    setKm(String(Math.round(Number(dados.km_rodados || 0))));
    setTempoPicker({
      hora: String(hora || "00").padStart(2, "0"),
      minuto: String(minuto || "00").padStart(2, "0"),
    });
    setJornadaUsada(null);

    const plataformasEdicao = (dados.entrada_plataformas || [])
      .map((item) => ({
        id: item.plataforma_id || item.plataformas?.id || item.id,
        detalhe_id: item.id,
        nome: item.plataformas?.nome || "Plataforma",
        faturamento: numeroParaMoedaFormulario(item.faturamento),
        numero_corridas: Number(item.numero_corridas || 0),
        houve_pedagio: Boolean(item.houve_pedagio),
        valor_reembolso: numeroParaMoedaFormulario(item.valor_reembolso),
      }))
      .filter((item) => item.id);

    setSelecionadas(plataformasEdicao);
  }

  function removerJornadaDoFormulario(dataISO = data) {
    setJornadaUsada(null);
    setData(dataISO || hoje);
    setKm("");
    setTempoPicker({ hora: "08", minuto: "00" });
  }

  function calcularSegundosJornada(jornada) {
    if (!jornada?.inicio || !jornada?.fim) return 0;
    const inicio = new Date(jornada.inicio).getTime();
    const fim = new Date(jornada.fim).getTime();
    const bruto = Math.max(Math.floor((fim - inicio) / 1000), 0);
    return Math.max(bruto - Number(jornada.total_pausas_segundos || 0), 0);
  }

  function segundosParaHoraMinuto(segundos) {
    const total = Math.max(Number(segundos || 0), 0);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  }


  function numeroParaMoedaFormulario(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function idsIguais(a, b) {
    return String(a) === String(b);
  }

  function abrirFeedback(tipo, titulo, mensagem, fecharDepois = false) {
    setFeedback({ aberto: true, tipo, titulo, mensagem, fecharDepois });
  }

  function fecharFeedback() {
    const fecharDepois = feedback.fecharDepois;
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "", fecharDepois: false });

    if (fecharDepois) {
      limparFormulario();
      onClose?.();
    }
  }

  function abrirDadosPlataforma(plataforma) {
    setPlataformaEditando(plataforma);
    setModalDadosPlataformaAberto(true);
  }

  function salvarDadosPlataforma(dados) {
    setSelecionadas((listaAtual) => {
      const jaExiste = listaAtual.some((item) => idsIguais(item.id, dados.id));

      if (jaExiste) {
        return listaAtual.map((item) =>
          idsIguais(item.id, dados.id)
            ? {
                ...item,
                ...dados,
                id: item.id,
                detalhe_id: item.detalhe_id || dados.detalhe_id,
              }
            : item
        );
      }

      return [...listaAtual, dados];
    });
  }

  function removerPlataforma(id) {
    setSelecionadas((listaAtual) => listaAtual.filter((item) => !idsIguais(item.id, id)));
  }

  function limparFormulario() {
    setData(hoje);
    setKm("");
    setTempoPicker({ hora: "08", minuto: "00" });
    setSelecionadas([]);
    setJornadaUsada(null);
    setLancamentosDoDia({});
  }

  function cancelarFormulario() {
    limparFormulario();
    onClose?.();
  }

  async function salvarEntrada() {
    if (!data || km === "" || selecionadas.length === 0) {
      abrirFeedback(
        "erro",
        "Campos obrigatórios",
        "Preencha data, KM e selecione pelo menos uma plataforma. Use 0 km quando for apenas ajuste de valor."
      );
      return;
    }

    if (!contaPrincipal?.id) {
      abrirFeedback("erro", "Conta principal não encontrada", "Defina uma conta principal em Contas antes de salvar.");
      return;
    }

    if (!veiculoPrincipal?.id) {
      abrirFeedback("erro", "Veículo principal não encontrado", "Defina um veículo principal em Veículos antes de salvar.");
      return;
    }

    setSalvando(true);

    const custoEstimadoCombustivel =
      Number(km || 0) * Number(veiculoPrincipal?.custo_medio_km_geral || 0);

    let entradaId = edicao?.id || null;

    if (edicao?.id) {
      const { error: erroEntrada } = await supabase
        .from("entradas")
        .update({
          data,
          horas_trabalhadas: `${tempoPicker.hora}:${tempoPicker.minuto}:00`,
          km_rodados: Number(km),
          custo_estimado_combustivel: custoEstimadoCombustivel,
        })
        .eq("id", edicao.id);

      if (erroEntrada) {
        console.error(erroEntrada);
        abrirFeedback("erro", "Erro ao salvar", "Erro ao atualizar entrada.");
        setSalvando(false);
        return;
      }

      const idsMantidos = selecionadas.map((item) => item.detalhe_id).filter(Boolean);
      let deleteQuery = supabase.from("entrada_plataformas").delete().eq("entrada_id", edicao.id);
      if (idsMantidos.length > 0) deleteQuery = deleteQuery.not("id", "in", `(${idsMantidos.join(",")})`);
      const { error: erroDelete } = await deleteQuery;
      if (erroDelete) {
        console.error(erroDelete);
        abrirFeedback("erro", "Erro ao salvar", "Erro ao atualizar plataformas.");
        setSalvando(false);
        return;
      }
    } else {
      const { data: entradaCriada, error: erroEntrada } = await supabase
        .from("entradas")
        .insert({
          data,
          horas_trabalhadas: `${tempoPicker.hora}:${tempoPicker.minuto}:00`,
          km_rodados: Number(km),
          conta_id: contaPrincipal?.id,
          veiculo_id: veiculoPrincipal?.id,
          custo_estimado_combustivel: custoEstimadoCombustivel,
        })
        .select()
        .single();

      if (erroEntrada) {
        console.error(erroEntrada);
        abrirFeedback("erro", "Erro ao salvar", "Erro ao salvar entrada.");
        setSalvando(false);
        return;
      }

      entradaId = entradaCriada.id;
    }

    for (const item of selecionadas) {
      const dadosDetalhe = {
        entrada_id: entradaId,
        plataforma_id: item.id,
        faturamento: moedaParaNumero(item.faturamento),
        numero_corridas: Number(item.numero_corridas || 0),
        houve_pedagio: item.houve_pedagio,
        valor_reembolso: moedaParaNumero(item.valor_reembolso),
      };

      const { error: erroDetalhes } = item.detalhe_id
        ? await supabase.from("entrada_plataformas").update(dadosDetalhe).eq("id", item.detalhe_id)
        : await supabase.from("entrada_plataformas").insert(dadosDetalhe);

      if (erroDetalhes) {
        console.error(erroDetalhes);
        abrirFeedback("erro", "Erro ao salvar", "Erro ao salvar plataformas.");
        setSalvando(false);
        return;
      }
    }

    if (jornadaUsada?.id) {
      await supabase
        .from("jornadas_trabalho")
        .update({ lancamento_entrada_id: entradaId })
        .eq("id", jornadaUsada.id);
    }

    setSalvando(false);
    onSalvo?.();
    abrirFeedback(
      "sucesso",
      edicao?.id ? "Entrada atualizada" : "Entrada salva",
      edicao?.id ? "Os ganhos de plataforma foram atualizados com sucesso." : "Os ganhos de plataforma foram registrados com sucesso.",
      true
    );
  }

  function iniciais(nome) {
    return nome
      .split(" ")
      .map((parte) => parte[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function dadosDaPlataforma(id) {
    return selecionadas.find((item) => idsIguais(item.id, id));
  }

  function valorMoedaParaNumero(valor) {
    if (typeof valor === "number") return valor;
    return moedaParaNumero(valor);
  }

  function totalPlataforma(item) {
    return valorMoedaParaNumero(item.faturamento) + valorMoedaParaNumero(item.valor_reembolso);
  }

  if (!aberto) return null;

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo={edicao?.id ? "Editar Ganhos de Plataforma" : "Ganhos de Plataforma"}
        descricao={edicao?.id ? "Altere os dados do lançamento selecionado." : "Registre ganhos de Uber, 99, iFood e outros apps."}
        onClose={cancelarFormulario}
        largura="max-w-5xl"
      
        confirmarAoFecharSeAlterado>
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-300">Data</label>
              <button
                type="button"
                onClick={() => setModalDataAberto(true)}
                className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
              >
                {formatarDataBR(data)}
              </button>
            </div>

            <div>
              <label className="text-sm text-gray-300">Horas Trabalhadas</label>
              <button
                type="button"
                onClick={() => setModalTempoAberto(true)}
                className="w-full mt-2 bg-[#0B1120] border border-gray-700 hover:border-green-400 rounded-xl p-3 text-left font-semibold"
              >
                {tempoPicker.hora}:{tempoPicker.minuto}
              </button>
            </div>

            <div>
              <label className="text-sm text-gray-300">KM Rodados</label>
              <input
                type="text"
                inputMode="numeric"
                value={km}
                placeholder="0"
                onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
                className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3 outline-none focus:border-green-400"
              />
            </div>
          </div>

          {jornadaUsada && (
            <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
              <p className="text-sm font-bold text-green-400">Dados da jornada aplicados</p>
              <p className="text-xs text-gray-300 mt-1">
                Horas trabalhadas e KM rodados foram preenchidos pelo cronômetro da jornada de {formatarDataBR(jornadaUsada.data)}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 bg-[#111827] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-xl font-bold">Qual(is) plataforma(s) você trabalhou?</h3>

            <button
              type="button"
              onClick={() => setModalGerenciarAberto(true)}
              className="w-12 h-12 flex items-center justify-center bg-[#0B1120] hover:bg-green-500 hover:text-black border border-gray-700 hover:border-green-500 text-green-400 rounded-xl transition shrink-0"
              title="Gerenciar plataformas"
              aria-label="Gerenciar plataformas"
            >
              <FiSettings className="w-5 h-5" />
            </button>
          </div>

          {plataformas.length === 0 ? (
            <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-gray-400">Nenhuma plataforma visível. Clique em gerenciar para mostrar alguma plataforma.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
              {plataformas.map((plataforma) => {
                const selecionada = dadosDaPlataforma(plataforma.id);
                const config = obterConfigPlataforma(plataforma.nome);

                return (
                  <div
                    key={plataforma.id}
                    className={`border rounded-2xl transition-all ${
                      selecionada
                        ? "p-5 min-h-[142px] border-green-400 bg-green-500/5"
                        : "p-3 h-[82px] border-gray-800 bg-[#0B1120] hover:border-gray-700 opacity-55 hover:opacity-100"
                    }`}
                  >
                    {!selecionada ? (
                      <button
                        type="button"
                        onClick={() => abrirDadosPlataforma(plataforma)}
                        className="w-full h-full flex items-center gap-2 text-left"
                      >
                        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#0B1120] overflow-hidden shrink-0">
                          {config?.imagem ? (
                            <img src={config.imagem} alt="" className="w-8 h-8 object-contain" />
                          ) : (
                            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gray-700 text-gray-300 font-bold text-xs">
                              {iniciais(plataforma.nome)}
                            </span>
                          )}
                        </span>

                        <span className="font-semibold text-sm text-gray-300 truncate">{plataforma.nome}</span>
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#0B1120] overflow-hidden shrink-0">
                              {config?.imagem ? (
                                <img src={config.imagem} alt="" className="w-8 h-8 object-contain" />
                              ) : (
                                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-green-500 text-black font-bold text-xs">
                                  {iniciais(selecionada.nome)}
                                </span>
                              )}
                            </span>

                            <h3 className="font-bold text-green-400">{selecionada.nome}</h3>
                          </div>

                          <button
                            type="button"
                            onClick={() => removerPlataforma(selecionada.id)}
                            className="text-gray-500 hover:text-red-400"
                            title="Remover"
                          >
                            <FiTrash2 className="w-5 h-5" />
                          </button>
                        </div>

                        <p className="text-2xl font-bold mt-3">{formatarMoeda(totalPlataforma(selecionada))}</p>

                        <p className="text-xs text-gray-400 mt-1">{selecionada.numero_corridas || 0} corrida(s)</p>

                        {lancamentosDoDia[String(selecionada.id)] && (
                          <p className="text-xs text-blue-300 mt-1">
                            Já lançado hoje: {formatarMoeda(lancamentosDoDia[String(selecionada.id)].faturamento)} • {lancamentosDoDia[String(selecionada.id)].corridas} corridas
                          </p>
                        )}

                        {selecionada.houve_pedagio && (
                          <p className="text-xs text-gray-500 mt-1">
                            Reembolso pedágio: {formatarMoeda(moedaParaNumero(selecionada.valor_reembolso))}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => abrirDadosPlataforma(plataforma)}
                          className="text-xs text-green-400 hover:text-green-300 font-bold mt-3"
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button
            type="button"
            onClick={cancelarFormulario}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-4"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvarEntrada}
            disabled={salvando}
            className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-4"
          >
            {salvando ? "Salvando..." : edicao?.id ? "Salvar alterações" : "Salvar"}
          </button>
        </div>
      </ModalBase>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={data}
        onChange={async (novaData) => {
          setModalDataAberto(false);
          setData(novaData);
          if (!edicao?.id) setSelecionadas([]);
          await carregarLancamentosDoDia(novaData);
          if (!edicao?.id) await carregarJornadaPorData(novaData);
        }}
        onClose={() => setModalDataAberto(false)}
      />

      <TimePickerModal
        aberto={modalTempoAberto}
        valor={`${tempoPicker.hora}:${tempoPicker.minuto}`}
        onChange={(valor) => {
          const [hora, minuto] = valor.split(":");
          setTempoPicker({ hora, minuto });
          setJornadaUsada(null);
        }}
        onClose={() => setModalTempoAberto(false)}
      />

      <PlataformaEntradaModal
        aberto={modalDadosPlataformaAberto}
        plataforma={plataformaEditando}
        dadosIniciais={plataformaEditando ? dadosDaPlataforma(plataformaEditando.id) : null}
        lancamentoAnterior={
          !edicao?.id && plataformaEditando ? lancamentosDoDia[String(plataformaEditando.id)] || null : null
        }
        onClose={() => {
          setModalDadosPlataformaAberto(false);
          setPlataformaEditando(null);
        }}
        onSalvar={salvarDadosPlataforma}
      />

      <GerenciarPlataformasModal
        aberto={modalGerenciarAberto}
        onClose={() => {
          setModalGerenciarAberto(false);
          carregarDados();
        }}
      />

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={fecharFeedback}
      />
    </>
  );
}

