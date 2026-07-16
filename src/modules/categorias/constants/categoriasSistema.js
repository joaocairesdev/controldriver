// src/utils/categoriasSistema.js

export const TIPOS_USO_CATEGORIA = [
  { valor: "trabalho", titulo: "Uso à trabalho" },
  { valor: "pessoal", titulo: "Uso pessoal" },
  { valor: "rateada", titulo: "Calculado pelo uso do veículo" },
  { valor: "opcional", titulo: "Escolher no lançamento" },
];

export const CATEGORIAS_SISTEMA_FIXAS = [
  { nome: "Abastecimento", tipo_uso: "rateada" },
  { nome: "Manutenção", tipo_uso: "rateada" },
  { nome: "Pedágio (Pessoal)", tipo_uso: "pessoal" },
  { nome: "Pedágio (Trabalho)", tipo_uso: "trabalho" },
  { nome: "Estacionamento (Pessoal)", tipo_uso: "pessoal" },
  { nome: "Estacionamento (Trabalho)", tipo_uso: "trabalho" },
  { nome: "Mensalidade da TAG", tipo_uso: "proporcional" },
];

export function normalizarCategoria(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isCategoriaSistemaFixa(nome) {
  const nomeNormalizado = normalizarCategoria(nome);

  return CATEGORIAS_SISTEMA_FIXAS.some(
    (categoria) => normalizarCategoria(categoria.nome) === nomeNormalizado
  );
}

export function tipoUsoCategoriaFixa(nome) {
  const nomeNormalizado = normalizarCategoria(nome);

  return (
    CATEGORIAS_SISTEMA_FIXAS.find(
      (categoria) => normalizarCategoria(categoria.nome) === nomeNormalizado
    )?.tipo_uso || "opcional"
  );
}

export function tituloTipoUsoCategoria(valor) {
  return (
    TIPOS_USO_CATEGORIA.find((item) => item.valor === valor)?.titulo ||
    (valor === "proporcional" ? "Uso proporcional" : "Escolher no lançamento")
  );
}

export function corTextoTipoUsoCategoria(valor) {
  if (valor === "trabalho") return "text-green-400";
  if (valor === "pessoal") return "text-blue-400";
  if (valor === "opcional") return "text-purple-400";
  if (valor === "proporcional") return "text-cyan-400";
  return "text-yellow-400";
}

