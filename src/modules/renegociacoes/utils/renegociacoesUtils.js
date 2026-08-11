export { formatarMoeda } from "../../../shared/utils/moeda.js";
import { criarItensParcela } from "../../../shared/utils/parcelasContratos.js";

export const MODELO_ENTRADA_INDEPENDENTE = "entrada_independente_v2";

export function usaEntradaIndependente(itens = []) {
  return itens.some(
    (item) => item?.payload?._acordo?.modelo_valores === MODELO_ENTRADA_INDEPENDENTE
      || item?._acordo?.modelo_valores === MODELO_ENTRADA_INDEPENDENTE
  );
}

export function calcularTotalParcelamento(valorRenegociado, valorEntrada, entradaIndependente) {
  const total = Number(valorRenegociado || 0);
  return entradaIndependente
    ? Math.max(total, 0)
    : Math.max(total - Number(valorEntrada || 0), 0);
}

export function calcularValorParcelaRenegociacao({
  valorRenegociado,
  valorEntrada,
  numeroParcelas,
  entradaIndependente,
}) {
  const parcelas = Math.max(Number(numeroParcelas || 1), 1);
  return calcularTotalParcelamento(valorRenegociado, valorEntrada, entradaIndependente) / parcelas;
}

export function formatarMoedaDigitada(valor) {
  const somenteDigitos = String(valor ?? "").replace(/\D/g, "");
  if (!somenteDigitos) return "";

  const centavos = Number(somenteDigitos.replace(/^0+/, "") || "0");
  if (!centavos) return "";

  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function numeroParaMoedaInput(valor) {
  const numero = Number(valor || 0);
  if (!numero) return "";

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moedaParaNumero(valor) {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0;
}

export function hojeISO() {
  return new Date().toISOString().split("T")[0];
}

export function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function adicionarMeses(dataISO, meses) {
  if (!dataISO) return "";

  const data = new Date(`${dataISO}T00:00:00`);
  const diaOriginal = data.getDate();

  data.setMonth(data.getMonth() + Number(meses || 0));

  if (data.getDate() !== diaOriginal) {
    data.setDate(0);
  }

  return data.toISOString().split("T")[0];
}

export function textoOrigemItem(tipo) {
  const textos = {
    fatura: "Fatura de cartão",
    conta: "Conta/boletos",
    conta_negativa: "Conta negativa",
  };

  return textos[tipo] || tipo || "Dívida";
}

export function textoTipoRenegociacao(tipo) {
  return tipo === "parcial" ? "Parcial" : "Total";
}

export function textoFormaPagamento(valor) {
  const textos = {
    debito_conta: "Débito em conta",
    boleto: "Boleto",
    pix: "Pix",
    dinheiro: "Dinheiro",
    transferencia: "Transferência",
    credito: "Cartão de crédito",
  };

  return textos[valor] || valor || "-";
}

export function normalizarDescricao(texto) {
  return String(texto || "").trim();
}

function tipoProdutoRenegociado(item) {
  const tipo = item?.tipo_origem || item?.tipo;
  const payload = item?.payload || item?.original || {};
  const categoria = String(payload.categoria || item?.detalhe || "").toLowerCase();

  if (tipo === "fatura") return "Cartão de Crédito";
  if (tipo === "conta_negativa") return "Cheque Especial";
  if (categoria.includes("financiamento")) return "Financiamento";
  if (categoria.includes("empréstimo") || categoria.includes("emprestimo")) return "Empréstimo";
  if (tipo === "conta") return "Conta a Pagar";
  return "Produto Financeiro";
}

function nomeProdutoRenegociado(item) {
  const payload = item?.payload || item?.original || {};
  return payload.cartoes?.nome
    || payload.cartao?.nome
    || payload.contas?.nome
    || payload.conta?.nome
    || item?.titulo
    || "Sem nome";
}

export function normalizarProdutosRenegociados(itens = []) {
  const produtos = new Map();

  for (const item of itens) {
    const tipoOrigem = item.tipo_origem || item.tipo || "produto";
    const payload = item?.payload || item?.original || {};
    const origemId = tipoOrigem === "fatura"
      ? payload.cartoes?.id ?? payload.cartao?.id ?? nomeProdutoRenegociado(item)
      : tipoOrigem === "conta_negativa"
        ? payload.contas?.id ?? payload.conta?.id ?? item.origem_id ?? nomeProdutoRenegociado(item)
        : item.origem_id ?? item.id ?? nomeProdutoRenegociado(item);
    const chave = `${tipoOrigem}-${origemId}`;
    const tipo = tipoProdutoRenegociado(item);
    const nome = nomeProdutoRenegociado(item);
    const valor = Number(
      item.valor_renegociado
      ?? item.valor_considerado_banco
      ?? item.valor_original
      ?? item.valor_aberto
      ?? 0
    );
    const atual = produtos.get(chave);

    if (atual) {
      atual.valor += valor;
      continue;
    }

    produtos.set(chave, {
      id: chave,
      tipo,
      nome,
      titulo: `${tipo} — ${nome}`,
      valor,
    });
  }

  return [...produtos.values()];
}

function itemPertenceAoProduto(item, produtoId) {
  return String(normalizarProdutosRenegociados([item])[0]?.id) === String(produtoId);
}

export function encontrarItemRenegociacaoPorProduto(itens = [], produtoId) {
  return itens
    .filter((item) => itemPertenceAoProduto(item, produtoId))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true }))[0] || null;
}

function encontrarAjusteParcelaProduto(itens, produtoId, numeroParcela) {
  const chaveParcela = String(numeroParcela);
  const itemComAjuste = itens
    .filter((item) =>
      itemPertenceAoProduto(item, produtoId)
      && Object.hasOwn(item?.payload?.ajustes_parcelas || {}, chaveParcela)
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "pt-BR", { numeric: true }))[0];

  return itemComAjuste?.payload?.ajustes_parcelas?.[chaveParcela] || null;
}

export function criarComposicaoParcelaRenegociacao({
  itens = [],
  numeroParcela,
  valorPrevisto,
  nomePadrao,
}) {
  const produtos = normalizarProdutosRenegociados(itens);
  const composicaoBase = criarItensParcela(
    { valorPrevisto, valorAtualizado: valorPrevisto },
    produtos.map((produto) => ({
      id: produto.id,
      nome: produto.titulo,
      valor: produto.valor,
    })),
    nomePadrao
  );

  return composicaoBase.map((item) => {
    const ajuste = encontrarAjusteParcelaProduto(itens, item.id, numeroParcela);

    return ajuste
      ? {
          ...item,
          valorPrevisto: Number(ajuste.valorPrevisto ?? item.valorPrevisto),
          valorAtualizado: Number(ajuste.valorAtualizado ?? item.valorAtualizado),
        }
      : item;
  });
}
