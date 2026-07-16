import { useEffect, useState } from "react";
import {
  FiBriefcase,
  FiCreditCard,
  FiEdit2,
  FiStar,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { supabase } from "../../../services/supabase";
import ModalBase from "../../../shared/components/modals/ModalBase";
import ModalExtratoConta from "../components/ModalExtratoConta";
import { formatarDataBR } from "../../../shared/utils/data";

export default function Contas() {
  const [contas, setContas] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaEditando, setContaEditando] = useState(null);
  const [contaExtrato, setContaExtrato] = useState(null);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [contaParaExcluir, setContaParaExcluir] = useState(null);

  const [modalPrincipalAberto, setModalPrincipalAberto] = useState(false);
  const [contaParaPrincipal, setContaParaPrincipal] = useState(null);

  const [modalAviso, setModalAviso] = useState({
    aberto: false,
    titulo: "",
    mensagem: "",
    tipo: "info",
  });

  const [nomeConta, setNomeConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [permitirSaldoNegativo, setPermitirSaldoNegativo] = useState(false);
  const [limiteChequeEspecial, setLimiteChequeEspecial] = useState("");
  const [finalidadeConta, setFinalidadeConta] = useState("trabalho");

  useEffect(() => {
    carregarContas();
  }, []);

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarMoedaDigitada(valor, permitirNegativo = false) {
    let texto = String(valor || "").replace(/[^\d,-]/g, "");

    if (permitirNegativo) {
      const negativo = texto.startsWith("-");
      texto = texto.replace(/-/g, "");
      texto = texto.replace(/\D/g, "");
      const numero = Number(texto || 0) / 100;
      const formatado = numero.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return negativo ? `-${formatado}` : formatado;
    }

    texto = texto.replace(/\D/g, "");
    const numero = Number(texto || 0) / 100;
    return numero.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    const texto = String(valor).replace(/\./g, "").replace(",", ".");
    return Number(texto || 0);
  }

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function abrirAviso(titulo, mensagem, tipo = "info") {
    setModalAviso({ aberto: true, titulo, mensagem, tipo });
  }

  function fecharAviso() {
    setModalAviso({ aberto: false, titulo: "", mensagem: "", tipo: "info" });
  }

  function isBanco(conta) {
    return (conta.tipo_conta || "banco") === "banco";
  }

  function isCarteira(conta) {
    return conta.tipo_conta === "carteira";
  }

  function finalidadeDaConta(conta) {
    return (conta.finalidade || "trabalho") === "pessoal"
      ? "pessoal"
      : "trabalho";
  }

  function textoFinalidadeConta(conta) {
    return finalidadeDaConta(conta) === "pessoal"
      ? "Pessoal"
      : "Trabalho / Operação";
  }

  async function calcularSaldoConta(conta) {
    const contaId = conta.id;

    const { data: entradas } = await supabase
      .from("entradas")
      .select(`entrada_plataformas (faturamento, valor_reembolso)`)
      .eq("conta_id", contaId);

    const totalEntradas = (entradas || []).reduce((total, entrada) => {
      const totalPlataformas = (entrada.entrada_plataformas || []).reduce(
        (soma, item) =>
          soma +
          Number(item.faturamento || 0) +
          Number(item.valor_reembolso || 0),
        0,
      );

      return total + totalPlataformas;
    }, 0);

    const { data: entradasAvulsas } = await supabase
      .from("entradas_avulsas")
      .select("valor")
      .eq("conta_id", contaId);

    const totalEntradasAvulsas = (entradasAvulsas || []).reduce(
      (total, entrada) => total + Number(entrada.valor || 0),
      0,
    );

    const { data: transferenciasRecebidas } = await supabase
      .from("transferencias")
      .select("valor")
      .eq("conta_destino_id", contaId);

    const totalTransferenciasRecebidas = (transferenciasRecebidas || []).reduce(
      (total, transferencia) => total + Number(transferencia.valor || 0),
      0,
    );

    const { data: transferenciasEnviadas } = await supabase
      .from("transferencias")
      .select("valor")
      .eq("conta_origem_id", contaId);

    const totalTransferenciasEnviadas = (transferenciasEnviadas || []).reduce(
      (total, transferencia) => total + Number(transferencia.valor || 0),
      0,
    );

    const { data: saidas } = await supabase
      .from("saidas")
      .select("valor_total, tipo_movimentacao")
      .eq("conta_id", contaId);

    const totalSaidas = (saidas || [])
      .filter((saida) => saida.tipo_movimentacao !== "conta_pagar")
      .reduce((total, saida) => total + Number(saida.valor_total || 0), 0);

    return (
      Number(conta.saldo_inicial || 0) +
      totalEntradas +
      totalEntradasAvulsas +
      totalTransferenciasRecebidas -
      totalSaidas -
      totalTransferenciasEnviadas
    );
  }

  async function carregarContas() {
    const { data, error } = await supabase
      .from("contas")
      .select("*")
      .eq("ativo", true)
      .in("tipo_conta", ["banco", "carteira"])
      .order("id");

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao carregar contas.", "erro");
      return;
    }

    const contasAtualizadas = await Promise.all(
      (data || []).map(async (conta) => ({
        ...conta,
        tipo_conta: conta.tipo_conta || "banco",
        finalidade: conta.finalidade || "trabalho",
        permitir_saldo_negativo: conta.permitir_saldo_negativo ?? false,
        limite_cheque_especial: Number(conta.limite_cheque_especial || 0),
        saldo_atual: await calcularSaldoConta(conta),
      })),
    );

    setContas(contasAtualizadas);
  }

  function limparFormulario() {
    setContaEditando(null);
    setNomeConta("");
    setSaldoInicial("");
    setPermitirSaldoNegativo(false);
    setLimiteChequeEspecial("");
    setFinalidadeConta("trabalho");
  }

  function abrirNovaConta() {
    limparFormulario();
    setModalAberto(true);
  }

  function abrirEditarConta(conta) {
    if (isCarteira(conta)) {
      abrirAviso(
        "Carteira padrão",
        "A carteira é criada pelo sistema. Por enquanto, mantenha os ajustes nela pelos lançamentos em dinheiro.",
        "info",
      );
      return;
    }

    setContaEditando(conta);
    setNomeConta(conta.nome || "");
    setSaldoInicial(numeroParaMoedaInput(conta.saldo_inicial));
    setFinalidadeConta(conta.finalidade || "trabalho");
    setPermitirSaldoNegativo(conta.permitir_saldo_negativo ?? false);
    setLimiteChequeEspecial(
      conta.limite_cheque_especial
        ? numeroParaMoedaInput(conta.limite_cheque_especial)
        : "",
    );
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    limparFormulario();
  }

  async function salvarConta() {
    if (!nomeConta.trim()) {
      abrirAviso(
        "Nome obrigatório",
        "Digite o nome da conta bancária.",
        "erro",
      );
      return;
    }

    const nomeNormalizado = nomeConta.trim();
    const saldoInicialNumero = moedaParaNumero(saldoInicial);
    const limiteNumero = permitirSaldoNegativo
      ? moedaParaNumero(limiteChequeEspecial)
      : 0;

    const { data: contasMesmoNome } = await supabase
      .from("contas")
      .select("*")
      .ilike("nome", nomeNormalizado);

    const contaAtivaMesmoNome = (contasMesmoNome || []).find(
      (conta) => conta.ativo === true && conta.id !== contaEditando?.id,
    );

    if (contaAtivaMesmoNome) {
      abrirAviso(
        "Conta já cadastrada",
        "Já existe uma conta ativa com esse nome.",
        "erro",
      );
      return;
    }

    const dadosConta = {
      nome: nomeNormalizado,
      tipo_conta: "banco",
      tipo_tag: null,
      finalidade: finalidadeConta === "pessoal" ? "pessoal" : "trabalho",
      saldo_inicial: saldoInicialNumero,
      permitir_saldo_negativo: permitirSaldoNegativo,
      limite_cheque_especial: limiteNumero,
      recarga_automatica: false,
      valor_recarga_automatica: 0,
      percentual_alerta_recarga: 30,
    };

    if (contaEditando) {
      const { error } = await supabase
        .from("contas")
        .update(dadosConta)
        .eq("id", contaEditando.id);

      if (error) {
        console.error(error);
        abrirAviso("Erro", "Erro ao editar conta.", "erro");
        return;
      }

      fecharModal();
      carregarContas();
      return;
    }

    const contaInativaMesmoNome = (contasMesmoNome || []).find(
      (conta) => conta.ativo === false,
    );

    if (contaInativaMesmoNome) {
      const { error } = await supabase
        .from("contas")
        .update({ ...dadosConta, ativo: true })
        .eq("id", contaInativaMesmoNome.id);

      if (error) {
        console.error(error);
        abrirAviso("Erro", "Erro ao reativar conta.", "erro");
        return;
      }

      fecharModal();
      carregarContas();
      return;
    }

    const jaExistePrincipal = contas.some(
      (conta) => conta.principal && isBanco(conta),
    );

    const { error } = await supabase.from("contas").insert({
      ...dadosConta,
      principal: !jaExistePrincipal,
      ativo: true,
    });

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao criar conta.", "erro");
      return;
    }

    fecharModal();
    carregarContas();
  }

  function calcularChequeUsado(conta) {
    const saldoAtual = Number(conta.saldo_atual || 0);
    if (saldoAtual >= 0) return 0;
    return Math.abs(saldoAtual);
  }

  function calcularPorcentagemCheque(conta) {
    const limite = Number(conta.limite_cheque_especial || 0);
    const usado = calcularChequeUsado(conta);
    if (limite <= 0) return 0;
    return Math.min((usado / limite) * 100, 100);
  }

  function solicitarContaPrincipal(conta) {
    if (conta.principal) return;
    if (!isBanco(conta)) return;
    setContaParaPrincipal(conta);
    setModalPrincipalAberto(true);
  }

  async function confirmarContaPrincipal() {
    if (!contaParaPrincipal) return;

    await supabase
      .from("contas")
      .update({ principal: false })
      .eq("tipo_conta", "banco");

    await supabase
      .from("contas")
      .update({ principal: true })
      .eq("id", contaParaPrincipal.id);

    setModalPrincipalAberto(false);
    setContaParaPrincipal(null);
    carregarContas();
  }

  function solicitarExclusaoConta(conta) {
    if (isCarteira(conta)) {
      abrirAviso(
        "Carteira obrigatória",
        "A carteira é uma conta padrão do sistema e não pode ser excluída.",
        "erro",
      );
      return;
    }

    if (conta.principal) {
      abrirAviso(
        "Conta principal",
        "Você não pode excluir a conta principal. Defina outra conta como principal antes.",
        "erro",
      );
      return;
    }

    setContaParaExcluir(conta);
    setModalExcluirAberto(true);
  }

  async function confirmarExclusaoConta() {
    if (!contaParaExcluir) return;

    const { error } = await supabase
      .from("contas")
      .update({ ativo: false })
      .eq("id", contaParaExcluir.id);

    if (error) {
      console.error(error);
      abrirAviso("Erro", "Erro ao excluir conta.", "erro");
      return;
    }

    setModalExcluirAberto(false);
    setContaParaExcluir(null);
    carregarContas();
  }

  const carteiras = contas.filter((conta) => isCarteira(conta));
  const bancos = contas.filter((conta) => isBanco(conta));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contas</h1>
          <p className="text-gray-400 mt-2">
            Gerencie bancos e a carteira padrão
          </p>
        </div>

        <button
          onClick={abrirNovaConta}
          className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl px-5 py-3 text-center"
        >
          + Nova Conta Bancária
        </button>
      </div>

      {carteiras.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Carteira</h2>
            <div className="h-px flex-1 border-t border-dashed border-gray-700" />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {carteiras.map((conta) => {
              const saldoNegativo = Number(conta.saldo_atual || 0) < 0;

              return (
                <div
                  key={conta.id}
                  onClick={() => setContaExtrato(conta)}
                  role="button"
                  tabIndex={0}
                  className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-[#111827] to-[#0B1120] p-4 shadow cursor-pointer hover:border-green-400/60 transition"
                >
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-bold px-2.5 py-1">
                        Carteira padrão
                      </div>

                      <h2 className="text-lg font-black mt-2">{conta.nome}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Dinheiro em espécie
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-4">
                    <p className="text-xs text-gray-400">Saldo em dinheiro</p>
                    <h3
                      className={`text-2xl font-black mt-1 ${
                        saldoNegativo ? "text-red-400" : "text-white"
                      }`}
                    >
                      {formatarMoeda(conta.saldo_atual)}
                    </h3>
                  </div>

                  <p className="relative text-xs text-gray-500 mt-4 border-t border-amber-500/20 pt-3">
                    Criada automaticamente pelo sistema. Pagamentos em dinheiro
                    sempre saem daqui.
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Contas Bancárias</h2>
          <div className="h-px flex-1 border-t border-dashed border-gray-700" />
        </div>

        {bancos.length === 0 ? (
          <div className="mt-4 bg-[#111827] border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-400">Nenhuma conta bancária cadastrada.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {bancos.map((conta) => {
              const saldoNegativo = Number(conta.saldo_atual || 0) < 0;
              const temCheque =
                conta.permitir_saldo_negativo &&
                Number(conta.limite_cheque_especial || 0) > 0;

              const chequeUsado = calcularChequeUsado(conta);
              const porcentagemCheque = calcularPorcentagemCheque(conta);

              return (
                <div
                  key={conta.id}
                  onClick={() => setContaExtrato(conta)}
                  role="button"
                  tabIndex={0}
                  className={`relative rounded-2xl border p-6 transition cursor-pointer hover:border-green-400/60 ${
                    saldoNegativo
                      ? "border-red-500/60 bg-red-500/10"
                      : conta.principal
                        ? "border-green-400 bg-green-500/10"
                        : "border-gray-800 bg-[#111827]"
                  }`}
                >
                  <div className="absolute top-4 right-4 flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); solicitarContaPrincipal(conta); }}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                        conta.principal
                          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                          : "border-gray-700 bg-[#0B1120] text-gray-500 hover:text-yellow-400 hover:border-yellow-500/40"
                      }`}
                      title="Definir como principal"
                    >
                      <FiStar
                        className={conta.principal ? "fill-current" : ""}
                      />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); abrirEditarConta(conta); }}
                      className="w-9 h-9 rounded-xl border border-gray-700 bg-[#0B1120] flex items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition"
                      title="Editar conta"
                    >
                      <FiEdit2 />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); solicitarExclusaoConta(conta); }}
                      className="w-9 h-9 rounded-xl border border-gray-700 bg-[#0B1120] flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-500/40 transition"
                      title="Excluir conta"
                    >
                      <FiTrash2 />
                    </button>
                  </div>

                  <h2 className="text-xl font-bold pr-24">{conta.nome}</h2>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 text-gray-300 text-xs font-bold px-3 py-1">
                      <FiCreditCard className="text-sm" /> Banco
                    </div>

                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full text-xs font-bold px-3 py-1 border ${
                        finalidadeDaConta(conta) === "pessoal"
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/20"
                          : "bg-green-500/15 text-green-300 border-green-500/20"
                      }`}
                    >
                      {finalidadeDaConta(conta) === "pessoal" ? (
                        <FiUser />
                      ) : (
                        <FiBriefcase />
                      )}
                      {textoFinalidadeConta(conta)}
                    </div>

                    {conta.principal && (
                      <div className="rounded-full bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1">
                        Conta Principal
                      </div>
                    )}

                    {temCheque && (
                      <div
                        className={`rounded-full text-xs font-bold px-3 py-1 ${
                          saldoNegativo
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {saldoNegativo &&
                        chequeUsado > Number(conta.limite_cheque_especial || 0)
                          ? "Cheque Especial Excedido"
                          : saldoNegativo
                            ? "Cheque Especial Ativo"
                            : "Cheque Especial Disponível"}
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    <p className="text-sm text-gray-400">Saldo Atual</p>

                    <div className="flex items-center gap-3 mt-2">
                      <h3
                        className={`text-4xl font-bold ${
                          saldoNegativo ? "text-red-400" : "text-white"
                        }`}
                      >
                        {formatarMoeda(conta.saldo_atual)}
                      </h3>

                      {saldoNegativo && (
                        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/20 text-red-400 text-2xl font-bold">
                          ↓
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-gray-800 pt-4">
                    <p className="text-sm text-gray-500">Saldo Inicial</p>

                    <p
                      className={`mt-2 text-base font-semibold ${
                        Number(conta.saldo_inicial || 0) < 0
                          ? "text-red-400"
                          : "text-gray-400"
                      }`}
                    >
                      {formatarMoeda(conta.saldo_inicial)}
                    </p>
                  </div>

                  {temCheque && (
                    <div className="mt-6 border-t border-gray-800 pt-5">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold">Cheque Especial</p>

                        <p
                          className={`text-sm font-bold ${
                            porcentagemCheque >= 80
                              ? "text-red-400"
                              : porcentagemCheque >= 50
                                ? "text-yellow-400"
                                : "text-gray-300"
                          }`}
                        >
                          {porcentagemCheque.toFixed(0)}%
                        </p>
                      </div>

                      <div className="mt-4 h-4 bg-[#0B1120] border border-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            porcentagemCheque >= 80
                              ? "bg-red-500"
                              : porcentagemCheque >= 50
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${porcentagemCheque}%` }}
                        />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                chequeUsado > 0 ? "bg-red-400" : "bg-green-400"
                              }`}
                            />

                            <p className="text-sm text-gray-400">Usado</p>
                          </div>

                          <p
                            className={`text-xl font-bold mt-2 ${
                              chequeUsado > 0
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {formatarMoeda(chequeUsado)}
                          </p>
                        </div>

                        <div className="border-l border-gray-700 pl-4">
                          <p className="text-sm text-gray-400">Limite</p>

                          <p className="text-xl font-bold mt-2 text-white">
                            {formatarMoeda(conta.limite_cheque_especial)}
                          </p>
                        </div>
                      </div>

                      {saldoNegativo &&
                        chequeUsado >
                          Number(conta.limite_cheque_especial || 0) && (
                          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                            <p className="text-sm font-bold text-red-400">
                              ⚠ Limite do cheque especial excedido
                            </p>
                            <p className="text-xs text-gray-300 mt-1">
                              O banco permitiu ficar acima do limite cadastrado.
                              Pode haver juros, tarifas ou bloqueios.
                            </p>
                          </div>
                        )}

                      {saldoNegativo &&
                        chequeUsado <=
                          Number(conta.limite_cheque_especial || 0) && (
                          <p className="text-xs text-yellow-400 mt-4">
                            Atenção: você está usando cheque especial. Pode
                            haver juros se continuar negativo.
                          </p>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ModalExtratoConta
        aberto={!!contaExtrato}
        conta={contaExtrato}
        onClose={() => setContaExtrato(null)}
        formatarMoeda={formatarMoeda}
        formatarData={formatarDataBR}
      />

      <ModalBase
        aberto={modalAberto}
        titulo={contaEditando ? "Editar Conta Bancária" : "Nova Conta Bancária"}
        descricao={
          contaEditando
            ? "Altere os dados da conta bancária cadastrada."
            : "Cadastre contas bancárias separando operação e vida pessoal."
        }
        onClose={fecharModal}
        largura="max-w-xl"
      >
        <div>
          <label className="text-sm text-gray-300 font-semibold">Nome</label>
          <input
            type="text"
            value={nomeConta}
            placeholder="Ex: Nubank PJ, Itaú, Inter"
            onChange={(e) => setNomeConta(e.target.value)}
            className="w-full mt-2 bg-[#0B1120] border border-gray-700 focus:border-green-500 rounded-xl p-3 outline-none transition"
          />
        </div>

        <div className="mt-5">
          <p className="text-sm text-gray-300 font-semibold">Finalidade da conta</p>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              type="button"
              onClick={() => setFinalidadeConta("trabalho")}
              className={`rounded-2xl border p-3 text-left transition ${
                finalidadeConta === "trabalho"
                  ? "border-green-500 bg-green-500/10 text-green-300"
                  : "border-gray-800 bg-[#0B1120] text-gray-400 hover:border-green-500/40 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 shrink-0">
                  <FiBriefcase />
                </span>
                <div className="min-w-0">
                  <p className="font-black leading-tight">Trabalho</p>
                  <p className="text-[11px] opacity-80 mt-0.5 leading-tight">Operação</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFinalidadeConta("pessoal")}
              className={`rounded-2xl border p-3 text-left transition ${
                finalidadeConta === "pessoal"
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-gray-800 bg-[#0B1120] text-gray-400 hover:border-blue-500/40 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <FiUser />
                </span>
                <div className="min-w-0">
                  <p className="font-black leading-tight">Pessoal</p>
                  <p className="text-[11px] opacity-80 mt-0.5 leading-tight">Vida pessoal</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm text-gray-300 font-semibold">Saldo Inicial</label>
          <div className="flex items-center mt-2 bg-[#0B1120] border border-gray-700 focus-within:border-green-500 rounded-xl overflow-hidden transition">
            <span className="px-3 text-gray-400">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={saldoInicial}
              placeholder="0,00 ou -700,00"
              onChange={(e) => {
                const valorFormatado = formatarMoedaDigitada(e.target.value, true);
                setSaldoInicial(valorFormatado);
              }}
              className="w-full bg-transparent p-3 outline-none"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Para banco já negativo, digite com sinal de menos. O cheque especial é opcional.
          </p>
        </div>

        <div className="mt-5 bg-[#0B1120] border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-black text-white">Permitir saldo negativo</p>
              <p className="text-xs text-gray-400 mt-1">Ative somente se quiser informar um limite de cheque especial.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPermitirSaldoNegativo(!permitirSaldoNegativo);
                if (permitirSaldoNegativo) setLimiteChequeEspecial("");
              }}
              className={`relative w-14 h-8 rounded-full transition shrink-0 ${
                permitirSaldoNegativo ? "bg-green-500" : "bg-gray-700"
              }`}
              aria-label="Permitir saldo negativo"
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition ${
                  permitirSaldoNegativo ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {permitirSaldoNegativo && (
            <div className="mt-4">
              <label className="text-sm text-gray-300 font-semibold">Limite do Cheque Especial (opcional)</label>
              <div className="flex items-center mt-2 bg-[#111827] border border-gray-700 focus-within:border-yellow-500 rounded-xl overflow-hidden transition">
                <span className="px-3 text-gray-400">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={limiteChequeEspecial}
                  placeholder="0,00"
                  onChange={(e) => setLimiteChequeEspecial(formatarMoedaDigitada(e.target.value))}
                  className="w-full bg-transparent p-3 outline-none"
                />
              </div>
              <p className="text-xs text-yellow-400 mt-2">
                O limite não soma no saldo. Ele aparece separado como cheque especial.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={fecharModal}
            className="border border-gray-700 hover:bg-white/5 text-white font-black rounded-xl p-3 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvarConta}
            className="bg-green-500 hover:bg-green-600 text-black font-black rounded-xl p-3 transition"
          >
            {contaEditando ? "Salvar Alterações" : "Salvar"}
          </button>
        </div>
      </ModalBase>

      {modalPrincipalAberto && (
        <ModalConfirmacao
          titulo="Definir Conta Principal"
          cor="green"
          texto={
            <>
              Deseja definir{" "}
              <span className="font-bold text-white">
                {contaParaPrincipal?.nome}
              </span>{" "}
              como conta principal?
            </>
          }
          subtitulo="Os próximos lançamentos usarão esta conta como sugestão inicial."
          cancelar={() => {
            setModalPrincipalAberto(false);
            setContaParaPrincipal(null);
          }}
          confirmar={confirmarContaPrincipal}
          textoConfirmar="Confirmar"
        />
      )}

      {modalExcluirAberto && (
        <ModalConfirmacao
          titulo="Excluir Conta Bancária"
          cor="red"
          texto={
            <>
              Deseja realmente excluir a conta{" "}
              <span className="font-bold text-white">
                {contaParaExcluir?.nome}
              </span>
              ?
            </>
          }
          subtitulo="Ela deixará de aparecer para novos lançamentos."
          cancelar={() => {
            setModalExcluirAberto(false);
            setContaParaExcluir(null);
          }}
          confirmar={confirmarExclusaoConta}
          textoConfirmar="Excluir"
        />
      )}

      {modalAviso.aberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
            <h2
              className={`text-2xl font-bold ${
                modalAviso.tipo === "erro" ? "text-red-400" : "text-green-400"
              }`}
            >
              {modalAviso.titulo}
            </h2>

            <p className="text-gray-300 mt-4">{modalAviso.mensagem}</p>

            <button
              type="button"
              onClick={fecharAviso}
              className="mt-6 w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function ModalConfirmacao({
  titulo,
  texto,
  subtitulo,
  cancelar,
  confirmar,
  textoConfirmar,
  cor,
}) {
  const corBotao =
    cor === "red"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : "bg-green-500 hover:bg-green-600 text-black";
  const corTitulo = cor === "red" ? "text-red-400" : "text-green-400";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-2xl p-6">
        <h2 className={`text-2xl font-bold ${corTitulo}`}>{titulo}</h2>
        <p className="text-gray-300 mt-4">{texto}</p>
        {subtitulo && <p className="text-gray-500 text-sm mt-2">{subtitulo}</p>}

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={cancelar}
            className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={confirmar}
            className={`${corBotao} font-bold rounded-xl p-3`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

