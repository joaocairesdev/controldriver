export const TIPOS_CARTAO = {
  PROPRIO: "proprio",
  TERCEIRO: "terceiro",
};

export function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarDataBR(dataISOTexto) {
  if (!dataISOTexto) return "-";
  const [ano, mes, dia] = String(dataISOTexto).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarMoedaDigitada(valor) {
  const somenteDigitos = String(valor || "").replace(/\D/g, "");
  const centavos = Number(somenteDigitos || 0);

  if (!somenteDigitos) return "";

  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moedaParaNumero(valor) {
  if (!valor) return 0;
  return Number(String(valor).replace(/\./g, "").replace(",", "."));
}

export function numeroParaMoedaInput(valor) {
  const numero = Number(valor || 0);
  if (!numero) return "";
  return numero.toFixed(2).replace(".", ",");
}

export function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

export function validarDia(valor) {
  const numero = Number(valor);
  if (!valor) return false;
  if (numero < 1) return false;
  if (numero > 31) return false;
  return true;
}

export function corDisponivel(valor) {
  if (Number(valor) < 0) return "text-red-500 font-bold";
  if (Number(valor) === 0) return "text-gray-500";
  return "text-green-400";
}

export function corBarra(percentual) {
  if (Number(percentual) >= 100) return "bg-red-500";
  if (Number(percentual) >= 80) return "bg-yellow-400";
  return "bg-green-500";
}

export function obterTipoCartao(cartao) {
  return cartao?.tipo_cartao || TIPOS_CARTAO.PROPRIO;
}

export function labelTipoCartao(cartao) {
  return obterTipoCartao(cartao) === TIPOS_CARTAO.TERCEIRO
    ? "Cartão de terceiro"
    : "Cartão próprio";
}

export function textoFinalCartao(cartao) {
  if (obterTipoCartao(cartao) === TIPOS_CARTAO.TERCEIRO) {
    return "";
  }

  return `Final ${cartao?.final_cartao || "----"}`;
}

export function ultimoDiaMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

export function dataComDiaSeguro(ano, mes, dia) {
  const diaSeguro = Math.min(Number(dia || 1), ultimoDiaMes(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaSeguro).padStart(2, "0")}`;
}

export function adicionarMesCompetencia(ano, mes, quantidade) {
  let novoMes = mes + quantidade;
  let novoAno = ano;

  while (novoMes > 12) {
    novoMes -= 12;
    novoAno += 1;
  }

  while (novoMes < 1) {
    novoMes += 12;
    novoAno -= 1;
  }

  return { mes: novoMes, ano: novoAno };
}

export function ajustarVencimentoFimDeSemana(dataISO) {
  const data = new Date(`${dataISO}T00:00:00`);
  const diaSemana = data.getDay();

  if (diaSemana === 6) data.setDate(data.getDate() + 2);
  if (diaSemana === 0) data.setDate(data.getDate() + 1);

  return data.toISOString().split("T")[0];
}

export function somarMesesDataISO(dataISO, mesesParaSomar) {
  const data = new Date(`${dataISO}T00:00:00`);
  data.setMonth(data.getMonth() + mesesParaSomar);
  return data.toISOString().split("T")[0];
}

export function calcularDiaFechamentoTerceiro(diaVencimento) {
  const vencimento = Number(diaVencimento || 0);

  if (!vencimento || vencimento < 1 || vencimento > 31) return null;

  const dataReferencia = new Date(2026, 0, vencimento);
  dataReferencia.setDate(dataReferencia.getDate() - 7);

  return dataReferencia.getDate();
}

export function isCartaoTerceiro(cartao) {
  return obterTipoCartao(cartao) === TIPOS_CARTAO.TERCEIRO;
}

export function nomeCartaoComFinal(cartao) {
  if (!cartao) return "Cartão";
  if (isCartaoTerceiro(cartao)) return cartao.nome || "Cartão";
  return `${cartao.nome || "Cartão"} final ${cartao.final_cartao || "----"}`;
}

export function detalheCartao(cartao) {
  if (!cartao) return "Cartão";
  if (isCartaoTerceiro(cartao)) return "Cartão de terceiro";
  return cartao.final_cartao ? `Final ${cartao.final_cartao}` : "Cartão de crédito";
}
