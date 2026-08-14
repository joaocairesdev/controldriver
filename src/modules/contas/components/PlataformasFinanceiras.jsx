import { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch, FiSettings, FiTrash2, FiTrendingUp } from "react-icons/fi";

import ConfirmacaoModal from "../../../shared/components/modals/ConfirmacaoModal";
import FeedbackModal from "../../../shared/components/modals/FeedbackModal";
import DatePickerModal from "../../../shared/components/modals/DatePickerModal";
import ModalBase from "../../../shared/components/modals/ModalBase";
import SelecionarContaModal from "../../../shared/components/modals/SelecionarContaModal";
import SelecionarOpcaoModal from "../../../shared/components/modals/SelecionarOpcaoModal";
import ToggleSwitch from "../../../shared/components/ui/ToggleSwitch";
import { ButtonField, Campo } from "../../../shared/components/ui/FormControls";
import {
  formatarMoeda,
  formatarMoedaDigitada,
  moedaParaNumero,
  numeroParaMoedaInput,
} from "../../../shared/utils/moeda";
import { formatarDataBR, hojeBrasil } from "../../../shared/utils/data";
import { obterConfigPlataforma } from "../../entradas/utils/plataformasIcons";
import ExtratoPlataformaModal from "./ExtratoPlataformaModal";
import {
  carregarContasDestinoSaque,
  carregarPlataformasFinanceiras,
  editarSaquePlataforma,
  excluirSaquePlataforma,
  registrarSaquePlataforma,
  salvarConfiguracaoPlataforma,
  salvarParticipacaoPlataformaSaldoConsolidado,
} from "../services/plataformasFinanceiroService";
import {
  calcularValorLiquidoSaque,
  obterValorBrutoTransferencia,
  obterTaxaPadraoSaque,
} from "../utils/plataformasFinanceiro";

const TIPOS_SAQUE = [
  {
    valor: "semanal",
    titulo: "Recebimento semanal",
    descricao: "Recebimento semanal sem cobrança de taxa.",
  },
  {
    valor: "instantaneo",
    titulo: "Saque instantâneo",
    descricao: "Recebimento imediato, quando permitido pela plataforma.",
  },
  {
    valor: "agendado",
    titulo: "Saque agendado",
    descricao: "Recebimento conforme o processamento da plataforma.",
  },
];

const TIPO_SAQUE_LEGADO = {
  valor: "outro",
  titulo: "Outro",
  descricao: "Modalidade preservada apenas para saques já registrados.",
};

const DIAS_RECEBIMENTO = [
  { valor: "1", titulo: "Segunda-feira" },
  { valor: "2", titulo: "Terça-feira" },
  { valor: "3", titulo: "Quarta-feira" },
  { valor: "4", titulo: "Quinta-feira" },
  { valor: "5", titulo: "Sexta-feira" },
  { valor: "6", titulo: "Sábado" },
  { valor: "7", titulo: "Domingo" },
];

export default function PlataformasFinanceiras({ onMovimentacao }) {
  const [plataformas, setPlataformas] = useState([]);
  const [contasDestino, setContasDestino] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [plataformaSaque, setPlataformaSaque] = useState(null);
  const [plataformaExtrato, setPlataformaExtrato] = useState(null);
  const [saqueEdicao, setSaqueEdicao] = useState(null);
  const [atualizacaoExtratoKey, setAtualizacaoExtratoKey] = useState(0);
  const [plataformaConfig, setPlataformaConfig] = useState(null);
  const [modalSelecionarConfig, setModalSelecionarConfig] = useState(false);
  const [salvandoParticipacaoId, setSalvandoParticipacaoId] = useState(null);
  const [feedback, setFeedback] = useState({
    aberto: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });

  const carregarDados = useCallback(async () => {
    try {
      const [plataformasData, contasData] = await Promise.all([
        carregarPlataformasFinanceiras(),
        carregarContasDestinoSaque(),
      ]);
      setPlataformas(plataformasData);
      setContasDestino(contasData);
    } catch (error) {
      console.error("Erro ao carregar saldos das plataformas:", error);
      setPlataformas([]);
      setFeedback({
        aberto: true,
        tipo: "erro",
        titulo: "Erro ao carregar plataformas",
        mensagem:
          error.message || "Não foi possível carregar os saldos das plataformas.",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      carregarDados();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [carregarDados]);

  function abrirFeedback(tipo, titulo, mensagem) {
    setFeedback({ aberto: true, tipo, titulo, mensagem });
  }

  async function atualizarAposEdicao() {
    await carregarDados();
    await onMovimentacao?.();
    setAtualizacaoExtratoKey((atual) => atual + 1);
  }

  async function alternarParticipacaoSaldo(plataforma, participa) {
    setSalvandoParticipacaoId(plataforma.id);

    try {
      await salvarParticipacaoPlataformaSaldoConsolidado(plataforma.id, participa);
      setPlataformas((atuais) => atuais.map((item) => (
        item.id === plataforma.id
          ? { ...item, exibir_nas_contas: participa }
          : item
      )));
    } catch (error) {
      console.error("Erro ao atualizar participação da plataforma no saldo consolidado:", error);
      abrirFeedback(
        "erro",
        "Erro ao atualizar plataforma",
        error.message || "Não foi possível atualizar a participação no Saldo Consolidado.",
      );
    } finally {
      setSalvandoParticipacaoId(null);
    }
  }

  return (
    <>
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Plataformas</h2>
          <div className="h-px flex-1 border-t border-dashed border-gray-700" />
          <button
            type="button"
            onClick={() => setModalSelecionarConfig(true)}
            disabled={!plataformas.length}
            className="w-10 h-10 rounded-xl border border-gray-700 bg-[#0B1120] text-gray-400 hover:border-green-400 hover:text-green-400 disabled:opacity-40 flex items-center justify-center transition"
            title="Configurar plataformas"
            aria-label="Configurar plataformas"
          >
            <FiSettings />
          </button>
        </div>

        {carregando ? (
          <div className="mt-4 rounded-2xl border border-gray-800 bg-[#111827] p-5">
            <p className="text-sm text-gray-400">Carregando saldos das plataformas...</p>
          </div>
        ) : plataformas.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {plataformas.map((plataforma) => (
              <PlataformaCard
                key={plataforma.id}
                plataforma={plataforma}
                onAbrirExtrato={() => setPlataformaExtrato(plataforma)}
                onSacar={() => setPlataformaSaque(plataforma)}
                onConfigurar={() => setPlataformaConfig(plataforma)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-gray-800 bg-[#111827] p-5">
            <p className="text-sm text-gray-400">
              Nenhuma plataforma financeira encontrada.
            </p>
          </div>
        )}
      </section>

      <ListaConfiguracaoPlataformasModal
        aberto={modalSelecionarConfig}
        plataformas={plataformas}
        salvandoId={salvandoParticipacaoId}
        onAlternarParticipacao={alternarParticipacaoSaldo}
        onConfigurar={(plataforma) => {
          setModalSelecionarConfig(false);
          setPlataformaConfig(plataforma);
        }}
        onClose={() => setModalSelecionarConfig(false)}
      />

      {plataformaSaque ? (
        <SaquePlataformaModal
          key={plataformaSaque.id}
          plataforma={plataformaSaque}
          contas={contasDestino}
          onClose={() => setPlataformaSaque(null)}
          onSalvo={async () => {
            setPlataformaSaque(null);
            await carregarDados();
            await onMovimentacao?.();
            abrirFeedback(
              "sucesso",
              "Saque registrado",
              "A transferência e a taxa, quando informada, foram registradas no extrato.",
            );
          }}
        />
      ) : null}

      {plataformaConfig ? (
        <ConfiguracaoPlataformaModal
          key={plataformaConfig.id}
          plataforma={plataformaConfig}
          contas={contasDestino}
          onClose={() => setPlataformaConfig(null)}
          onSalvo={async () => {
            setPlataformaConfig(null);
            await carregarDados();
            abrirFeedback(
              "sucesso",
              "Configuração salva",
              "As regras financeiras da plataforma foram atualizadas.",
            );
          }}
        />
      ) : null}

      {plataformaExtrato ? (
        <ExtratoPlataformaModal
          aberto={true}
          plataforma={plataformaExtrato}
          contas={contasDestino}
          atualizacaoKey={atualizacaoExtratoKey}
          onClose={() => setPlataformaExtrato(null)}
          onEditarSaque={(movimentacao) => {
            if (movimentacao.dadosOriginais?.id) {
              setSaqueEdicao(movimentacao.dadosOriginais);
            }
          }}
          onAtualizado={async () => {
            await carregarDados();
            await onMovimentacao?.();
          }}
        />
      ) : null}

      {saqueEdicao && plataformaExtrato ? (
        <SaquePlataformaModal
          key={`editar-${saqueEdicao.id}`}
          plataforma={plataformaExtrato}
          contas={contasDestino}
          saque={saqueEdicao}
          onClose={() => setSaqueEdicao(null)}
          onSalvo={async () => {
            setSaqueEdicao(null);
            await atualizarAposEdicao();
            abrirFeedback(
              "sucesso",
              "Saque atualizado",
              "O saque, a transferência e a taxa foram atualizados com consistência.",
            );
          }}
          onExcluido={async () => {
            setSaqueEdicao(null);
            await atualizarAposEdicao();
            abrirFeedback(
              "sucesso",
              "Saque excluído",
              "O saque e a taxa vinculada foram removidos, e o valor retornou para a carteira.",
            );
          }}
        />
      ) : null}

      <FeedbackModal
        aberto={feedback.aberto}
        tipo={feedback.tipo}
        titulo={feedback.titulo}
        mensagem={feedback.mensagem}
        onClose={() => setFeedback((atual) => ({ ...atual, aberto: false }))}
      />
    </>
  );
}

function LogoPlataforma({ nome }) {
  const config = obterConfigPlataforma(nome);

  if (config?.imagem) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden">
        <img
          src={config.imagem}
          alt=""
          className="h-10 w-10 object-contain"
        />
      </span>
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center text-gray-400">
      <FiTrendingUp className="h-7 w-7" aria-hidden="true" />
    </span>
  );
}

function ListaConfiguracaoPlataformasModal({
  aberto,
  plataformas,
  salvandoId,
  onAlternarParticipacao,
  onConfigurar,
  onClose,
}) {
  const [busca, setBusca] = useState("");
  const plataformasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return plataformas;
    return plataformas.filter((plataforma) =>
      `${plataforma.nome} ${plataforma.id}`.toLocaleLowerCase("pt-BR").includes(termo)
    );
  }, [busca, plataformas]);

  function fechar() {
    setBusca("");
    onClose();
  }

  function selecionar(plataforma) {
    setBusca("");
    onConfigurar(plataforma);
  }

  return (
    <ModalBase
      aberto={aberto}
      titulo="Configurar plataforma"
      descricao="Toque no nome para configurar ou defina se a plataforma participa do Saldo Consolidado."
      onClose={fechar}
      largura="max-w-lg"
    >
      {plataformas.length > 8 ? (
        <div className="flex items-center rounded-xl border border-gray-700 bg-[#0B1120] focus-within:border-green-400">
          <FiSearch className="ml-3 text-gray-400" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar..."
            className="w-full bg-transparent p-3 outline-none"
            autoFocus
          />
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {plataformasFiltradas.map((plataforma) => {
          const participa = plataforma.exibir_nas_contas !== false;

          return (
            <div
              key={plataforma.id}
              className="flex min-h-20 items-center gap-3 rounded-2xl border border-gray-800 bg-[#0B1120] p-3"
            >
              <button
                type="button"
                onClick={() => selecionar(plataforma)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-label={`Configurar ${plataforma.nome}`}
              >
                <LogoPlataforma nome={plataforma.nome} />
                <span className="min-w-0">
                  <span className="block break-words font-bold leading-tight text-white">{plataforma.nome}</span>
                  <span className="mt-1 block text-xs text-gray-500">Participa do Saldo Consolidado</span>
                </span>
              </button>

              <span className="text-xs font-bold text-gray-400">{participa ? "Sim" : "Não"}</span>
              <ToggleSwitch
                ativo={participa}
                disabled={salvandoId === plataforma.id}
                onChange={(valor) => onAlternarParticipacao(plataforma, valor)}
                ariaLabel={`${plataforma.nome} participa do Saldo Consolidado: ${participa ? "Sim" : "Não"}`}
              />
            </div>
          );
        })}
        {plataformasFiltradas.length === 0 ? (
          <p className="py-8 text-center text-gray-400">Nenhuma opção encontrada.</p>
        ) : null}
      </div>
    </ModalBase>
  );
}

function PlataformaCard({ plataforma, onAbrirExtrato, onSacar, onConfigurar }) {
  const pendente = Number(plataforma.saldo || 0) < 0;
  const permiteSaque = Number(plataforma.saldo || 0) > 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onAbrirExtrato}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAbrirExtrato?.();
        }
      }}
      className={`flex h-full min-h-52 flex-col rounded-2xl border p-4 ${
        pendente
          ? "border-yellow-500/35 bg-yellow-500/10"
          : "border-gray-800 bg-[#111827]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <LogoPlataforma nome={plataforma.nome} />
          <h3 className="min-w-0 break-words text-base font-black leading-tight text-white">
            {plataforma.nome}
          </h3>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onConfigurar();
          }}
          className="w-9 h-9 rounded-xl border border-gray-700 text-gray-500 hover:border-green-400 hover:text-green-400 flex items-center justify-center transition shrink-0"
          title={`Configurar ${plataforma.nome}`}
          aria-label={`Configurar ${plataforma.nome}`}
        >
          <FiSettings />
        </button>
      </div>

      <div className="mt-5">
        <p className={`text-xs ${pendente ? "text-yellow-400" : "text-gray-500"}`}>
          {pendente ? "Saldo pendente de conciliação" : "Saldo disponível"}
        </p>
        <p className={`mt-1 text-[1.75rem] font-black leading-none ${pendente ? "text-yellow-300" : "text-white"}`}>
          {formatarMoeda(plataforma.saldo)}
        </p>
      </div>

      <button
        type="button"
        disabled={!permiteSaque}
        onClick={(event) => {
          event.stopPropagation();
          if (permiteSaque) onSacar();
        }}
        className={`mt-auto h-9 w-full rounded-xl text-sm font-black transition ${
          permiteSaque
            ? "bg-green-500 hover:bg-green-600 text-black"
            : "bg-gray-700 text-gray-400 cursor-not-allowed"
        }`}
      >
        Sacar
      </button>
    </article>
  );
}

function SaquePlataformaModal({
  plataforma,
  contas,
  saque = null,
  onClose,
  onSalvo,
  onExcluido,
}) {
  const emEdicao = Boolean(saque?.id);
  const [valor, setValor] = useState(() =>
    numeroParaMoedaInput(
      emEdicao
        ? obterValorBrutoTransferencia(saque)
        : Math.max(Number(plataforma.saldo || 0), 0),
    ),
  );
  const [contaDestinoId, setContaDestinoId] = useState(
    saque?.conta_destino_id
      ? String(saque.conta_destino_id)
      : plataforma.conta_destino_id
        ? String(plataforma.conta_destino_id)
        : "",
  );
  const tipoInicial = saque?.tipo_saque || "semanal";
  const [tipoSaque, setTipoSaque] = useState(tipoInicial);
  const [taxa, setTaxa] = useState(() =>
    numeroParaMoedaInput(
      tipoInicial === "semanal"
        ? 0
        : emEdicao
          ? Number(saque.taxa || 0)
          : obterTaxaPadraoSaque(plataforma, tipoInicial),
    ),
  );
  const [dataSaque, setDataSaque] = useState(saque?.data || hojeBrasil());
  const [modalData, setModalData] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [modalTipo, setModalTipo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [erroGeral, setErroGeral] = useState("");
  const tiposDisponiveis = emEdicao && saque?.tipo_saque === "outro"
    ? [...TIPOS_SAQUE, TIPO_SAQUE_LEGADO]
    : TIPOS_SAQUE;

  const contaDestino = contas.find(
    (conta) => String(conta.id) === String(contaDestinoId),
  );
  const valorBruto = moedaParaNumero(valor);
  const taxaNumero = moedaParaNumero(taxa);
  const valorLiquido = calcularValorLiquidoSaque(valorBruto, taxaNumero);

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
    setErroGeral("");
  }

  function selecionarTipo(novoTipo) {
    limparErro("tipoSaque");
    setTipoSaque(novoTipo);
    setTaxa(numeroParaMoedaInput(obterTaxaPadraoSaque(plataforma, novoTipo)));
  }

  function validar() {
    const novos = {};
    if (!dataSaque) novos.dataSaque = "Selecione a data do saque.";
    if (dataSaque > hojeBrasil()) novos.dataSaque = "A data do saque não pode ser futura.";
    if (valorBruto <= 0) novos.valor = "Informe um valor de saque maior que zero.";
    if (!contaDestinoId) novos.contaDestinoId = "Selecione a conta de destino.";
    if (!tipoSaque) novos.tipoSaque = "Selecione o tipo do saque.";
    if (taxaNumero < 0) novos.taxa = "A taxa não pode ser negativa.";
    if (taxaNumero > valorBruto) novos.taxa = "A taxa não pode superar o valor do saque.";
    setErros(novos);
    if (Object.keys(novos).length) setShakeKey((atual) => atual + 1);
    return Object.keys(novos).length === 0;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    setErroGeral("");

    try {
      const dadosSaque = {
        contaDestinoId,
        valorBruto,
        tipoSaque,
        taxa: taxaNumero,
        data: dataSaque,
      };

      if (emEdicao) {
        await editarSaquePlataforma({
          ...dadosSaque,
          transferenciaId: saque.id,
        });
      } else {
        await registrarSaquePlataforma({
          ...dadosSaque,
          plataformaId: plataforma.id,
        });
      }
      await onSalvo?.();
    } catch (error) {
      console.error("Erro ao registrar saque da plataforma:", error);
      setErroGeral(error.message || "Não foi possível registrar o saque.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!emEdicao || !saque?.id) return;
    setExcluindo(true);
    setErroGeral("");

    try {
      await excluirSaquePlataforma(saque.id);
      setConfirmarExclusao(false);
      setExcluindo(false);
      await onExcluido?.();
    } catch (error) {
      console.error("Erro ao excluir saque da plataforma:", error);
      setConfirmarExclusao(false);
      setExcluindo(false);
      setErroGeral(error.message || "Não foi possível excluir o saque.");
    }
  }

  return (
    <>
      <ModalBase
        aberto={true}
        titulo={emEdicao ? `Editar saque de ${plataforma.nome}` : `Sacar de ${plataforma.nome}`}
        descricao="O valor pode ser maior que o saldo conhecido; a diferença ficará pendente de conciliação."
        onClose={onClose}
        z={emEdicao ? "z-[200]" : "z-[100]"}
        largura="max-w-xl"
        confirmarAoFecharSeAlterado
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Data do saque" erro={erros.dataSaque} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.dataSaque}
              shakeKey={shakeKey}
              onClick={() => setModalData(true)}
            >
              {dataSaque ? formatarDataBR(dataSaque) : "Selecionar data"}
            </ButtonField>
          </Campo>

          <Campo label="Valor bruto" erro={erros.valor} shakeKey={shakeKey}>
            <MoneyInput
              value={valor}
              onChange={(novoValor) => {
                limparErro("valor");
                setValor(formatarMoedaDigitada(novoValor));
              }}
              erro={erros.valor}
              shakeKey={shakeKey}
            />
          </Campo>

          <Campo label="Taxa" erro={erros.taxa} shakeKey={shakeKey}>
            <MoneyInput
              value={taxa}
              disabled={tipoSaque === "semanal"}
              onChange={(novaTaxa) => {
                limparErro("taxa");
                setTaxa(formatarMoedaDigitada(novaTaxa));
              }}
              erro={erros.taxa}
              shakeKey={shakeKey}
            />
          </Campo>

          <Campo label="Conta destino" erro={erros.contaDestinoId} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.contaDestinoId}
              shakeKey={shakeKey}
              onClick={() => setModalConta(true)}
            >
              {contaDestino?.nome || "Selecionar conta bancária"}
            </ButtonField>
          </Campo>

          <Campo label="Tipo do saque" erro={erros.tipoSaque} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.tipoSaque}
              shakeKey={shakeKey}
              onClick={() => setModalTipo(true)}
            >
              {tiposDisponiveis.find((tipo) => tipo.valor === tipoSaque)?.titulo || "Selecionar"}
            </ButtonField>
          </Campo>
        </div>

        {erroGeral ? (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            {erroGeral}
          </p>
        ) : null}

        {valorBruto > 0 ? (
          <div className="mt-5 rounded-2xl border border-gray-800 bg-[#0B1120] p-4 space-y-2">
            <ResumoLinha titulo="Baixa no saldo da plataforma" valor={formatarMoeda(valorBruto)} />
            <ResumoLinha titulo="Taxa registrada separadamente" valor={formatarMoeda(taxaNumero)} />
            <ResumoLinha titulo="Valor líquido" valor={formatarMoeda(valorLiquido)} destaque />
          </div>
        ) : null}

        {emEdicao ? (
          <button
            type="button"
            onClick={() => setConfirmarExclusao(true)}
            disabled={salvando || excluindo}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/50 p-3 font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <FiTrash2 />
            Excluir saque
          </button>
        ) : null}

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 p-3 font-bold hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || excluindo}
            className="rounded-xl bg-green-500 p-3 font-black text-black hover:bg-green-600 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : emEdicao ? "Salvar alterações" : "Confirmar saque"}
          </button>
        </div>
      </ModalBase>

      <SelecionarContaModal
        aberto={modalConta}
        contas={contas}
        contaId={contaDestinoId}
        onSelecionar={(contaId) => {
          limparErro("contaDestinoId");
          setContaDestinoId(contaId);
        }}
        onClose={() => setModalConta(false)}
      />

      <SelecionarOpcaoModal
        aberto={modalTipo}
        titulo="Tipo do saque"
        descricao="Escolha como a plataforma processará este saque."
        opcoes={tiposDisponiveis}
        valor={tipoSaque}
        onSelecionar={selecionarTipo}
        onClose={() => setModalTipo(false)}
      />

      <DatePickerModal
        aberto={modalData}
        valor={dataSaque}
        maxDate={hojeBrasil()}
        titulo="Data do saque"
        descricao="Escolha a data da movimentação e da taxa vinculada."
        onChange={(data) => {
          limparErro("dataSaque");
          setDataSaque(data);
        }}
        onClose={() => setModalData(false)}
      />

      <ConfirmacaoModal
        aberto={confirmarExclusao}
        tipo="perigo"
        titulo="Excluir saque?"
        mensagem="O saque e a taxa vinculada serão removidos. O valor bruto retornará para a carteira da plataforma."
        textoConfirmar={excluindo ? "Excluindo..." : "Excluir saque"}
        carregando={excluindo}
        onCancelar={() => setConfirmarExclusao(false)}
        onConfirmar={excluir}
      />
    </>
  );
}

function ConfiguracaoPlataformaModal({
  plataforma,
  contas,
  onClose,
  onSalvo,
}) {
  const [contaDestinoId, setContaDestinoId] = useState(
    plataforma.conta_destino_id ? String(plataforma.conta_destino_id) : "",
  );
  const [diaRecebimento, setDiaRecebimento] = useState(
    plataforma.dia_recebimento_automatico
      ? String(plataforma.dia_recebimento_automatico)
      : "1",
  );
  const [taxaInstantanea, setTaxaInstantanea] = useState(() =>
    numeroParaMoedaInput(plataforma.taxa_saque_instantaneo || 0),
  );
  const [taxaAgendada, setTaxaAgendada] = useState(() =>
    numeroParaMoedaInput(plataforma.taxa_saque_agendado || 0),
  );
  const [modalConta, setModalConta] = useState(false);
  const [modalDia, setModalDia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [erroGeral, setErroGeral] = useState("");

  const contaDestino = contas.find(
    (conta) => String(conta.id) === String(contaDestinoId),
  );
  const diaSelecionado = DIAS_RECEBIMENTO.find(
    (dia) => dia.valor === diaRecebimento,
  );

  function limparErro(campo) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const proximos = { ...atuais };
      delete proximos[campo];
      return proximos;
    });
    setErroGeral("");
  }

  function validar() {
    const novos = {};
    if (!contaDestinoId) novos.contaDestinoId = "Selecione a conta de destino.";
    if (!diaRecebimento) novos.diaRecebimento = "Selecione o dia do recebimento semanal.";
    if (moedaParaNumero(taxaInstantanea) < 0) {
      novos.taxaInstantanea = "A taxa não pode ser negativa.";
    }
    if (moedaParaNumero(taxaAgendada) < 0) {
      novos.taxaAgendada = "A taxa não pode ser negativa.";
    }
    setErros(novos);
    if (Object.keys(novos).length) setShakeKey((atual) => atual + 1);
    return Object.keys(novos).length === 0;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    setErroGeral("");

    try {
      await salvarConfiguracaoPlataforma(plataforma.id, {
        contaDestinoId,
        diaRecebimentoAutomatico: diaRecebimento,
        taxaSaqueInstantaneo: moedaParaNumero(taxaInstantanea),
        taxaSaqueAgendado: moedaParaNumero(taxaAgendada),
      });
      await onSalvo?.();
    } catch (error) {
      console.error("Erro ao salvar configuração da plataforma:", error);
      setErroGeral(error.message || "Não foi possível salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ModalBase
        aberto={true}
        titulo={`Configurar ${plataforma.nome}`}
        descricao="Defina como os ganhos saem da plataforma e chegam à conta bancária."
        onClose={onClose}
        largura="max-w-xl"
        confirmarAoFecharSeAlterado
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Conta de destino" erro={erros.contaDestinoId} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.contaDestinoId}
              shakeKey={shakeKey}
              onClick={() => setModalConta(true)}
            >
              {contaDestino?.nome || "Selecionar conta bancária"}
            </ButtonField>
          </Campo>

          <Campo
            label="Dia do recebimento semanal"
            erro={erros.diaRecebimento}
            shakeKey={shakeKey}
          >
            <ButtonField
              erro={erros.diaRecebimento}
              shakeKey={shakeKey}
              onClick={() => setModalDia(true)}
            >
              {diaSelecionado?.titulo || "Selecionar dia da semana"}
            </ButtonField>
          </Campo>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          O dia é apenas uma informação da plataforma e não cria movimentações automaticamente.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Taxa padrão instantânea" erro={erros.taxaInstantanea} shakeKey={shakeKey}>
            <MoneyInput
              value={taxaInstantanea}
              onChange={(valor) => {
                limparErro("taxaInstantanea");
                setTaxaInstantanea(formatarMoedaDigitada(valor));
              }}
              erro={erros.taxaInstantanea}
              shakeKey={shakeKey}
            />
          </Campo>
          <Campo label="Taxa padrão agendada" erro={erros.taxaAgendada} shakeKey={shakeKey}>
            <MoneyInput
              value={taxaAgendada}
              onChange={(valor) => {
                limparErro("taxaAgendada");
                setTaxaAgendada(formatarMoedaDigitada(valor));
              }}
              erro={erros.taxaAgendada}
              shakeKey={shakeKey}
            />
          </Campo>
        </div>

        {erroGeral ? (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            {erroGeral}
          </p>
        ) : null}

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 p-3 font-bold hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-xl bg-green-500 p-3 font-black text-black hover:bg-green-600 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </ModalBase>

      <SelecionarContaModal
        aberto={modalConta}
        contas={contas}
        contaId={contaDestinoId}
        onSelecionar={(contaId) => {
          limparErro("contaDestinoId");
          setContaDestinoId(contaId);
        }}
        onClose={() => setModalConta(false)}
      />

      <SelecionarOpcaoModal
        aberto={modalDia}
        titulo="Dia do recebimento semanal"
        descricao="Esta informação não cria movimentações automaticamente."
        opcoes={DIAS_RECEBIMENTO}
        valor={diaRecebimento}
        onSelecionar={(dia) => {
          limparErro("diaRecebimento");
          setDiaRecebimento(dia);
        }}
        onClose={() => setModalDia(false)}
      />
    </>
  );
}

function MoneyInput({ value, onChange, erro, shakeKey, disabled = false }) {
  return (
    <div
      key={erro ? shakeKey : "ok"}
      className={`flex items-center mt-2 rounded-xl border bg-[#0B1120] overflow-hidden ${
        erro ? "border-red-500 animate-shake" : "border-gray-700 focus-within:border-green-400"
      }`}
    >
      <span className="px-3 text-gray-400">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent p-3 outline-none disabled:text-gray-500"
      />
    </div>
  );
}

function ResumoLinha({ titulo, valor, destaque = false }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-400">{titulo}</span>
      <strong className={destaque ? "text-green-400" : "text-white"}>{valor}</strong>
    </div>
  );
}
