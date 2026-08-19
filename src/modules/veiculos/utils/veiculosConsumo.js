import {
  abastecimentoParticipaDoConsumo,
  compararAbastecimentosCronologicamente,
} from "../../abastecimentos/utils/abastecimentosCronologia.js";

const GRUPOS_COMBUSTIVEL = {
  etanol: { nome: "Etanol", tipos: ["etanol", "etanol_aditivado"] },
  gasolina: { nome: "Gasolina", tipos: ["gasolina_comum", "gasolina_aditivada", "gasolina_podium"] },
  diesel: { nome: "Diesel", tipos: ["diesel"] },
  gnv: { nome: "GNV", tipos: ["gnv"] },
};

function numeroPositivo(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function resumirCiclos({ chave, nome, registros, quantidadeCampo, precoCampo, unidadeConsumo, unidadePreco, usarMetricasRegistradas = false }) {
  const ordenados = [...registros]
    .filter(abastecimentoParticipaDoConsumo)
    .sort(compararAbastecimentosCronologicamente);
  const ciclos = [];

  ordenados.forEach((registro, indice) => {
    const anterior = ordenados[indice - 1];
    const odometro = numeroPositivo(registro.odometro);
    const odometroAnterior = numeroPositivo(anterior?.odometro);
    const quantidade = numeroPositivo(registro[quantidadeCampo]);
    const kmRegistrado = usarMetricasRegistradas ? numeroPositivo(registro.km_rodados) : 0;
    const consumoRegistrado = usarMetricasRegistradas ? numeroPositivo(registro.km_por_kwh) : 0;
    const kmCronologia = anterior && odometro > odometroAnterior ? odometro - odometroAnterior : 0;
    const km = kmRegistrado || kmCronologia;

    if (km > 0 && quantidade > 0) {
      ciclos.push({
        consumo: consumoRegistrado || km / quantidade,
        custo: quantidade * numeroPositivo(registro[precoCampo]),
        km,
      });
    }
  });

  const precos = ordenados
    .map((registro) => ({
      quantidade: numeroPositivo(registro[quantidadeCampo]),
      preco: numeroPositivo(registro[precoCampo]),
    }))
    .filter((item) => item.quantidade > 0 && item.preco > 0);
  const quantidadeTotal = precos.reduce((total, item) => total + item.quantidade, 0);
  const consumos = ciclos.map((ciclo) => ciclo.consumo);
  const kmTotal = ciclos.reduce((total, ciclo) => total + ciclo.km, 0);

  return {
    chave,
    nome,
    unidadeConsumo,
    unidadePreco,
    registros: ordenados.length,
    ciclos: ciclos.length,
    media: consumos.length ? consumos.reduce((total, consumo) => total + consumo, 0) / consumos.length : 0,
    melhor: consumos.length ? Math.max(...consumos) : 0,
    pior: consumos.length ? Math.min(...consumos) : 0,
    precoMedio: quantidadeTotal
      ? precos.reduce((total, item) => total + item.quantidade * item.preco, 0) / quantidadeTotal
      : 0,
    custoPorKm: kmTotal ? ciclos.reduce((total, ciclo) => total + ciclo.custo, 0) / kmTotal : 0,
  };
}

function grupoDoCombustivel(tipo) {
  return Object.entries(GRUPOS_COMBUSTIVEL).find(([, grupo]) => grupo.tipos.includes(tipo));
}

export function calcularConsumosPorFonte(abastecimentos = [], recargas = []) {
  const agrupados = new Map();

  abastecimentos.forEach((abastecimento) => {
    const grupoEncontrado = grupoDoCombustivel(abastecimento.tipo_combustivel);
    if (!grupoEncontrado) return;
    const [chave, grupo] = grupoEncontrado;
    if (!agrupados.has(chave)) agrupados.set(chave, { nome: grupo.nome, registros: [] });
    agrupados.get(chave).registros.push(abastecimento);
  });

  const combustiveis = [...agrupados.entries()].map(([chave, grupo]) =>
    resumirCiclos({
      chave,
      nome: grupo.nome,
      registros: grupo.registros,
      quantidadeCampo: "litros",
      precoCampo: "valor_litro",
      unidadeConsumo: "km/L",
      unidadePreco: "L",
    })
  );

  const eletricidade = recargas.length
    ? resumirCiclos({
        chave: "eletricidade",
        nome: "Eletricidade",
        registros: recargas,
        quantidadeCampo: "kwh",
        precoCampo: "valor_kwh",
        unidadeConsumo: "km/kWh",
        unidadePreco: "kWh",
        usarMetricasRegistradas: true,
      })
    : null;

  return eletricidade ? [...combustiveis, eletricidade] : combustiveis;
}
