import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { FiArrowLeft, FiTrash2 } from "react-icons/fi";
import DatePickerModal from "../components/modals/DatePickerModal";
import TimePickerModal from "../components/modals/TimePickerModal";
import PlataformaEntradaModal from "../components/modals/PlataformaEntradaModal";
import GerenciarPlataformasModal from "../components/modals/GerenciarPlataformasModal";
import FeedbackModal from "../components/modals/FeedbackModal";
import { obterConfigPlataforma } from "../utils/plataformasIcons";
import { formatarMoeda, moedaParaNumero } from "../utils/moeda";
import { hojeBrasil, formatarDataBR } from "../utils/data";

export default function NovaEntrada({ setPagina }) {
  const hoje = hojeBrasil();

  const [data, setData] = useState(hoje);
  const [km, setKm] = useState("");
  const [plataformas, setPlataformas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [contaPrincipal, setContaPrincipal] = useState(null);
  const [veiculoPrincipal, setVeiculoPrincipal] = useState(null);
  const [lancamentosDoDia, setLancamentosDoDia] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalTempoAberto, setModalTempoAberto] = useState(false);
  const [modalGerenciarAberto, setModalGerenciarAberto] = useState(false);
  const [modalDadosPlataformaAberto, setModalDadosPlataformaAberto] = useState(false);

  const [plataformaEditando, setPlataformaEditando] = useState(null);

  const [tempoPicker, setTempoPicker] = useState({
    hora: "08",
    minuto: "00",
  });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    const { data: plataformasData, error: erroPlataformas } = await supabase
      .from("plataformas")
      .select("*")
      .eq("visivel", true)
      .order("id");

    if (erroPlataformas) {
      console.error("Erro ao carregar plataformas:", erroPlataformas);
    }

    const { data: contaData } = await supabase
      .from("contas")
      .select("*")
      .eq("principal", true)
      .single();

    const { data: veiculoData } = await supabase
      .from("veiculos")
      .select("*")
      .eq("principal", true)
      .single();

    setPlataformas(plataformasData || []);
    setContaPrincipal(contaData);
    setVeiculoPrincipal(veiculoData);
    await carregarLancamentosDoDia(data || hoje);
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

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  function fecharFeedback() {
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "" });
  }

  function abrirDadosPlataforma(plataforma) {
    setPlataformaEditando(plataforma);
    setModalDadosPlataformaAberto(true);
  }

  function salvarDadosPlataforma(dados) {
    setSelecionadas((listaAtual) => {
      const jaExiste = listaAtual.some((item) => item.id === dados.id);

      if (jaExiste) {
        return listaAtual.map((item) =>
          item.id === dados.id ? { ...item, ...dados } : item
        );
      }

      return [...listaAtual, dados];
    });
  }

  function removerPlataforma(id) {
    setSelecionadas((listaAtual) => listaAtual.filter((item) => item.id !== id));
  }

  function cancelarFormulario() {
    setData(hoje);
    setKm("");
    setTempoPicker({ hora: "08", minuto: "00" });
    setSelecionadas([]);
    setLancamentosDoDia({});
    setPagina?.("novo-lancamento");
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

    setSalvando(true);

    const custoEstimadoCombustivel =
      Number(km || 0) * Number(veiculoPrincipal?.custo_medio_km_geral || 0);

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

    const detalhes = selecionadas.map((item) => ({
      entrada_id: entradaCriada.id,
      plataforma_id: item.id,
      faturamento: moedaParaNumero(item.faturamento),
      numero_corridas: Number(item.numero_corridas || 0),
      houve_pedagio: item.houve_pedagio,
      valor_reembolso: moedaParaNumero(item.valor_reembolso),
    }));

    const { error: erroDetalhes } = await supabase
      .from("entrada_plataformas")
      .insert(detalhes);

    if (erroDetalhes) {
      console.error(erroDetalhes);
      abrirFeedback("erro", "Erro ao salvar", "Erro ao salvar plataformas.");
      setSalvando(false);
      return;
    }

    abrirFeedback("sucesso", "Entrada salva", "Os ganhos de plataforma foram registrados com sucesso.");

    setKm("");
    setTempoPicker({ hora: "08", minuto: "00" });
    setSelecionadas([]);
    setSalvando(false);
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
    return selecionadas.find((item) => item.id === id);
  }

  function totalPlataforma(item) {
    return moedaParaNumero(item.faturamento) + moedaParaNumero(item.valor_reembolso);
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setPagina("novo-lancamento")}
          className="w-10 h-10 rounded-xl border border-gray-700 hover:bg-white/5 flex items-center justify-center"
        >
          <FiArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-3xl font-bold">Nova Entrada</h1>
      </div>

      <div className="mt-8 bg-[#111827] border border-gray-800 rounded-2xl p-6">
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
              className="w-full mt-2 bg-[#0B1120] border border-gray-700 rounded-xl p-3"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold">
            Qual(is) plataforma(s) você trabalhou?
          </h2>

          <button
            type="button"
            onClick={() => setModalGerenciarAberto(true)}
            className="bg-[#0B1120] hover:bg-green-500 hover:text-black border border-gray-700 hover:border-green-500 text-green-400 font-bold rounded-xl px-5 py-3 transition whitespace-nowrap"
          >
            + Gerenciar
          </button>
        </div>

        {plataformas.length === 0 ? (
          <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-400">
              Nenhuma plataforma visível. Clique no lápis para mostrar alguma plataforma.
            </p>
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
    <img
      src={config.imagem}
      alt=""
      className="w-8 h-8 object-contain"
    />
  ) : (
    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gray-700 text-gray-300 font-bold text-xs">
      {iniciais(plataforma.nome)}
    </span>
  )}
</span>
                      <span className="font-semibold text-sm text-gray-300 truncate">
                        {plataforma.nome}
                      </span>
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#0B1120] overflow-hidden shrink-0">
    {config?.imagem ? (
      <img
        src={config.imagem}
        alt=""
        className="w-8 h-8 object-contain"
      />
    ) : (
      <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-green-500 text-black font-bold text-xs">
        {iniciais(selecionada.nome)}
      </span>
    )}
  </span>

  <h3 className="font-bold text-green-400">
    {selecionada.nome}
  </h3>
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

                      <p className="text-2xl font-bold mt-3">
                        {formatarMoeda(totalPlataforma(selecionada))}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        {selecionada.numero_corridas || 0} corrida(s)
                      </p>

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

      <div className="grid grid-cols-2 gap-4 mt-8">
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
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={data}
        onChange={async (novaData) => {
          setData(novaData);
          setSelecionadas([]);
          await carregarLancamentosDoDia(novaData);
        }}
        onClose={() => setModalDataAberto(false)}
      />

      <TimePickerModal
        aberto={modalTempoAberto}
        valor={`${tempoPicker.hora}:${tempoPicker.minuto}`}
        onChange={(valor) => {
          const [hora, minuto] = valor.split(":");
          setTempoPicker({ hora, minuto });
        }}
        onClose={() => setModalTempoAberto(false)}
      />

      <PlataformaEntradaModal
        aberto={modalDadosPlataformaAberto}
        plataforma={plataformaEditando}
        dadosIniciais={
          plataformaEditando ? dadosDaPlataforma(plataformaEditando.id) : null
        }
        lancamentoAnterior={
          plataformaEditando ? lancamentosDoDia[String(plataformaEditando.id)] || null : null
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
    </div>
  );
}
