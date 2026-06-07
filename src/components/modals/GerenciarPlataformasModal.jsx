import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../services/supabase";
import ModalBase from "./ModalBase";
import { FiSearch, FiTrash2 } from "react-icons/fi";
import { obterConfigPlataforma } from "../../utils/plataformasIcons";

export default function GerenciarPlataformasModal({ aberto, onClose }) {
  const [plataformas, setPlataformas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvandoId, setSalvandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [itemAberto, setItemAberto] = useState(null);

  useEffect(() => {
    if (aberto) carregarPlataformas();
  }, [aberto]);

  const plataformasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return plataformas;

    return plataformas.filter((plataforma) =>
      String(plataforma.nome || "").toLowerCase().includes(termo)
    );
  }, [plataformas, busca]);

  const nomeExiste = plataformas.some(
    (plataforma) =>
      String(plataforma.nome || "").trim().toLowerCase() ===
      busca.trim().toLowerCase()
  );

  const podeCriar =
    busca.trim().length > 0 &&
    plataformasFiltradas.length === 0 &&
    !nomeExiste;

  if (!aberto) return null;

  async function carregarPlataformas() {
    setCarregando(true);

    const { data, error } = await supabase
  .from("plataformas")
  .select("*")
  .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao carregar plataformas:", error);
      alert("Erro ao carregar plataformas.");
    }

    setPlataformas(data || []);
    setCarregando(false);
  }

  async function criarPlataforma() {
    const nome = busca.trim();
    if (!nome) return;

    setCriando(true);

    const { error } = await supabase.from("plataformas").insert({
      nome,
      visivel: true,
    });

    if (error) {
      console.error("Erro ao criar plataforma:", error);
      alert("Erro ao criar plataforma.");
      setCriando(false);
      return;
    }

    setBusca("");
    await carregarPlataformas();
    setCriando(false);
  }

  async function alternarVisibilidade(plataforma) {
    if (salvandoId) return;

    setSalvandoId(plataforma.id);

    const { error } = await supabase
      .from("plataformas")
      .update({ visivel: !plataforma.visivel })
      .eq("id", plataforma.id);

    if (error) {
      console.error("Erro ao atualizar plataforma:", error);
      alert("Erro ao atualizar plataforma.");
      setSalvandoId(null);
      return;
    }

    setPlataformas((listaAtual) =>
      listaAtual.map((item) =>
        item.id === plataforma.id
          ? { ...item, visivel: !plataforma.visivel }
          : item
      )
    );

    setSalvandoId(null);
  }

  async function excluirPlataforma() {
    if (!confirmarExclusao) return;

    setExcluindo(true);

    const { count, error: erroUso } = await supabase
      .from("entrada_plataformas")
      .select("id", { count: "exact", head: true })
      .eq("plataforma_id", confirmarExclusao.id);

    if (erroUso) {
      console.error("Erro ao verificar uso da plataforma:", erroUso);
      alert("Erro ao verificar se a plataforma já foi usada.");
      setExcluindo(false);
      return;
    }

    if (count > 0) {
      alert("Essa plataforma já foi usada em lançamentos. Você pode apenas ocultá-la.");
      setConfirmarExclusao(null);
      setItemAberto(null);
      setExcluindo(false);
      return;
    }

    const { error } = await supabase
      .from("plataformas")
      .delete()
      .eq("id", confirmarExclusao.id);

    if (error) {
      console.error("Erro ao apagar plataforma:", error);
      alert("Erro ao apagar plataforma.");
      setExcluindo(false);
      return;
    }

    setPlataformas((listaAtual) =>
      listaAtual.filter((item) => item.id !== confirmarExclusao.id)
    );

    setConfirmarExclusao(null);
    setItemAberto(null);
    setExcluindo(false);
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        titulo="Gerenciar Plataformas"
        descricao="Ative, oculte ou adicione plataformas que você trabalha no dia a dia."
        onClose={onClose}
        largura="max-w-lg"
        z="z-[300]"
      >
          <div className="relative mt-6">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />

            <input
              type="text"
              value={busca}
              placeholder="Buscar ou adicionar plataforma..."
              onChange={(e) => {
                setBusca(e.target.value);
                setItemAberto(null);
              }}
              className="w-full bg-[#0B1120] border border-gray-700 focus:border-green-400 outline-none rounded-xl py-3 pl-11 pr-4"
            />
          </div>

          {podeCriar && (
            <button
              type="button"
              onClick={criarPlataforma}
              disabled={criando}
              className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              {criando ? "Adicionando..." : `+ Adicionar "${busca.trim()}"`}
            </button>
          )}

          <div className="mt-5 space-y-3">
            {carregando && (
              <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400">Carregando plataformas...</p>
              </div>
            )}

            {!carregando && plataformasFiltradas.length === 0 && !podeCriar && (
              <div className="bg-[#0B1120] border border-gray-800 rounded-xl p-4">
                <p className="text-gray-400">Nenhuma plataforma encontrada.</p>
              </div>
            )}

            {plataformasFiltradas.map((plataforma) => (
              <PlataformaLinha
                key={plataforma.id}
                plataforma={plataforma}
                ativa={plataforma.visivel}
                aberta={itemAberto === plataforma.id}
                abrir={() => setItemAberto(plataforma.id)}
                fechar={() => setItemAberto(null)}
                alternar={() => alternarVisibilidade(plataforma)}
                pedirExclusao={() => setConfirmarExclusao(plataforma)}
              />
            ))}
          </div>

          <div className="sticky bottom-0 z-10 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              Concluir
            </button>
          </div>

      </ModalBase>

      {confirmarExclusao && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-red-400">Apagar plataforma</h2>

            <p className="text-gray-300 mt-4">
              Deseja apagar "{confirmarExclusao.nome}"?
            </p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setConfirmarExclusao(null);
                  setItemAberto(null);
                }}
                className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={excluirPlataforma}
                disabled={excluindo}
                className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl p-3"
              >
                {excluindo ? "Apagando..." : "Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlataformaLinha({
  plataforma,
  ativa,
  aberta,
  abrir,
  fechar,
  alternar,
  pedirExclusao,
}) {
  const [inicioX, setInicioX] = useState(null);
  const [deltaX, setDeltaX] = useState(0);
  const bloqueouClick = useRef(false);

  const larguraAcao = 76;
  const config = obterConfigPlataforma(plataforma.nome);

  function iniciarArrasto(x) {
    setInicioX(x);
    setDeltaX(0);
    bloqueouClick.current = false;
  }

  function moverArrasto(x) {
    if (inicioX === null) return;

    const delta = x - inicioX;

    if (Math.abs(delta) > 6) bloqueouClick.current = true;

    if (delta < 0) {
      setDeltaX(Math.max(delta, -larguraAcao));
    } else if (aberta) {
      setDeltaX(Math.min(delta - larguraAcao, 0));
    }
  }

  function terminarArrasto() {
    if (deltaX <= -38) abrir();
    else fechar();

    setInicioX(null);
    setDeltaX(0);
  }

  function handleClick() {
    if (bloqueouClick.current) {
      bloqueouClick.current = false;
      return;
    }

    if (aberta) {
      fechar();
      return;
    }

    alternar();
  }

  const deslocamento = inicioX !== null ? deltaX : aberta ? -larguraAcao : 0;
  const mostrandoLixeira = aberta || deslocamento < -4;

  return (
    <div className="relative overflow-hidden rounded-xl bg-transparent">
      {mostrandoLixeira && (
        <button
          type="button"
          onClick={pedirExclusao}
          className="absolute inset-y-0 right-0 w-[76px] bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-2xl font-bold rounded-xl"
        >
          <FiTrash2 className="w-6 h-6" />
        </button>
      )}

      <button
        type="button"
        onClick={handleClick}
        onMouseDown={(e) => iniciarArrasto(e.clientX)}
        onMouseMove={(e) => moverArrasto(e.clientX)}
        onMouseUp={terminarArrasto}
        onMouseLeave={() => {
          if (inicioX !== null) terminarArrasto();
        }}
        onTouchStart={(e) => iniciarArrasto(e.touches[0].clientX)}
        onTouchMove={(e) => moverArrasto(e.touches[0].clientX)}
        onTouchEnd={terminarArrasto}
        className={`relative z-10 w-full bg-[#0B1120] border rounded-xl p-4 flex items-center justify-between gap-4 select-none ${
          ativa ? "border-gray-700 opacity-100" : "border-gray-800 opacity-45"
        }`}
        style={{
          transform: `translateX(${deslocamento}px)`,
          transition: inicioX === null ? "transform 180ms ease" : "none",
          touchAction: "pan-y",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-[#0B1120]">
            {config?.imagem ? (
              <img
                src={config.imagem}
                alt=""
                className={`w-8 h-8 object-contain ${!ativa ? "grayscale opacity-60" : ""}`}
              />
            ) : (
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                  ativa ? "bg-green-500 text-black" : "bg-gray-800 text-gray-500"
                }`}
              >
                {plataforma.nome
                  .split(" ")
                  .map((parte) => parte[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            )}
          </div>

          <p className={`font-bold truncate ${ativa ? "text-white" : "text-gray-500"}`}>
            {plataforma.nome}
          </p>
        </div>

        <div
          className={`relative w-14 h-8 rounded-full transition shrink-0 ${
            ativa ? "bg-green-500" : "bg-gray-700"
          }`}
        >
          <span
            className={`absolute top-1 w-6 h-6 rounded-full bg-white transition ${
              ativa ? "left-7" : "left-1"
            }`}
          />
        </div>
      </button>
    </div>
  );
}
