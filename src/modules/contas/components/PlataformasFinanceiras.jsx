import { useCallback, useEffect, useState } from "react";
import { FiSettings, FiTrendingUp } from "react-icons/fi";

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
  registrarSaquePlataforma,
  salvarConfiguracaoPlataforma,
  salvarExibicaoPlataformaNasContas,
} from "../services/plataformasFinanceiroService";
import {
  calcularValorLiquidoSaque,
  obterTaxaPadraoSaque,
  obterTipoSaquePadrao,
  obterTiposSaqueDisponiveis,
} from "../utils/plataformasFinanceiro";

const TIPOS_SAQUE = [
  {
    valor: "instantaneo",
    titulo: "Instantâneo",
    descricao: "Recebimento imediato, quando permitido pela plataforma.",
  },
  {
    valor: "agendado",
    titulo: "Agendado",
    descricao: "Recebimento conforme o processamento da plataforma.",
  },
  {
    valor: "outro",
    titulo: "Outro",
    descricao: "Outro formato de recebimento informado pela plataforma.",
  },
];

const DIAS_RECEBIMENTO = [
  { valor: "1", titulo: "Segunda-feira" },
  { valor: "2", titulo: "Terça-feira" },
  { valor: "3", titulo: "Quarta-feira" },
  { valor: "4", titulo: "Quinta-feira" },
  { valor: "5", titulo: "Sexta-feira" },
  { valor: "6", titulo: "Sábado" },
  { valor: "7", titulo: "Domingo" },
];

const MODOS_RECEBIMENTO = [
  {
    valor: "instantaneo",
    titulo: "Recebimento instantâneo",
    descricao: "Cada ganho entra diretamente na conta bancária configurada.",
  },
  {
    valor: "retido",
    titulo: "Saldo retido",
    descricao: "Os ganhos permanecem na plataforma até o pagamento ou saque.",
  },
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

  const plataformasExibidas = plataformas.filter(
    (plataforma) => Math.abs(Number(plataforma.saldo || 0)) >= 0.01
      || plataforma.exibir_nas_contas !== false,
  );

  const opcoesConfig = plataformas.map((plataforma) => ({
    valor: String(plataforma.id),
    titulo: plataforma.nome,
    descricao: "Configurar recebimentos e taxas de saque.",
  }));

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
        ) : plataformasExibidas.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3">
            {plataformasExibidas.map((plataforma) => (
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
              Nenhuma plataforma está selecionada para exibição nas Contas.
            </p>
          </div>
        )}
      </section>

      <SelecionarOpcaoModal
        aberto={modalSelecionarConfig}
        titulo="Configurar plataforma"
        descricao="Escolha a plataforma cujas regras financeiras deseja alterar."
        opcoes={opcoesConfig}
        valor=""
        onSelecionar={(plataformaId) => {
          setPlataformaConfig(
            plataformas.find((item) => String(item.id) === String(plataformaId)) || null,
          );
        }}
        onClose={() => setModalSelecionarConfig(false)}
        pesquisavel={plataformas.length > 8}
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
          onExibicaoAlterada={(exibir) => {
            setPlataformas((atuais) => atuais.map((item) => (
              item.id === plataformaConfig.id
                ? { ...item, exibir_nas_contas: exibir }
                : item
            )));
          }}
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

function PlataformaCard({ plataforma, onAbrirExtrato, onSacar, onConfigurar }) {
  const config = obterConfigPlataforma(plataforma.nome);
  const pendente = Number(plataforma.saldo || 0) < 0;
  const permiteSaque = Number(plataforma.saldo || 0) > 0
    && obterTiposSaqueDisponiveis(plataforma).length > 0;

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
      className={`rounded-2xl border p-4 ${
        pendente
          ? "border-yellow-500/35 bg-yellow-500/10"
          : "border-gray-800 bg-[#111827]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-12 h-12 rounded-xl bg-[#0B1120] border border-gray-800 flex items-center justify-center overflow-hidden shrink-0">
            {config?.imagem ? (
              <img src={config.imagem} alt="" className="w-10 h-10 object-contain" />
            ) : (
              <FiTrendingUp className="h-8 w-8 text-green-400" />
            )}
          </span>
          <h3 className="font-black truncate">{plataforma.nome}</h3>
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

      <div className="mt-4">
        <p className={`text-xs ${pendente ? "text-yellow-400" : "text-gray-500"}`}>
          {pendente ? "Saldo pendente de conciliação" : "Saldo disponível"}
        </p>
        <p className={`text-2xl font-black mt-1 ${pendente ? "text-yellow-300" : "text-white"}`}>
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
        className={`w-full mt-4 rounded-xl font-black p-2.5 transition ${
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

function SaquePlataformaModal({ plataforma, contas, saque = null, onClose, onSalvo }) {
  const emEdicao = Boolean(saque?.id);
  const [valor, setValor] = useState(() =>
    numeroParaMoedaInput(
      emEdicao
        ? Number(saque.valor_bruto || 0)
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
  const tipoInicial = saque?.tipo_saque || obterTipoSaquePadrao(plataforma);
  const [tipoSaque, setTipoSaque] = useState(tipoInicial);
  const [taxa, setTaxa] = useState(() =>
    numeroParaMoedaInput(
      emEdicao ? Number(saque.taxa || 0) : obterTaxaPadraoSaque(plataforma, tipoInicial),
    ),
  );
  const [dataSaque, setDataSaque] = useState(saque?.data || hojeBrasil());
  const [modalData, setModalData] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [modalTipo, setModalTipo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [erroGeral, setErroGeral] = useState("");

  const tiposConfigurados = obterTiposSaqueDisponiveis(plataforma);
  const tiposDisponiveis = TIPOS_SAQUE.filter((tipo) =>
    tiposConfigurados.includes(tipo.valor)
      || (emEdicao && tipo.valor === tipoInicial),
  );

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

  return (
    <>
      <ModalBase
        aberto={true}
        titulo={emEdicao ? `Editar saque de ${plataforma.nome}` : `Sacar de ${plataforma.nome}`}
        descricao="O valor pode ser maior que o saldo conhecido; a diferença ficará pendente de conciliação."
        onClose={onClose}
        largura="max-w-xl"
        confirmarAoFecharSeAlterado
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {emEdicao ? (
            <Campo label="Data do saque">
              <ButtonField onClick={() => setModalData(true)}>
                {formatarDataBR(dataSaque)}
              </ButtonField>
            </Campo>
          ) : null}

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
              {TIPOS_SAQUE.find((tipo) => tipo.valor === tipoSaque)?.titulo || "Selecionar"}
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
        titulo="Data do saque"
        descricao="Escolha a data da movimentação e da taxa vinculada."
        onChange={setDataSaque}
        onClose={() => setModalData(false)}
      />
    </>
  );
}

function ConfiguracaoPlataformaModal({
  plataforma,
  contas,
  onClose,
  onSalvo,
  onExibicaoAlterada,
}) {
  const [modoRecebimento, setModoRecebimento] = useState(
    plataforma.modo_recebimento || "instantaneo",
  );
  const [contaDestinoId, setContaDestinoId] = useState(
    plataforma.conta_destino_id ? String(plataforma.conta_destino_id) : "",
  );
  const [diaRecebimento, setDiaRecebimento] = useState(
    plataforma.dia_recebimento_automatico
      ? String(plataforma.dia_recebimento_automatico)
      : "1",
  );
  const [tiposSaque, setTiposSaque] = useState(() =>
    obterTiposSaqueDisponiveis(plataforma),
  );
  const [tipoPadrao, setTipoPadrao] = useState(() =>
    obterTipoSaquePadrao(plataforma),
  );
  const [taxaInstantanea, setTaxaInstantanea] = useState(() =>
    numeroParaMoedaInput(plataforma.taxa_saque_instantaneo || 0),
  );
  const [taxaAgendada, setTaxaAgendada] = useState(() =>
    numeroParaMoedaInput(plataforma.taxa_saque_agendado || 0),
  );
  const [modalModo, setModalModo] = useState(false);
  const [modalConta, setModalConta] = useState(false);
  const [modalDia, setModalDia] = useState(false);
  const [modalTipoPadrao, setModalTipoPadrao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [erroGeral, setErroGeral] = useState("");
  const saldoNaoZerado = Math.abs(Number(plataforma.saldo || 0)) >= 0.01;
  const [exibirNasContas, setExibirNasContas] = useState(
    saldoNaoZerado || plataforma.exibir_nas_contas !== false,
  );
  const [salvandoExibicao, setSalvandoExibicao] = useState(false);

  const contaDestino = contas.find(
    (conta) => String(conta.id) === String(contaDestinoId),
  );
  const modoSelecionado = MODOS_RECEBIMENTO.find(
    (modo) => modo.valor === modoRecebimento,
  );
  const diaSelecionado = DIAS_RECEBIMENTO.find(
    (dia) => dia.valor === diaRecebimento,
  );
  const tiposPadraoDisponiveis = TIPOS_SAQUE.filter((tipo) =>
    tiposSaque.includes(tipo.valor),
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

  function alternarTipoSaque(tipo, ativo) {
    const proximos = ativo
      ? [...new Set([...tiposSaque, tipo])]
      : tiposSaque.filter((item) => item !== tipo);

    setTiposSaque(proximos);
    if (proximos.length > 0 && !proximos.includes(tipoPadrao)) {
      setTipoPadrao(proximos[0]);
    }
  }

  function validar() {
    const novos = {};
    if (!modoRecebimento) novos.modoRecebimento = "Selecione o modo de recebimento.";
    if (!contaDestinoId) novos.contaDestinoId = "Selecione a conta de destino.";
    if (modoRecebimento === "retido" && !diaRecebimento) {
      novos.diaRecebimento = "Selecione o dia do pagamento automático.";
    }
    if (moedaParaNumero(taxaInstantanea) < 0) {
      novos.taxaInstantanea = "A taxa não pode ser negativa.";
    }
    if (moedaParaNumero(taxaAgendada) < 0) {
      novos.taxaAgendada = "A taxa não pode ser negativa.";
    }
    if (tiposSaque.length > 0 && !tiposSaque.includes(tipoPadrao)) {
      novos.tipoPadrao = "Selecione um tipo padrão disponível.";
    }

    setErros(novos);
    if (Object.keys(novos).length) setShakeKey((atual) => atual + 1);
    return Object.keys(novos).length === 0;
  }

  async function alternarExibicao(exibir) {
    if (saldoNaoZerado || salvandoExibicao) return;
    setSalvandoExibicao(true);
    setErroGeral("");

    try {
      await salvarExibicaoPlataformaNasContas(plataforma.id, exibir);
      setExibirNasContas(exibir);
      onExibicaoAlterada?.(exibir);
    } catch (error) {
      console.error("Erro ao atualizar exibição da plataforma:", error);
      setErroGeral(error.message || "Não foi possível atualizar a exibição nas Contas.");
    } finally {
      setSalvandoExibicao(false);
    }
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    setErroGeral("");

    try {
      await salvarConfiguracaoPlataforma(plataforma.id, {
        modoRecebimento,
        contaDestinoId,
        diaRecebimentoAutomatico: diaRecebimento,
        taxaSaqueInstantaneo: moedaParaNumero(taxaInstantanea),
        taxaSaqueAgendado: moedaParaNumero(taxaAgendada),
        tiposSaqueDisponiveis: tiposSaque,
        tipoSaquePadrao: tipoPadrao,
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
          <Campo label="Modo de recebimento" erro={erros.modoRecebimento} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.modoRecebimento}
              shakeKey={shakeKey}
              onClick={() => setModalModo(true)}
            >
              {modoSelecionado?.titulo || "Selecionar modo"}
            </ButtonField>
          </Campo>

          <Campo label="Conta de destino" erro={erros.contaDestinoId} shakeKey={shakeKey}>
            <ButtonField
              erro={erros.contaDestinoId}
              shakeKey={shakeKey}
              onClick={() => setModalConta(true)}
            >
              {contaDestino?.nome || "Selecionar conta bancária"}
            </ButtonField>
          </Campo>
        </div>

        <div className="mt-5 rounded-2xl border border-gray-800 bg-[#0B1120] p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-black">Exibir nas Contas</p>
            <p className="mt-1 text-xs text-gray-500">
              {saldoNaoZerado
                ? "Plataformas com saldo não podem ser ocultadas."
                : "A preferência é salva imediatamente enquanto o saldo estiver zerado."}
            </p>
          </div>
          <ToggleSwitch
            ativo={saldoNaoZerado || exibirNasContas}
            disabled={saldoNaoZerado || salvandoExibicao}
            onChange={alternarExibicao}
            ariaLabel="Exibir plataforma nas Contas"
          />
        </div>

        {modoRecebimento === "retido" ? (
          <div className="mt-5 space-y-5">
            <Campo
              label="Dia do pagamento automático"
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

            <p className="text-xs text-gray-500 -mt-3">
              O ciclo financeiro permanece sempre de segunda a domingo; este dia define apenas o pagamento.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4 space-y-4">
              <div>
                <p className="font-black">Tipos de saque disponíveis</p>
                <p className="text-xs text-gray-500 mt-1">
                  Ative apenas as modalidades oferecidas pela plataforma.
                </p>
              </div>
              {TIPOS_SAQUE.map((tipo) => (
                <div key={tipo.valor} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">{tipo.titulo}</p>
                    <p className="text-xs text-gray-500">{tipo.descricao}</p>
                  </div>
                  <ToggleSwitch
                    ativo={tiposSaque.includes(tipo.valor)}
                    onChange={(ativo) => alternarTipoSaque(tipo.valor, ativo)}
                    ariaLabel={`${ativoLabel(tiposSaque.includes(tipo.valor))} saque ${tipo.titulo.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>

            {tiposSaque.length > 0 ? (
              <Campo label="Tipo de saque padrão" erro={erros.tipoPadrao} shakeKey={shakeKey}>
                <ButtonField
                  erro={erros.tipoPadrao}
                  shakeKey={shakeKey}
                  onClick={() => setModalTipoPadrao(true)}
                >
                  {TIPOS_SAQUE.find((tipo) => tipo.valor === tipoPadrao)?.titulo || "Selecionar tipo"}
                </ButtonField>
              </Campo>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-gray-300">
            Os ganhos serão creditados diretamente na conta escolhida, sem saldo ou saque na plataforma.
          </div>
        )}

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

      <SelecionarOpcaoModal
        aberto={modalModo}
        titulo="Modo de recebimento"
        descricao="Escolha como esta plataforma repassa os ganhos."
        opcoes={MODOS_RECEBIMENTO}
        valor={modoRecebimento}
        onSelecionar={(modo) => {
          limparErro("modoRecebimento");
          setModoRecebimento(modo);
        }}
        onClose={() => setModalModo(false)}
      />

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
        titulo="Dia do pagamento automático"
        descricao="O ciclo continua de segunda a domingo, independentemente desta escolha."
        opcoes={DIAS_RECEBIMENTO}
        valor={diaRecebimento}
        onSelecionar={(dia) => {
          limparErro("diaRecebimento");
          setDiaRecebimento(dia);
        }}
        onClose={() => setModalDia(false)}
      />

      <SelecionarOpcaoModal
        aberto={modalTipoPadrao}
        titulo="Tipo de saque padrão"
        descricao="Este tipo será preenchido ao abrir um novo saque."
        opcoes={tiposPadraoDisponiveis}
        valor={tipoPadrao}
        onSelecionar={(tipo) => {
          limparErro("tipoPadrao");
          setTipoPadrao(tipo);
        }}
        onClose={() => setModalTipoPadrao(false)}
      />
    </>
  );
}

function ativoLabel(ativo) {
  return ativo ? "Desativar" : "Ativar";
}

function MoneyInput({ value, onChange, erro, shakeKey }) {
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
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent p-3 outline-none"
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
