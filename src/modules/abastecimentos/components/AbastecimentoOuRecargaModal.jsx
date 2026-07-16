import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../services/supabase";

import ModalBase from "../../../shared/components/modals/ModalBase";
import AbastecimentoModal from "./AbastecimentoModal";
import RecargaEletricaModal from "./RecargaEletricaModal";

export default function AbastecimentoOuRecargaModal({ aberto, onClose, edicao = null, onSalvo = null }) {
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState("menu");

  useEffect(() => {
    if (!aberto) return;

    if (edicao?.abastecimento) {
      setEtapa("abastecimento");
    } else if (edicao?.recargaEletrica) {
      setEtapa("recarga");
    } else {
      setEtapa("menu");
    }
    carregarVeiculos();
  }, [aberto, edicao?.id]);

  const veiculosCombustao = useMemo(
    () =>
      veiculos.filter(
        (veiculo) => (veiculo.combustiveis_aceitos || []).length > 0
      ),
    [veiculos]
  );

  const veiculosEletricos = useMemo(
    () => veiculos.filter((veiculo) => veiculo.aceita_recarga_eletrica),
    [veiculos]
  );

  const podeAbastecer = veiculosCombustao.length > 0;
  const podeRecarregar = veiculosEletricos.length > 0;

  async function carregarVeiculos() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("veiculos")
      .select("*")
      .eq("ativo", true)
      .order("id");

    if (error) {
      console.error(error);
      setVeiculos([]);
      setCarregando(false);
      return;
    }

    const lista = data || [];
    setVeiculos(lista);
    setCarregando(false);

    const combustao = lista.filter(
      (veiculo) => (veiculo.combustiveis_aceitos || []).length > 0
    );

    const eletricos = lista.filter((veiculo) => veiculo.aceita_recarga_eletrica);

    if (combustao.length > 0 && eletricos.length === 0) {
      setEtapa("abastecimento");
      return;
    }

    if (eletricos.length > 0 && combustao.length === 0) {
      setEtapa("recarga");
      return;
    }

    setEtapa("menu");
  }

  function fecharTudo() {
    setEtapa("menu");
    onClose();
  }

  if (!aberto) return null;

  if (etapa === "abastecimento") {
    return (
      <AbastecimentoModal
        aberto={aberto}
        onClose={fecharTudo}
        veiculosPermitidos={veiculosCombustao}
        edicao={edicao}
        onSalvo={onSalvo}
      />
    );
  }

  if (etapa === "recarga") {
    return (
      <RecargaEletricaModal
        aberto={aberto}
        onClose={fecharTudo}
        veiculosPermitidos={veiculosEletricos}
        edicao={edicao}
        onSalvo={onSalvo}
      />
    );
  }

  return (
    <ModalBase
      aberto={aberto}
      titulo="Abastecimento / Recarga"
      descricao="Escolha o tipo de lançamento conforme o veículo."
      onClose={fecharTudo}
      largura="max-w-2xl"
    >
      {carregando && (
        <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400">Carregando veículos...</p>
        </div>
      )}

      {!carregando && veiculos.length === 0 && (
        <div className="bg-[#0B1120] border border-yellow-500/40 rounded-2xl p-5">
          <h3 className="font-bold text-yellow-400">
            Nenhum veículo cadastrado
          </h3>

          <p className="text-gray-400 mt-2">
            Cadastre um veículo ativo antes de registrar abastecimento ou recarga.
          </p>
        </div>
      )}

      {!carregando && veiculos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {podeAbastecer && (
            <button
              type="button"
              onClick={() => setEtapa("abastecimento")}
              className="rounded-2xl border border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 p-6 text-left transition"
            >
              <div className="text-3xl">⛽</div>

              <h3 className="text-xl font-bold text-white mt-4">
                Abastecimento
              </h3>

              <p className="text-gray-400 text-sm mt-2">
                Etanol, gasolina, diesel ou GNV.
              </p>

              <p className="text-xs text-gray-500 mt-4">
                {veiculosCombustao.length} veículo(s) disponível(is).
              </p>
            </button>
          )}

          {podeRecarregar && (
            <button
              type="button"
              onClick={() => setEtapa("recarga")}
              className="rounded-2xl border border-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20 p-6 text-left transition"
            >
              <div className="text-3xl">🔋</div>

              <h3 className="text-xl font-bold text-white mt-4">
                Recarga elétrica
              </h3>

              <p className="text-gray-400 text-sm mt-2">
                Elétrico ou híbrido plug-in.
              </p>

              <p className="text-xs text-gray-500 mt-4">
                {veiculosEletricos.length} veículo(s) disponível(is).
              </p>
            </button>
          )}
        </div>
      )}
    </ModalBase>
  );
}

