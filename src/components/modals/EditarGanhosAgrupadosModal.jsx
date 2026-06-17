import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiSave, FiTrash2 } from "react-icons/fi";
import { supabase } from "../../services/supabase";
import ModalBase from "./ModalBase";
import FeedbackModal from "./FeedbackModal";
import DatePickerModal from "./DatePickerModal";
import TimePickerModal from "./TimePickerModal";
import { obterConfigPlataforma } from "../../utils/plataformasIcons";

function numero(valor) {
  if (typeof valor === "number") return valor;
  if (valor === null || valor === undefined || valor === "") return 0;

  const texto = String(valor).trim();

  if (texto.includes(",")) {
    return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
  }

  return Number(texto) || 0;
}

function numeroParaCampo(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarDataBR(data) {
  if (!data) return "Selecionar";
  const [ano, mes, dia] = String(data).split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHoraSemSegundos(valor) {
  if (!valor) return "00:00";
  const partes = String(valor).split(":");
  return `${partes[0] || "00"}:${partes[1] || "00"}`;
}

function normalizarTurnos(grupo) {
  return (grupo?.dadosOriginais?.turnos || [])
    .map((turno) => ({
      ...turno,
      dadosOriginais: {
        ...(turno.dadosOriginais || {}),
        entrada_plataformas: [...(turno.dadosOriginais?.entrada_plataformas || [])],
      },
    }))
    .sort((a, b) => {
      const dataA = new Date(a.created_at || `${a.data}T00:00:00`).getTime();
      const dataB = new Date(b.created_at || `${b.data}T00:00:00`).getTime();
      if (dataA !== dataB) return dataA - dataB;
      return Number(a.idOriginal || 0) - Number(b.idOriginal || 0);
    })
    .map((turno) => ({
      id: turno.id,
      idOriginal: turno.idOriginal,
      novo: false,
      data: turno.dadosOriginais?.data || turno.data || "",
      km_rodados: String(Math.round(Number(turno.dadosOriginais?.km_rodados || 0))),
      horas_trabalhadas: formatarHoraSemSegundos(turno.dadosOriginais?.horas_trabalhadas),
      conta_id: turno.dadosOriginais?.conta_id || null,
      veiculo_id: turno.dadosOriginais?.veiculo_id || null,
      contaDestino: turno.contaDestino || turno.dadosOriginais?.contas?.nome || "Conta",
      plataformas: (turno.dadosOriginais?.entrada_plataformas || []).map((item) => ({
        id: item.id,
        plataforma_id: item.plataforma_id || item.plataformas?.id,
        nome: item.plataformas?.nome || "Plataforma",
        faturamento: numeroParaCampo(item.faturamento),
        numero_corridas: String(Number(item.numero_corridas || 0)),
        houve_pedagio: Boolean(item.houve_pedagio),
        valor_reembolso: numeroParaCampo(item.valor_reembolso),
      })),
    }));
}

export default function EditarGanhosAgrupadosModal({
  aberto,
  grupo,
  focoTurnoId = null,
  onClose,
  onSalvo,
}) {
  const [turnos, setTurnos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalHora, setModalHora] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
    fecharDepois: false,
  });

  useEffect(() => {
    if (!aberto) return;
    setTurnos(normalizarTurnos(grupo));
  }, [aberto, grupo]);

  useEffect(() => {
    if (!aberto || !focoTurnoId) return;
    setTimeout(() => {
      const elemento = document.getElementById(`turno-edicao-${String(focoTurnoId).replace(/[^a-zA-Z0-9-_]/g, "")}`);
      elemento?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [aberto, focoTurnoId]);

  const resumo = useMemo(() => {
    const totalKm = turnos.reduce((soma, turno) => soma + numero(turno.km_rodados), 0);
    const totalMinutos = turnos.reduce((soma, turno) => {
      const [h = 0, m = 0] = String(turno.horas_trabalhadas || "00:00").split(":").map(Number);
      return soma + (Number(h || 0) * 60) + Number(m || 0);
    }, 0);

    const plataformas = {};

    for (const turno of turnos) {
      for (const plataforma of turno.plataformas || []) {
        const chave = String(plataforma.plataforma_id || plataforma.nome || plataforma.id);
        if (!plataformas[chave]) {
          plataformas[chave] = {
            nome: plataforma.nome || "Plataforma",
            faturamento: 0,
            corridas: 0,
            reembolso: 0,
          };
        }

        plataformas[chave].faturamento += numero(plataforma.faturamento);
        plataformas[chave].corridas += numero(plataforma.numero_corridas);
        plataformas[chave].reembolso += numero(plataforma.valor_reembolso);
      }
    }

    const totalFaturado = Object.values(plataformas).reduce(
      (soma, item) => soma + item.faturamento + item.reembolso,
      0,
    );

    return {
      totalKm,
      horas: `${String(Math.floor(totalMinutos / 60)).padStart(2, "0")}:${String(totalMinutos % 60).padStart(2, "0")}`,
      plataformas: Object.values(plataformas),
      totalFaturado,
    };
  }, [turnos]);

  if (!aberto) return null;

  function atualizarTurno(index, campo, valor) {
    setTurnos((atuais) =>
      atuais.map((turno, i) => (i === index ? { ...turno, [campo]: valor } : turno)),
    );
  }

  function atualizarPlataforma(indexTurno, indexPlataforma, campo, valor) {
    setTurnos((atuais) =>
      atuais.map((turno, i) => {
        if (i !== indexTurno) return turno;

        return {
          ...turno,
          plataformas: turno.plataformas.map((plataforma, pIndex) =>
            pIndex === indexPlataforma ? { ...plataforma, [campo]: valor } : plataforma,
          ),
        };
      }),
    );
  }

  function pedirExclusaoTurno(indexTurno) {
    setConfirmarExclusao({ indexTurno, turno: turnos[indexTurno] });
  }

  async function confirmarExcluirTurno() {
    const indexTurno = confirmarExclusao?.indexTurno;
    const turno = confirmarExclusao?.turno;
    if (indexTurno === undefined || !turno) return;

    setSalvando(true);

    try {
      if (turno.idOriginal) {
        const { error: erroDetalhes } = await supabase
          .from("entrada_plataformas")
          .delete()
          .eq("entrada_id", turno.idOriginal);

        if (erroDetalhes) throw erroDetalhes;

        const { error: erroEntrada } = await supabase
          .from("entradas")
          .delete()
          .eq("id", turno.idOriginal);

        if (erroEntrada) throw erroEntrada;
      }

      setTurnos((atuais) => atuais.filter((_, index) => index !== indexTurno));
      setConfirmarExclusao(null);
      await onSalvo?.();

      setFeedback({
        aberto: true,
        tipo: "sucesso",
        titulo: "Turno excluído",
        mensagem: "O turno foi removido. Você pode continuar editando os demais turnos.",
        fecharDepois: false,
      });
    } catch (erro) {
      console.error("Erro ao excluir turno:", erro);
      setFeedback({
        aberto: true,
        tipo: "erro",
        titulo: "Erro ao excluir",
        mensagem: erro.message || "Não foi possível excluir este turno.",
        fecharDepois: false,
      });
    } finally {
      setSalvando(false);
    }
  }

  function adicionarTurno() {
    const base = turnos[turnos.length - 1] || turnos[0];
    if (!base) return;

    const novoTurno = {
      ...base,
      id: `novo-${Date.now()}`,
      idOriginal: null,
      novo: true,
      km_rodados: "0",
      horas_trabalhadas: "00:00",
      plataformas: (base.plataformas || []).map((plataforma) => ({
        ...plataforma,
        id: null,
        faturamento: numeroParaCampo(0),
        numero_corridas: "0",
        valor_reembolso: numeroParaCampo(0),
        houve_pedagio: false,
      })),
    };

    setTurnos((atuais) => [...atuais, novoTurno]);
  }

  async function salvarAlteracoes() {
    if (turnos.length === 0) {
      setFeedback({
        aberto: true,
        tipo: "erro",
        titulo: "Nenhum turno",
        mensagem: "Não há turnos para salvar.",
        fecharDepois: false,
      });
      return;
    }

    setSalvando(true);

    try {
      for (const turno of turnos) {
        let entradaId = turno.idOriginal;

        if (entradaId) {
          const { error: erroEntrada } = await supabase
            .from("entradas")
            .update({
              data: turno.data,
              km_rodados: numero(turno.km_rodados),
              horas_trabalhadas: `${turno.horas_trabalhadas || "00:00"}:00`,
            })
            .eq("id", entradaId);

          if (erroEntrada) throw erroEntrada;
        } else {
          const { data: entradaCriada, error: erroEntrada } = await supabase
            .from("entradas")
            .insert({
              data: turno.data,
              km_rodados: numero(turno.km_rodados),
              horas_trabalhadas: `${turno.horas_trabalhadas || "00:00"}:00`,
              conta_id: turno.conta_id,
              veiculo_id: turno.veiculo_id,
            })
            .select("id")
            .single();

          if (erroEntrada) throw erroEntrada;
          entradaId = entradaCriada.id;
        }

        for (const plataforma of turno.plataformas || []) {
          const dadosPlataforma = {
            entrada_id: entradaId,
            plataforma_id: plataforma.plataforma_id,
            faturamento: numero(plataforma.faturamento),
            numero_corridas: numero(plataforma.numero_corridas),
            houve_pedagio: Boolean(plataforma.houve_pedagio),
            valor_reembolso: numero(plataforma.valor_reembolso),
          };

          const { error: erroPlataforma } = plataforma.id
            ? await supabase.from("entrada_plataformas").update(dadosPlataforma).eq("id", plataforma.id)
            : await supabase.from("entrada_plataformas").insert(dadosPlataforma);

          if (erroPlataforma) throw erroPlataforma;
        }
      }

      await onSalvo?.();
      setFeedback({
        aberto: true,
        tipo: "sucesso",
        titulo: "Ganhos atualizados",
        mensagem: "Os turnos foram atualizados com sucesso.",
        fecharDepois: true,
      });
    } catch (erro) {
      console.error("Erro ao salvar turnos:", erro);
      setFeedback({
        aberto: true,
        tipo: "erro",
        titulo: "Erro ao salvar",
        mensagem: erro.message || "Não foi possível salvar os turnos.",
        fecharDepois: false,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Editar ganhos do dia"
        descricao={`${turnos.length} turno(s) agrupado(s). O resumo é calculado automaticamente pela soma dos turnos.`}
        onClose={onClose}
        largura="max-w-5xl"
        rodape={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-2xl p-4 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvarAlteracoes}
              disabled={salvando}
              className="bg-green-500 hover:bg-green-600 text-black font-black rounded-2xl p-4 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FiSave /> {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-5">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Resumo do dia</p>
            <p className="text-3xl font-black text-green-400 mt-2">+ {formatarMoeda(resumo.totalFaturado)}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              <ResumoItem titulo="KM total" valor={`${resumo.totalKm.toLocaleString("pt-BR")} km`} />
              <ResumoItem titulo="Horas totais" valor={resumo.horas} />
              <ResumoItem titulo="Turnos" valor={String(turnos.length)} />
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Plataformas</p>
              {resumo.plataformas.map((item) => {
                const config = obterConfigPlataforma(item.nome);

                return (
                  <div key={item.nome} className="flex items-center justify-between gap-3 rounded-xl bg-[#111827] border border-gray-800 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {config?.imagem ? (
                        <img src={config.imagem} alt={item.nome} className="w-9 h-9 object-contain shrink-0 rounded-lg" />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-black truncate">{item.nome}</p>
                        <p className="text-xs text-gray-500">{item.corridas} corrida(s) • Reembolso {formatarMoeda(item.reembolso)}</p>
                      </div>
                    </div>
                    <p className="font-black text-green-400 whitespace-nowrap">{formatarMoeda(item.faturamento + item.reembolso)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Turnos</h3>
                <p className="text-xs text-gray-500 font-bold mt-1">Edite cada turno separado</p>
              </div>

              <button
                type="button"
                onClick={adicionarTurno}
                disabled={salvando || turnos.length === 0}
                className="px-3 py-2 rounded-xl border border-green-500/50 text-green-400 hover:bg-green-500/10 font-black text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <FiPlus /> Turno
              </button>
            </div>

            {turnos.map((turno, indexTurno) => {
              const idSeguro = String(turno.id || indexTurno).replace(/[^a-zA-Z0-9-_]/g, "");

              return (
                <div
                  key={turno.id || indexTurno}
                  id={`turno-edicao-${idSeguro}`}
                  className={`rounded-2xl border p-4 sm:p-5 ${String(turno.id) === String(focoTurnoId) ? "border-green-400 bg-green-500/5" : "border-gray-800 bg-[#0B1120]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Turno {indexTurno + 1}</p>
                      <h4 className="font-black mt-1">{turno.plataformas.map((p) => p.nome).join(", ") || "Plataforma"}</h4>
                    </div>

                    {turnos.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => pedirExclusaoTurno(indexTurno)}
                        disabled={salvando}
                        className="w-10 h-10 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center justify-center disabled:opacity-50"
                        title="Excluir turno"
                        aria-label="Excluir turno"
                      >
                        <FiTrash2 />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <Campo label="Data">
                      <button
                        type="button"
                        onClick={() => setModalData({ indexTurno, valor: turno.data })}
                        className="input-modal text-left"
                      >
                        {formatarDataBR(turno.data)}
                      </button>
                    </Campo>
                    <Campo label="Horas trabalhadas">
                      <button
                        type="button"
                        onClick={() => setModalHora({ indexTurno, valor: turno.horas_trabalhadas })}
                        className="input-modal text-left"
                      >
                        {turno.horas_trabalhadas || "00:00"}
                      </button>
                    </Campo>
                    <Campo label="KM rodados">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={turno.km_rodados || ""}
                        onChange={(e) => atualizarTurno(indexTurno, "km_rodados", e.target.value.replace(/\D/g, ""))}
                        className="input-modal"
                      />
                    </Campo>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(turno.plataformas || []).map((plataforma, indexPlataforma) => {
                      const config = obterConfigPlataforma(plataforma.nome);

                      return (
                        <div key={plataforma.id || indexPlataforma} className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
                          <div className="flex items-center gap-3">
                            {config?.imagem ? (
                              <img src={config.imagem} alt={plataforma.nome} className="w-10 h-10 object-contain rounded-lg shrink-0" />
                            ) : null}
                            <p className="font-black">{plataforma.nome}</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                            <Campo label="Faturamento">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={plataforma.faturamento || ""}
                                onChange={(e) => atualizarPlataforma(indexTurno, indexPlataforma, "faturamento", e.target.value)}
                                onBlur={(e) => atualizarPlataforma(indexTurno, indexPlataforma, "faturamento", numeroParaCampo(numero(e.target.value)))}
                                className="input-modal"
                              />
                            </Campo>
                            <Campo label="Corridas">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={plataforma.numero_corridas || ""}
                                onChange={(e) => atualizarPlataforma(indexTurno, indexPlataforma, "numero_corridas", e.target.value.replace(/\D/g, ""))}
                                className="input-modal"
                              />
                            </Campo>
                            <Campo label="Reembolso">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={plataforma.valor_reembolso || ""}
                                onChange={(e) => atualizarPlataforma(indexTurno, indexPlataforma, "valor_reembolso", e.target.value)}
                                onBlur={(e) => atualizarPlataforma(indexTurno, indexPlataforma, "valor_reembolso", numeroParaCampo(numero(e.target.value)))}
                                className="input-modal"
                              />
                            </Campo>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <style>{`
          .input-modal {
            width: 100%;
            background: #111827;
            border: 1px solid rgb(55 65 81);
            border-radius: 0.75rem;
            padding: 0.75rem;
            outline: none;
            color: white;
            font-weight: 700;
            min-height: 50px;
          }
          .input-modal:focus {
            border-color: rgb(74 222 128);
          }
        `}</style>
      </ModalBase>

      <DatePickerModal
        aberto={!!modalData}
        valor={modalData?.valor || ""}
        onChange={(novaData) => {
          if (modalData?.indexTurno !== undefined) {
            atualizarTurno(modalData.indexTurno, "data", novaData);
          }
          setModalData(null);
        }}
        onClose={() => setModalData(null)}
      />

      <TimePickerModal
        aberto={!!modalHora}
        valor={modalHora?.valor || "00:00"}
        onChange={(novoHorario) => {
          if (modalHora?.indexTurno !== undefined) {
            atualizarTurno(modalHora.indexTurno, "horas_trabalhadas", novoHorario);
          }
          setModalHora(null);
        }}
        onClose={() => setModalHora(null)}
      />

      <ModalBase
        aberto={!!confirmarExclusao}
        titulo="Excluir turno"
        descricao="Essa ação não poderá ser desfeita."
        onClose={() => setConfirmarExclusao(null)}
        largura="max-w-md"
        z="z-[140]"
        rodape={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmarExclusao(null)}
              disabled={salvando}
              className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-2xl p-3 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarExcluirTurno}
              disabled={salvando}
              className="bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl p-3 disabled:opacity-50"
            >
              {salvando ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        }
      >
        <p className="text-gray-300">
          Tem certeza que deseja excluir o turno {confirmarExclusao?.indexTurno + 1}?
        </p>
      </ModalBase>

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={() => {
          const fecharDepois = feedback.fecharDepois;
          setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "", fecharDepois: false });
          if (fecharDepois) onClose?.();
        }}
      />
    </>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function ResumoItem({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-3">
      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">{titulo}</p>
      <p className="font-black mt-1">{valor}</p>
    </div>
  );
}
