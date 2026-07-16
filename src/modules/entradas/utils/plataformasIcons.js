import uberLogo from "../../../assets/plataformas/uber.png";
import noventaNoveLogo from "../../../assets/plataformas/99.png";
import indriveLogo from "../../../assets/plataformas/indrive.svg";
import ifoodLogo from "../../../assets/plataformas/ifood.svg";
import lalamoveLogo from "../../../assets/plataformas/lalamove.svg";
import shopeeLogo from "../../../assets/plataformas/shopee.svg";

import rappiLogo from "../../../assets/plataformas/rappi.png";
import mercadoLivreLogo from "../../../assets/plataformas/mercadolivre.png";

import { FaCarSide } from "react-icons/fa";

export function obterConfigPlataforma(nome = "") {
  const texto = String(nome).toLowerCase();

  if (texto.includes("uber")) return { imagem: uberLogo };

  if (texto.includes("99")) return { imagem: noventaNoveLogo };

  if (texto.includes("indrive") || texto.includes("in drive")) {
    return { imagem: indriveLogo };
  }

  if (texto.includes("ifood")) return { imagem: ifoodLogo };

  if (texto.includes("lalamove")) return { imagem: lalamoveLogo };

  if (texto.includes("shopee")) return { imagem: shopeeLogo };

  if (texto.includes("rappi")) return { imagem: rappiLogo };

  if (texto.includes("mercado livre") || texto.includes("mercadolivre")) {
    return { imagem: mercadoLivreLogo };
  }

  if (texto.includes("particular")) {
    return {
      icon: FaCarSide,
      bg: "bg-blue-500",
      color: "text-white",
    };
  }

  return null;
}
