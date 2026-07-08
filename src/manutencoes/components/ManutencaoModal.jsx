import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { supabase } from "../../services/supabase";

import ModalBase from "../../components/modals/ModalBase";
import AbasCartao from "../../components/globais/AbasCartao";
import BarraEtapas from "../../components/globais/BarraEtapas";
import DatePickerModal from "../../components/modals/DatePickerModal";
import FeedbackModal from "../../components/modals/FeedbackModal";
import SelecionarVeiculoModal from "../../components/modals/SelecionarVeiculoModal";

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function ManutencaoModal({ aberto, onClose, edicao = null, onSalvo = null }) {
  const hoje = new Date().toISOString().split("T")[0];

  const [etapa, setEtapa] = useState(1);
  const [dataManutencao, setDataManutencao] = useState(hoje);
  const [veiculoId, setVeiculoId] = useState("");
  const [odometro, setOdometro] = useState("");

  const [veiculos, setVeiculos] = useState([]);
  const [servicosBase, setServicosBase] = useState([]);
  const [oficinasBase, setOficinasBase] = useState([]);

  const [oficinas, setOficinas] = useState([]);
  const [oficinaAtivaId, setOficinaAtivaId] = useState(null);

  const [modalDataAberto, setModalDataAberto] = useState(false);
  const [modalVeiculoAberto, setModalVeiculoAberto] = useState(false);
  const [modalAdicionarServicoAberto, setModalAdicionarServicoAberto] = useState(false);
  const [modalAdicionarOficinaAberto, setModalAdicionarOficinaAberto] = useState(false);

  const [buscaServico, setBuscaServico] = useState("");
  const [buscaOficina, setBuscaOficina] = useState("");
  const [gerenciandoServicos, setGerenciandoServicos] = useState(false);
  const [gerenciandoOficinas, setGerenciandoOficinas] = useState(false);
  const [servicoEmAlteracao, setServicoEmAlteracao] = useState(null); // { oficinaUid, servicoUid }
  const [oficinaUidEmAlteracao, setOficinaUidEmAlteracao] = useState(null);

  const [itemEditandoId, setItemEditandoId] = useState(null);
  const [nomeItemEditando, setNomeItemEditando] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "", fecharDepois: false });
  const [errosCampos, setErrosCampos] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const veiculoSelecionado = useMemo(
    () => veiculos.find((veiculo) => String(veiculo.id) === String(veiculoId)),
    [veiculos, veiculoId]
  );

  const oficinaAtiva = useMemo(
    () => oficinas.find((oficina) => oficina.uid === oficinaAtivaId) || oficinas[0] || null,
    [oficinas, oficinaAtivaId]
  );

  const todosServicos = useMemo(
    () => oficinas.flatMap((oficina) => (oficina.servicos || []).map((servico) => ({ ...servico, oficinaUid: oficina.uid, oficinaNome: oficina.nome }))),
    [oficinas]
  );

  const servicosFiltrados = useMemo(() => {
    const termo = normalizar(buscaServico);
    if (!termo) return servicosBase;
    return servicosBase.filter((servico) => normalizar(servico.nome).includes(termo));
  }, [buscaServico, servicosBase]);

  const oficinasFiltradas = useMemo(() => {
    const termo = normalizar(buscaOficina);
    if (!termo) return oficinasBase;
    return oficinasBase.filter((oficina) => normalizar(oficina.nome).includes(termo));
  }, [buscaOficina, oficinasBase]);

  const descricoesPorEtapa = {
    1: "Informe a data, veículo e odômetro para iniciar o histórico da manutenção.",
    2: "Informe quem fez os serviços, adicione os serviços realizados e inclua os itens utilizados.",
    3: "Adicione lembretes futuros para os serviços que precisam de acompanhamento.",
  };

  useEffect(() => {
    if (!aberto) return;
    carregarDados();
    resetarFormulario(false);
  }, [aberto]);

  async function carregarDados() {
    const { data: veiculosData } = await supabase.from("veiculos").select("*").eq("ativo", true).order("id");
    setVeiculos(veiculosData || []);

    const veiculoPrincipal = (veiculosData || []).find((veiculo) => veiculo.principal) || (veiculosData || [])[0];
    if (veiculoPrincipal) setVeiculoId(String(veiculoPrincipal.id));

    await Promise.all([carregarServicosBase(), carregarOficinasBase()]);
  }

  async function carregarServicosBase() {
    const { data, error } = await supabase
      .from("servicos_manutencao")
      .select("*, itens:servicos_manutencao_itens(*)")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      console.warn("Tabela servicos_manutencao ainda não encontrada.", error.message);
      setServicosBase([]);
      return;
    }

    setServicosBase(data || []);
  }

  async function carregarOficinasBase() {
    const { data, error } = await supabase
      .from("oficinas_manutencao")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) {
      console.warn("Tabela oficinas_manutencao ainda não encontrada.", error.message);
      setOficinasBase([]);
      return;
    }

    setOficinasBase(data || []);
  }

  function resetarFormulario(limparTudo = true) {
    setEtapa(1);
    setDataManutencao(hoje);
    setOdometro("");
    setOficinas([]);
    setOficinaAtivaId(null);
    setBuscaServico("");
    setBuscaOficina("");
    setModalAdicionarServicoAberto(false);
    setModalAdicionarOficinaAberto(false);
    setGerenciandoServicos(false);
    setGerenciandoOficinas(false);
    setServicoEmAlteracao(null);
    setOficinaUidEmAlteracao(null);
    setItemEditandoId(null);
    setNomeItemEditando("");
    setErrosCampos({});
    if (limparTudo) setVeiculoId("");
  }

  function normalizar(valor) {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function formatarDataBR(dataISO) {
    if (!dataISO) return "";
    const [ano, mes, dia] = String(dataISO).split("-");
    return `${dia}/${mes}/${ano}`;
  }

  function formatarMoedaDigitada(valor) {
    const somenteDigitos = String(valor || "").replace(/\D/g, "");
    const centavos = Number(somenteDigitos || 0);
    return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moedaParaNumero(valor) {
    if (!valor) return 0;
    return Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0;
  }

  function numeroParaMoedaInput(valor) {
    return Number(valor || 0).toFixed(2).replace(".", ",");
  }

  function somenteNumeros(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function numeroQuantidade(valor) {
    return Number(String(valor || "1").replace(",", ".")) || 1;
  }

  function dataEhFutura(dataISO) {
    return !!dataISO && String(dataISO) > hoje;
  }

  function selecionarDataManutencao(dataISO) {
    if (dataEhFutura(dataISO)) {
      setDataManutencao(hoje);
      limparErroCampo("dataManutencao");
      abrirFeedback("aviso", "Data inválida", "A data da manutenção não pode ser futura.");
      return;
    }

    setDataManutencao(dataISO);
    limparErroCampo("dataManutencao");
  }

  function abrirFeedback(tipo, titulo, mensagem, fecharDepois = false) {
    setFeedback({ aberto: true, tipo, titulo, mensagem, fecharDepois });
  }

  async function fecharFeedback() {
    const fechar = feedback.fecharDepois;
    setFeedback({ aberto: false, tipo: "sucesso", titulo: "", mensagem: "", fecharDepois: false });
    if (fechar) {
      await onSalvo?.();
      onClose();
    }
  }

  function aplicarErros(novosErros) {
    setErrosCampos(novosErros);
    if (Object.keys(novosErros).length > 0) setShakeKey(Date.now());
    return Object.keys(novosErros).length === 0;
  }

  function limparErroCampo(campo) {
    setErrosCampos((atual) => {
      if (!atual[campo]) return atual;
      const novo = { ...atual };
      delete novo[campo];
      return novo;
    });
  }

  function novoItem() {
    return { uid: uid(), descricao: "", quantidade: "1", valorUnitario: "", valorTotal: "", observacoes: "" };
  }

  function criarServicoLocal(servicoBase) {
    return {
      uid: uid(),
      servico_id: servicoBase?.id || null,
      nome: servicoBase?.nome || buscaServico.trim(),
      itens: (servicoBase?.itens || []).length
        ? [...servicoBase.itens]
            .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
            .map((item) => ({
              uid: uid(),
              descricao: item.descricao || "",
              quantidade: String(item.quantidade_padrao || 1),
              valorUnitario: item.valor_padrao ? numeroParaMoedaInput(item.valor_padrao) : "",
              valorTotal: item.valor_padrao ? numeroParaMoedaInput(Number(item.valor_padrao || 0) * Number(item.quantidade_padrao || 1)) : "",
              observacoes: item.observacoes || "",
            }))
        : [novoItem()],
      criarLembrete: false,
      tipoLembrete: servicoBase?.periodicidade_km ? "km" : servicoBase?.periodicidade_meses ? "data" : "km",
      proximaRevisaoKm: servicoBase?.periodicidade_km ? String(servicoBase.periodicidade_km) : "",
      proximaRevisaoMeses: servicoBase?.periodicidade_meses ? String(servicoBase.periodicidade_meses) : "",
    };
  }

  function criarOficinaLocal(oficinaBase) {
    return {
      uid: uid(),
      oficina_id: oficinaBase?.id || null,
      nome: oficinaBase?.nome || buscaOficina.trim(),
      maoObra: oficinaBase?.maoObra || "",
      observacoes: oficinaBase?.observacoes || "",
      servicoAtivoId: oficinaBase?.servicoAtivoId || null,
      servicos: oficinaBase?.servicos || [],
    };
  }

  function abrirAdicionarOficina() {
    setOficinaUidEmAlteracao(null);
    setBuscaOficina("");
    setGerenciandoOficinas(false);
    setModalAdicionarOficinaAberto(true);
  }

  function abrirAlterarOficina(itemAba) {
    setOficinaUidEmAlteracao(itemAba.id);
    setBuscaOficina("");
    setGerenciandoOficinas(false);
    setModalAdicionarOficinaAberto(true);
  }

  function abrirAdicionarServico(oficinaUid) {
    const uidOficina = oficinaUid || oficinaAtiva?.uid;
    if (!uidOficina) return;
    setServicoEmAlteracao({ oficinaUid: uidOficina, servicoUid: null });
    setBuscaServico("");
    setGerenciandoServicos(false);
    setModalAdicionarServicoAberto(true);
  }

  function abrirAlterarServico(oficinaUid, servicoUid) {
    setServicoEmAlteracao({ oficinaUid, servicoUid });
    setBuscaServico("");
    setGerenciandoServicos(false);
    setModalAdicionarServicoAberto(true);
  }

  async function adicionarOficinaBase(oficinaBase) {
    const nova = criarOficinaLocal(oficinaBase);

    if (oficinaUidEmAlteracao) {
      setOficinas((lista) =>
        lista.map((oficina) =>
          oficina.uid === oficinaUidEmAlteracao
            ? { ...oficina, oficina_id: nova.oficina_id, nome: nova.nome }
            : oficina
        )
      );
      setOficinaAtivaId(oficinaUidEmAlteracao);
    } else {
      setOficinas((lista) => [...lista, nova]);
      setOficinaAtivaId(nova.uid);
    }

    setOficinaUidEmAlteracao(null);
    setBuscaOficina("");
    setModalAdicionarOficinaAberto(false);
  }

  async function adicionarEuMesmo() {
    await adicionarOficinaBase({ id: null, nome: "Eu mesmo" });
  }

  async function criarOficinaPelaBusca() {
    const nome = buscaOficina.trim();
    if (!nome) return;

    const existente = oficinasBase.find((oficina) => normalizar(oficina.nome) === normalizar(nome));
    if (existente) {
      adicionarOficinaBase(existente);
      return;
    }

    const { data, error } = await supabase.from("oficinas_manutencao").insert({ nome, ativo: true }).select().single();
    if (!error && data) {
      await carregarOficinasBase();
      adicionarOficinaBase(data);
      return;
    }

    adicionarOficinaBase({ id: null, nome });
  }

  async function adicionarServicoBase(servicoBase) {
    if (!servicoEmAlteracao?.oficinaUid) return;

    const novo = criarServicoLocal(servicoBase);

    setOficinas((lista) =>
      lista.map((oficina) => {
        if (oficina.uid !== servicoEmAlteracao.oficinaUid) return oficina;

        if (servicoEmAlteracao.servicoUid) {
          return {
            ...oficina,
            servicos: oficina.servicos.map((servico) =>
              servico.uid === servicoEmAlteracao.servicoUid
                ? {
                    ...servico,
                    servico_id: novo.servico_id,
                    nome: novo.nome,
                    itens: servico.itens?.length ? servico.itens : novo.itens,
                    tipoLembrete: novo.tipoLembrete,
                    proximaRevisaoKm: novo.proximaRevisaoKm,
                    proximaRevisaoMeses: novo.proximaRevisaoMeses,
                  }
                : servico
            ),
          };
        }

        return { ...oficina, servicos: [...(oficina.servicos || []), novo], servicoAtivoId: novo.uid };
      })
    );

    setServicoEmAlteracao(null);
    setBuscaServico("");
    setModalAdicionarServicoAberto(false);
  }

  async function criarServicoPelaBusca() {
    const nome = buscaServico.trim();
    if (!nome) return;

    const existente = servicosBase.find((servico) => normalizar(servico.nome) === normalizar(nome));
    if (existente) {
      adicionarServicoBase(existente);
      return;
    }

    const { data, error } = await supabase.from("servicos_manutencao").insert({ nome, ativo: true }).select().single();
    if (!error && data) {
      await carregarServicosBase();
      adicionarServicoBase({ ...data, itens: [] });
      return;
    }

    adicionarServicoBase({ id: null, nome, itens: [] });
  }

  async function editarItemBase({ tabela, item, novoNome }) {
    const nome = String(novoNome || "").trim();
    if (!item?.id || !nome) return;

    const { error } = await supabase.from(tabela).update({ nome }).eq("id", item.id);
    if (error) {
      abrirFeedback("erro", "Erro ao editar", error.message || "Não foi possível editar o item.");
      return;
    }

    setItemEditandoId(null);
    setNomeItemEditando("");
    if (tabela === "servicos_manutencao") await carregarServicosBase();
    if (tabela === "oficinas_manutencao") await carregarOficinasBase();
  }

  async function ocultarItemBase({ tabela, item }) {
    if (!item?.id) return;

    const { error } = await supabase.from(tabela).update({ ativo: false }).eq("id", item.id);
    if (error) {
      abrirFeedback("erro", "Erro ao ocultar", error.message || "Não foi possível ocultar o item.");
      return;
    }

    if (tabela === "servicos_manutencao") await carregarServicosBase();
    if (tabela === "oficinas_manutencao") await carregarOficinasBase();
  }

  function atualizarOficina(oficinaUid, patch) {
    setOficinas((lista) => lista.map((oficina) => (oficina.uid === oficinaUid ? { ...oficina, ...patch } : oficina)));
  }

  function removerOficina(oficinaUid) {
    setOficinas((lista) => {
      const proximaLista = lista.filter((oficina) => oficina.uid !== oficinaUid);
      if (oficinaAtivaId === oficinaUid) setOficinaAtivaId(proximaLista[0]?.uid || null);
      return proximaLista;
    });
  }

  function atualizarServico(oficinaUid, servicoUid, patch) {
    setOficinas((lista) =>
      lista.map((oficina) =>
        oficina.uid === oficinaUid
          ? { ...oficina, servicos: oficina.servicos.map((servico) => (servico.uid === servicoUid ? { ...servico, ...patch } : servico)) }
          : oficina
      )
    );
  }

  function removerServico(oficinaUid, servicoUid) {
    setOficinas((lista) =>
      lista.map((oficina) =>
        oficina.uid === oficinaUid
          ? (() => {
              const proximosServicos = oficina.servicos.filter((servico) => servico.uid !== servicoUid);
              const proximoAtivo = oficina.servicoAtivoId === servicoUid ? proximosServicos[0]?.uid || null : oficina.servicoAtivoId;
              return { ...oficina, servicos: proximosServicos, servicoAtivoId: proximoAtivo };
            })()
          : oficina
      )
    );
  }

  function atualizarItem(oficinaUid, servicoUid, itemUid, patch) {
    setOficinas((lista) =>
      lista.map((oficina) =>
        oficina.uid === oficinaUid
          ? {
              ...oficina,
              servicos: oficina.servicos.map((servico) =>
                servico.uid === servicoUid
                  ? { ...servico, itens: servico.itens.map((item) => (item.uid === itemUid ? { ...item, ...patch } : item)) }
                  : servico
              ),
            }
          : oficina
      )
    );
  }

  function atualizarQuantidadeItem(oficinaUid, servico, item, quantidade) {
    const qtd = numeroQuantidade(quantidade);
    const unitario = moedaParaNumero(item.valorUnitario);
    const patch = { quantidade };
    if (unitario > 0) patch.valorTotal = numeroParaMoedaInput(unitario * qtd);
    atualizarItem(oficinaUid, servico.uid, item.uid, patch);
  }

  function atualizarValorUnitarioItem(oficinaUid, servico, item, valor) {
    const valorFormatado = formatarMoedaDigitada(valor);
    const total = moedaParaNumero(valorFormatado) * numeroQuantidade(item.quantidade);
    atualizarItem(oficinaUid, servico.uid, item.uid, {
      valorUnitario: valorFormatado,
      valorTotal: total > 0 ? numeroParaMoedaInput(total) : "",
    });
  }

  function atualizarValorTotalItem(oficinaUid, servico, item, valor) {
    const valorFormatado = formatarMoedaDigitada(valor);
    const total = moedaParaNumero(valorFormatado);
    const qtd = numeroQuantidade(item.quantidade);
    atualizarItem(oficinaUid, servico.uid, item.uid, {
      valorTotal: valorFormatado,
      valorUnitario: total > 0 && qtd > 0 ? numeroParaMoedaInput(total / qtd) : item.valorUnitario,
    });
  }

  function removerItem(oficinaUid, servicoUid, itemUid) {
    setOficinas((lista) =>
      lista.map((oficina) =>
        oficina.uid === oficinaUid
          ? {
              ...oficina,
              servicos: oficina.servicos.map((servico) =>
                servico.uid === servicoUid ? { ...servico, itens: servico.itens.filter((item) => item.uid !== itemUid) } : servico
              ),
            }
          : oficina
      )
    );
  }

  function validarEtapaAtual() {
    const erros = {};

    if (etapa === 1) {
      if (!dataManutencao) erros.dataManutencao = "Informe a data da manutenção.";
      else if (dataEhFutura(dataManutencao)) erros.dataManutencao = "A data não pode ser futura.";
      if (!veiculoId) erros.veiculoId = "Selecione o veículo.";
      if (!odometro) erros.odometro = "Informe o odômetro.";
    }

    if (etapa === 2) {
      if (!oficinas.length) erros.oficinas = "Adicione quem realizou os serviços.";

      oficinas.forEach((oficina) => {
        if (!oficina.servicos?.length) erros[`oficina-${oficina.uid}`] = "Adicione pelo menos um serviço nesta oficina/execução.";

        oficina.servicos?.forEach((servico) => {
          if (!servico.itens.length) erros[`servico-${servico.uid}`] = "Adicione pelo menos um item neste serviço.";
          servico.itens.forEach((item) => {
            if (!item.descricao?.trim()) erros[`item-${item.uid}`] = "Informe o item utilizado.";
          });
        });
      });
    }

    return aplicarErros(erros);
  }

  function proximaEtapa() {
    if (!validarEtapaAtual()) return;
    setEtapa((atual) => Math.min(atual + 1, 3));
  }

  function validarFinal() {
    const erros = {};

    if (!dataManutencao) erros.dataManutencao = "Informe a data da manutenção.";
    else if (dataEhFutura(dataManutencao)) erros.dataManutencao = "A data não pode ser futura.";
    if (!veiculoId) erros.veiculoId = "Selecione o veículo.";
    if (!odometro) erros.odometro = "Informe o odômetro.";
    if (!oficinas.length) erros.oficinas = "Adicione quem realizou os serviços.";

    oficinas.forEach((oficina) => {
      if (!oficina.servicos?.length) erros[`oficina-${oficina.uid}`] = "Adicione pelo menos um serviço nesta oficina/execução.";

      oficina.servicos?.forEach((servico) => {
        if (!servico.itens.length) erros[`servico-${servico.uid}`] = "Adicione pelo menos um item neste serviço.";
        servico.itens.forEach((item) => {
          if (!item.descricao?.trim()) erros[`item-${item.uid}`] = "Informe o item utilizado.";
        });
      });
    });

    return aplicarErros(erros);
  }

  async function salvar() {
    if (!validarFinal()) return;

    setSalvando(true);

    try {
      const nomeManutencao = todosServicos.map((servico) => servico.nome).filter(Boolean).join(" + ").slice(0, 180) || "Manutenção";

      const { data: manutencaoCriada, error: erroManutencao } = await supabase
        .from("manutencoes")
        .insert({
          data: dataManutencao,
          veiculo_id: Number(veiculoId),
          odometro: Number(odometro || 0),
          titulo: nomeManutencao,
          observacoes: null,
        })
        .select()
        .single();

      if (erroManutencao) throw erroManutencao;

      const manutencaoId = manutencaoCriada?.id;

      for (const oficina of oficinas) {
        const { error: erroOficina } = await supabase.from("manutencao_oficinas").insert({
          manutencao_id: manutencaoId,
          oficina_id: oficina.oficina_id,
          nome: oficina.nome,
          valor_mao_obra: moedaParaNumero(oficina.maoObra) || null,
          observacoes: null,
        });

        if (erroOficina) throw erroOficina;

        for (const servico of oficina.servicos || []) {
          const criarLembrete = !!servico.criarLembrete;
          const usaKm = criarLembrete && ["km", "km_data"].includes(servico.tipoLembrete);
          const usaData = criarLembrete && ["data", "km_data"].includes(servico.tipoLembrete);
          const proximaKm = usaKm && servico.proximaRevisaoKm ? Number(odometro || 0) + Number(servico.proximaRevisaoKm || 0) : null;

          const { data: servicoCriado, error: erroServico } = await supabase
            .from("manutencao_servicos")
            .insert({
              manutencao_id: manutencaoId,
              servico_id: servico.servico_id,
              nome: servico.nome,
              proxima_revisao_km: proximaKm,
              periodicidade_km: usaKm ? Number(servico.proximaRevisaoKm || 0) || null : null,
              periodicidade_meses: usaData ? Number(servico.proximaRevisaoMeses || 0) || null : null,
            })
            .select()
            .single();

          if (erroServico) throw erroServico;

          for (const item of servico.itens) {
            const { error: erroItem } = await supabase.from("manutencao_itens").insert({
              manutencao_id: manutencaoId,
              manutencao_servico_id: servicoCriado?.id || null,
              descricao: item.descricao,
              quantidade: numeroQuantidade(item.quantidade),
              valor_estimado: moedaParaNumero(item.valorTotal) || null,
              observacoes: item.observacoes || null,
            });

            if (erroItem) throw erroItem;
          }
        }
      }

      if (Number(odometro || 0) > Number(veiculoSelecionado?.odometro_atual || 0)) {
        await supabase.from("veiculos").update({ odometro_atual: Number(odometro || 0) }).eq("id", Number(veiculoId));
      }

      abrirFeedback("sucesso", "Histórico atualizado", "A manutenção foi registrada no histórico do veículo.", true);
      resetarFormulario(false);
    } catch (error) {
      console.error(error);
      abrirFeedback("erro", "Erro ao salvar", error.message || "Erro ao salvar histórico de manutenção.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <>
      <style>{`@keyframes cd-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } } .cd-shake { animation: cd-shake .22s ease-in-out; }`}</style>

      <ModalBase
        aberto={aberto}
        titulo="Manutenção (Atualizar Histórico)"
        descricao={descricoesPorEtapa[etapa] || "Informe os serviços realizados para manter o histórico de manutenções do veículo atualizado."}
        onClose={onClose}
        largura="max-w-6xl"
      
        confirmarAoFecharSeAlterado>
        <BarraEtapas etapa={etapa} total={3} />

        {etapa === 1 && (
          <section className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="Data">
                <ButtonField onClick={() => { limparErroCampo("dataManutencao"); setModalDataAberto(true); }} erro={errosCampos.dataManutencao} shakeKey={shakeKey}>
                  {formatarDataBR(dataManutencao)}
                </ButtonField>
              </Campo>

              <Campo label="Veículo">
                <ButtonField onClick={() => { limparErroCampo("veiculoId"); setModalVeiculoAberto(true); }} erro={errosCampos.veiculoId} shakeKey={shakeKey}>
                  {veiculoSelecionado?.nome || "Selecionar veículo"}
                </ButtonField>
              </Campo>

              <Campo label="Odômetro">
                <TextInput value={odometro} onChange={(valor) => { limparErroCampo("odometro"); setOdometro(somenteNumeros(valor)); }} suffix="km" placeholder="Ex: 150000" erro={errosCampos.odometro} shakeKey={shakeKey} />
              </Campo>
            </div>
          </section>
        )}

        {etapa === 2 && (
          <section className="mt-6 space-y-5">
            {errosCampos.oficinas && <ErroCampo mensagem={errosCampos.oficinas} shakeKey={shakeKey} />}

            {oficinas.length === 0 ? (
              <EmptyState
                titulo="Nenhuma execução adicionada."
                descricao="Adicione uma oficina ou marque que você mesmo realizou os serviços."
                botao="Adicionar execução"
                onClick={abrirAdicionarOficina}
              />
            ) : (
              <div className="space-y-4">
                {oficinas.map((oficina) => (
                  <OficinaCard
                    key={oficina.uid}
                    oficina={oficina}
                    errosCampos={errosCampos}
                    shakeKey={shakeKey}
                    limparErroCampo={limparErroCampo}
                    atualizarOficina={atualizarOficina}
                    removerOficina={removerOficina}
                    abrirAlterarOficina={() => abrirAlterarOficina({ id: oficina.uid })}
                    abrirAdicionarServico={abrirAdicionarServico}
                    abrirAlterarServico={abrirAlterarServico}
                    atualizarItem={atualizarItem}
                    atualizarQuantidadeItem={atualizarQuantidadeItem}
                    atualizarValorUnitarioItem={atualizarValorUnitarioItem}
                    atualizarValorTotalItem={atualizarValorTotalItem}
                    atualizarServico={atualizarServico}
                    removerServico={removerServico}
                    removerItem={removerItem}
                    novoItem={novoItem}
                    formatarMoedaDigitada={formatarMoedaDigitada}
                  />
                ))}

                <button type="button" onClick={abrirAdicionarOficina} className="w-full rounded-xl border border-green-500/50 text-green-400 hover:bg-green-500/10 font-bold p-3 flex items-center justify-center gap-2">
                  <FiPlus /> Adicionar execução
                </button>
              </div>
            )}
          </section>
        )}

        {etapa === 3 && (
          <section className="mt-6 space-y-3">
            {todosServicos.map((servico) => (
              <div key={servico.uid} className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4">
                <button type="button" onClick={() => atualizarServico(servico.oficinaUid, servico.uid, { criarLembrete: !servico.criarLembrete })} className="w-full flex items-start gap-3 text-left">
                  <span className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center ${servico.criarLembrete ? "border-green-400 bg-green-500 text-black" : "border-gray-600"}`}>
                    {servico.criarLembrete ? "✓" : ""}
                  </span>
                  <span>
                    <span className="block font-black text-white">{servico.nome}</span>
                    <span className="block text-xs text-gray-500 mt-1">{servico.oficinaNome} • criar lembrete futuro para este serviço</span>
                  </span>
                </button>

                {servico.criarLembrete && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <ToggleButton ativo={servico.tipoLembrete === "km"} onClick={() => atualizarServico(servico.oficinaUid, servico.uid, { tipoLembrete: "km" })}>Por KM</ToggleButton>
                      <ToggleButton ativo={servico.tipoLembrete === "data"} onClick={() => atualizarServico(servico.oficinaUid, servico.uid, { tipoLembrete: "data" })}>Por data</ToggleButton>
                      <ToggleButton ativo={servico.tipoLembrete === "km_data"} onClick={() => atualizarServico(servico.oficinaUid, servico.uid, { tipoLembrete: "km_data" })}>KM e data</ToggleButton>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {["km", "km_data"].includes(servico.tipoLembrete) && (
                        <Campo label="Próxima em quantos KM">
                          <TextInput value={servico.proximaRevisaoKm} onChange={(valor) => atualizarServico(servico.oficinaUid, servico.uid, { proximaRevisaoKm: somenteNumeros(valor) })} suffix="km" placeholder="Ex: 10000" />
                        </Campo>
                      )}

                      {["data", "km_data"].includes(servico.tipoLembrete) && (
                        <Campo label="Próxima em quantos meses">
                          <TextInput value={servico.proximaRevisaoMeses} onChange={(valor) => atualizarServico(servico.oficinaUid, servico.uid, { proximaRevisaoMeses: somenteNumeros(valor) })} suffix="meses" placeholder="Ex: 6" />
                        </Campo>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-4 mt-6 -mx-1 pt-4 pb-1 bg-[#111827]">
          <button type="button" onClick={etapa === 1 ? onClose : () => setEtapa((atual) => Math.max(atual - 1, 1))} className="border border-gray-700 hover:bg-white/5 text-white font-bold rounded-xl p-3">
            {etapa === 1 ? "Cancelar" : "Voltar"}
          </button>

          {etapa < 3 ? (
            <button type="button" onClick={proximaEtapa} className="bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl p-3">
              Continuar
            </button>
          ) : (
            <button type="button" onClick={salvar} disabled={salvando} className="bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold rounded-xl p-3">
              {salvando ? "Salvando..." : "Salvar histórico"}
            </button>
          )}
        </div>
      </ModalBase>

      <ModalBase
        aberto={modalAdicionarOficinaAberto}
        titulo={oficinaUidEmAlteracao ? "Alterar execução" : "Adicionar execução"}
        descricao="Busque uma oficina salva, crie uma nova ou informe que você mesmo realizou os serviços."
        onClose={() => {
          setModalAdicionarOficinaAberto(false);
          setGerenciandoOficinas(false);
          setOficinaUidEmAlteracao(null);
        }}
        largura="max-w-3xl"
        acaoCabecalho={
          <button type="button" onClick={() => setGerenciandoOficinas((atual) => !atual)} className={`w-10 h-10 rounded-xl border ${gerenciandoOficinas ? "border-green-500 text-green-400 bg-green-500/10" : "border-gray-700 text-gray-300 hover:bg-white/5"} flex items-center justify-center`} title="Gerenciar oficinas">
            <FiEdit2 />
          </button>
        }
      >
        {!gerenciandoOficinas && (
          <button type="button" onClick={adicionarEuMesmo} className="w-full mb-3 rounded-xl border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 font-black p-3">
            Eu mesmo realizei os serviços
          </button>
        )}

        <BuscaCriacao
          valor={buscaOficina}
          onChange={setBuscaOficina}
          placeholder="Buscar oficina. Ex: Ra-Mec, borracharia..."
          resultados={oficinasFiltradas}
          getTitulo={(item) => item.nome}
          onSelecionar={adicionarOficinaBase}
          onCriar={criarOficinaPelaBusca}
          textoCriar="Criar nova oficina"
          gerenciando={gerenciandoOficinas}
          itemEditandoId={itemEditandoId}
          nomeItemEditando={nomeItemEditando}
          setItemEditandoId={setItemEditandoId}
          setNomeItemEditando={setNomeItemEditando}
          onEditar={(item, novoNome) => editarItemBase({ tabela: "oficinas_manutencao", item, novoNome })}
          onOcultar={(item) => ocultarItemBase({ tabela: "oficinas_manutencao", item })}
        />
      </ModalBase>

      <ModalBase
        aberto={modalAdicionarServicoAberto}
        titulo={servicoEmAlteracao?.servicoUid ? "Alterar serviço" : "Adicionar serviço"}
        descricao="Busque um serviço salvo ou crie um novo modelo para reutilizar depois."
        onClose={() => {
          setModalAdicionarServicoAberto(false);
          setGerenciandoServicos(false);
          setServicoEmAlteracao(null);
        }}
        largura="max-w-3xl"
        acaoCabecalho={
          <button type="button" onClick={() => setGerenciandoServicos((atual) => !atual)} className={`w-10 h-10 rounded-xl border ${gerenciandoServicos ? "border-green-500 text-green-400 bg-green-500/10" : "border-gray-700 text-gray-300 hover:bg-white/5"} flex items-center justify-center`} title="Gerenciar serviços">
            <FiEdit2 />
          </button>
        }
      >
        <BuscaCriacao
          valor={buscaServico}
          onChange={setBuscaServico}
          placeholder="Buscar serviço. Ex: troca de óleo, freios, revisão..."
          resultados={servicosFiltrados}
          getTitulo={(item) => item.nome}
          onSelecionar={adicionarServicoBase}
          onCriar={criarServicoPelaBusca}
          textoCriar="Criar novo serviço"
          gerenciando={gerenciandoServicos}
          itemEditandoId={itemEditandoId}
          nomeItemEditando={nomeItemEditando}
          setItemEditandoId={setItemEditandoId}
          setNomeItemEditando={setNomeItemEditando}
          onEditar={(item, novoNome) => editarItemBase({ tabela: "servicos_manutencao", item, novoNome })}
          onOcultar={(item) => ocultarItemBase({ tabela: "servicos_manutencao", item })}
        />
      </ModalBase>

      <DatePickerModal
        aberto={modalDataAberto}
        valor={dataManutencao}
        maxDate={hoje}
        onChange={selecionarDataManutencao}
        onClose={() => setModalDataAberto(false)}
        titulo="Selecionar data"
        descricao="Escolha a data da manutenção. Datas futuras não são permitidas."
      />
      <SelecionarVeiculoModal aberto={modalVeiculoAberto} veiculos={veiculos} veiculoId={veiculoId} onSelecionar={setVeiculoId} onClose={() => setModalVeiculoAberto(false)} />
      <FeedbackModal aberto={feedback.aberto} tipo={feedback.tipo} titulo={feedback.titulo} mensagem={feedback.mensagem} onClose={fecharFeedback} />
    </>
  );
}

function OficinaCard({
  oficina,
  errosCampos,
  shakeKey,
  limparErroCampo,
  atualizarOficina,
  removerOficina,
  abrirAlterarOficina,
  abrirAdicionarServico,
  abrirAlterarServico,
  atualizarItem,
  atualizarQuantidadeItem,
  atualizarValorUnitarioItem,
  atualizarValorTotalItem,
  atualizarServico,
  removerServico,
  removerItem,
  novoItem,
  formatarMoedaDigitada,
}) {
  const servicos = oficina.servicos || [];
  const servicoAtivo = servicos.find((servico) => servico.uid === oficina.servicoAtivoId) || servicos[0] || null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#0B1120] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={abrirAlterarOficina} className="text-left min-w-0">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Execução</p>
          <h3 className="font-black text-white truncate mt-1">{oficina.nome || "Execução"}</h3>
        </button>

        <button type="button" onClick={() => removerOficina(oficina.uid)} className="w-10 h-10 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center justify-center" title="Remover execução">
          <FiTrash2 />
        </button>
      </div>

      {errosCampos[`oficina-${oficina.uid}`] && <ErroCampo mensagem={errosCampos[`oficina-${oficina.uid}`]} shakeKey={shakeKey} />}

      <div className="max-w-md">
        <Campo label="Valor da mão de obra">
          <TextInput value={oficina.maoObra || ""} onChange={(valor) => atualizarOficina(oficina.uid, { maoObra: formatarMoedaDigitada(valor) })} prefix="R$" placeholder="Opcional" />
        </Campo>
      </div>

      {servicos.length === 0 ? (
        <EmptyState
          titulo="Nenhum serviço adicionado nesta execução."
          descricao="Adicione os serviços realizados por esta oficina ou por você mesmo."
          botao="Adicionar serviço"
          onClick={() => abrirAdicionarServico(oficina.uid)}
        />
      ) : servicoAtivo ? (
        <AbasCartao
          itens={servicos.map((servico) => ({ id: servico.uid, titulo: servico.nome || "Serviço" }))}
          ativoId={servicoAtivo.uid}
          onSelecionar={(servicoUid) => atualizarOficina(oficina.uid, { servicoAtivoId: servicoUid })}
          onAdicionar={() => abrirAdicionarServico(oficina.uid)}
          onEditarAba={(itemAba) => abrirAlterarServico(oficina.uid, itemAba.id)}
          onExcluirAba={(itemAba) => removerServico(oficina.uid, itemAba.id)}
          podeExcluirAba={() => true}
          titleAdicionar="Adicionar serviço"
        >
          <ServicoCard
            oficinaUid={oficina.uid}
            servico={servicoAtivo}
            errosCampos={errosCampos}
            shakeKey={shakeKey}
            limparErroCampo={limparErroCampo}
            atualizarItem={atualizarItem}
            atualizarQuantidadeItem={atualizarQuantidadeItem}
            atualizarValorUnitarioItem={atualizarValorUnitarioItem}
            atualizarValorTotalItem={atualizarValorTotalItem}
            atualizarServico={atualizarServico}
            removerItem={removerItem}
            novoItem={novoItem}
          />
        </AbasCartao>
      ) : null}
    </div>
  );
}

function ServicoCard({
  oficinaUid,
  servico,
  errosCampos,
  shakeKey,
  limparErroCampo,
  atualizarItem,
  atualizarQuantidadeItem,
  atualizarValorUnitarioItem,
  atualizarValorTotalItem,
  atualizarServico,
  removerItem,
  novoItem,
}) {
  return (
    <div className="space-y-4">
      {errosCampos[`servico-${servico.uid}`] && <ErroCampo mensagem={errosCampos[`servico-${servico.uid}`]} shakeKey={shakeKey} />}

      <div className="space-y-3">
        {servico.itens.map((item) => (
          <div key={item.uid} className="rounded-xl border border-gray-800 bg-[#111827] p-3">
            <div className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-12 md:col-span-4">
                <Campo label="Item">
                  <FieldInput
                    value={item.descricao}
                    onChange={(valor) => {
                      limparErroCampo(`item-${item.uid}`);
                      atualizarItem(oficinaUid, servico.uid, item.uid, { descricao: valor });
                    }}
                    placeholder="Ex: Óleo 5W30"
                    erro={errosCampos[`item-${item.uid}`]}
                    shakeKey={shakeKey}
                  />
                </Campo>
              </div>

              <div className="col-span-6 md:col-span-2">
                <Campo label="Quantidade">
                  <FieldInput value={item.quantidade} onChange={(valor) => atualizarQuantidadeItem(oficinaUid, servico, item, valor)} />
                </Campo>
              </div>

              <div className="col-span-6 md:col-span-2">
                <Campo label="Valor unitário">
                  <TextInput value={item.valorUnitario || ""} onChange={(valor) => atualizarValorUnitarioItem(oficinaUid, servico, item, valor)} prefix="R$" placeholder="" />
                </Campo>
              </div>

              <div className="col-span-10 md:col-span-3">
                <Campo label="Valor total">
                  <TextInput value={item.valorTotal || ""} onChange={(valor) => atualizarValorTotalItem(oficinaUid, servico, item, valor)} prefix="R$" placeholder="" />
                </Campo>
              </div>

              <div className="col-span-2 md:col-span-1 flex items-end">
                <button type="button" onClick={() => removerItem(oficinaUid, servico.uid, item.uid)} className="w-full h-11 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center justify-center" title="Remover item">
                  <FiTrash2 />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => atualizarServico(oficinaUid, servico.uid, { itens: [...servico.itens, novoItem()] })} className="w-full rounded-xl border border-green-500/50 text-green-400 hover:bg-green-500/10 font-bold p-3 flex items-center justify-center gap-2">
        <FiPlus /> Adicionar item
      </button>
    </div>
  );
}

function EmptyState({ titulo, descricao, botao, onClick }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-700 bg-[#0B1120]/50 p-6 text-center">
      <h3 className="font-black text-white">{titulo}</h3>
      <p className="text-sm text-gray-400 mt-2">{descricao}</p>
      {botao ? (
        <button type="button" onClick={onClick} className="mt-5 rounded-xl bg-green-500 hover:bg-green-600 text-black font-black px-5 py-3 inline-flex items-center justify-center gap-2">
          <FiPlus /> {botao}
        </button>
      ) : null}
    </div>
  );
}

function ToggleButton({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border p-3 font-black ${ativo ? "border-green-400 bg-green-500/10 text-green-400" : "border-gray-700 text-gray-300 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

function BuscaCriacao({
  valor,
  onChange,
  placeholder,
  resultados,
  getTitulo,
  onSelecionar,
  onCriar,
  textoCriar,
  gerenciando = false,
  itemEditandoId = null,
  nomeItemEditando = "",
  setItemEditandoId = () => {},
  setNomeItemEditando = () => {},
  onEditar = () => {},
  onOcultar = () => {},
}) {
  const temBusca = valor.trim().length > 0;
  const existeIgual = resultados.some((item) => getTitulo(item).trim().toLowerCase() === valor.trim().toLowerCase());

  function iniciarEdicao(item) {
    setItemEditandoId(item.id);
    setNomeItemEditando(getTitulo(item));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-[#0B1120] border border-gray-700 rounded-xl px-3">
        <FiSearch className="text-gray-500" />
        <input value={valor} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-transparent p-3 outline-none" />
      </div>

      {gerenciando && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-300">
          Modo edição ativo. Clique no nome para editar ou use a lixeira para ocultar da lista.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-1 scrollbar-hide">
        {resultados.map((item) => {
          const editando = gerenciando && itemEditandoId === item.id;

          if (editando) {
            return (
              <div key={item.id || getTitulo(item)} className="rounded-xl border border-green-500/40 bg-[#0B1120] p-3 space-y-3">
                <input value={nomeItemEditando} onChange={(event) => setNomeItemEditando(event.target.value)} className="w-full bg-[#111827] border border-gray-700 focus:border-green-400 rounded-xl p-3 outline-none font-bold" autoFocus />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => onEditar(item, nomeItemEditando)} className="rounded-xl bg-green-500 hover:bg-green-600 text-black font-black p-3">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setItemEditandoId(null)} className="rounded-xl border border-gray-700 text-gray-300 hover:bg-white/5 font-black p-3">
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={item.id || getTitulo(item)} className="rounded-xl border border-gray-700 bg-[#0B1120] overflow-hidden flex items-stretch">
              <button type="button" onClick={() => (gerenciando ? iniciarEdicao(item) : onSelecionar(item))} className="flex-1 hover:bg-green-500/10 hover:text-green-400 text-left p-3 font-bold">
                {getTitulo(item)}
              </button>

              {gerenciando && (
                <button type="button" onClick={() => onOcultar(item)} className="w-12 border-l border-gray-800 text-red-400 hover:bg-red-500/10 flex items-center justify-center" title="Ocultar">
                  <FiTrash2 />
                </button>
              )}
            </div>
          );
        })}

        {temBusca && !existeIgual && !gerenciando && (
          <button type="button" onClick={onCriar} className="rounded-xl border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 text-left p-3 font-black flex items-center gap-2">
            <FiPlus /> {textoCriar}: {valor}
          </button>
        )}
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div className="w-full">
      <label className="text-sm text-gray-300 font-semibold">{label}</label>
      {children}
    </div>
  );
}

function ErroCampo({ mensagem, shakeKey }) {
  return <p key={shakeKey} className="cd-shake text-xs text-red-400 font-semibold mt-2">{mensagem}</p>;
}

function erroClasse(erro) {
  return erro ? "border-red-500/80 focus-within:border-red-400" : "border-gray-700 focus-within:border-green-400";
}

function ButtonField({ children, onClick, erro, shakeKey }) {
  return (
    <>
      <button key={erro ? shakeKey : "ok"} type="button" onClick={onClick} className={`w-full mt-2 bg-[#0B1120] border ${erroClasse(erro)} hover:border-green-400 rounded-xl p-3 text-left font-semibold min-h-[46px] ${erro ? "cd-shake" : ""}`}>
        {children}
      </button>
      {erro && <ErroCampo mensagem={erro} shakeKey={shakeKey} />}
    </>
  );
}

function FieldInput({ value, onChange, placeholder, erro, shakeKey }) {
  return (
    <>
      <input key={erro ? shakeKey : "ok"} type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`w-full mt-2 bg-[#0B1120] border ${erroClasse(erro)} rounded-xl p-3 outline-none min-h-[46px] ${erro ? "cd-shake" : ""}`} />
      {erro && <ErroCampo mensagem={erro} shakeKey={shakeKey} />}
    </>
  );
}

function TextInput({ value, onChange, prefix, suffix, placeholder, erro, shakeKey }) {
  return (
    <>
      <div key={erro ? shakeKey : "ok"} className={`flex items-center mt-2 bg-[#0B1120] border ${erroClasse(erro)} rounded-xl overflow-hidden ${erro ? "cd-shake" : ""}`}>
        {prefix && <span className="px-3 text-gray-400">{prefix}</span>}
        <input type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent p-3 outline-none min-h-[46px]" />
        {suffix && <span className="px-3 text-gray-400">{suffix}</span>}
      </div>
      {erro && <ErroCampo mensagem={erro} shakeKey={shakeKey} />}
    </>
  );
}
