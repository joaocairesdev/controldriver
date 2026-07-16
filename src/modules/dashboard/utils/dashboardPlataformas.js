import uberIcon from "../../../assets/plataformas/uber.png";
import noveNoveIcon from "../../../assets/plataformas/99.png";
import ifoodIcon from "../../../assets/plataformas/ifood.svg";
import inDriveIcon from "../../../assets/plataformas/indrive.svg";
import lalamoveIcon from "../../../assets/plataformas/lalamove.svg";
import mercadoLivreIcon from "../../../assets/plataformas/mercadolivre.png";
import rappiIcon from "../../../assets/plataformas/rappi.png";
import shopeeIcon from "../../../assets/plataformas/shopee.svg";

export function iconePlataforma(nome) {
  const chave = normalizarNomePlataforma(nome);

  const icones = {
    uber: uberIcon,
    "99": noveNoveIcon,
    ifood: ifoodIcon,
    indrive: inDriveIcon,
    lalamove: lalamoveIcon,
    mercadolivre: mercadoLivreIcon,
    rappi: rappiIcon,
    shopee: shopeeIcon,
  };

  return icones[chave] || null;
}

export function normalizarNomePlataforma(nome) {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
