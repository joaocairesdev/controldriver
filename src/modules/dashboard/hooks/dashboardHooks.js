import { useEffect, useRef, useState } from "react";

export function useProgressoAnimado(valorFinal, duracao = 1800, chave = "") {
  const [valorAtual, setValorAtual] = useState(0);
  const quadroRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(quadroRef.current);
    // Reinicia a animação quando o valor ou o período muda.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValorAtual(0);

    const destino = Math.max(Number(valorFinal || 0), 0);
    if (destino <= 0) return undefined;

    const inicio = performance.now();

    const animar = (agora) => {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      const suavizado = 1 - Math.pow(1 - progresso, 3);
      setValorAtual(destino * suavizado);

      if (progresso < 1) {
        quadroRef.current = requestAnimationFrame(animar);
      }
    };

    quadroRef.current = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(quadroRef.current);
    };
  }, [valorFinal, duracao, chave]);

  return valorAtual;
}

export function useRevelarAoEntrar(threshold = 0.7, rootMargin = "0px 0px -10% 0px") {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento || visivel) return undefined;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting || entrada.intersectionRatio < threshold) return;
        setVisivel(true);
        observador.disconnect();
      },
      { threshold, rootMargin }
    );

    observador.observe(elemento);
    return () => observador.disconnect();
  }, [visivel, threshold, rootMargin]);

  return { ref, visivel };
}

export function useArrastarScrollHorizontal() {
  const ref = useRef(null);
  const estado = useRef({ ativo: false, arrastando: false, inicioX: 0, inicioY: 0, scrollInicial: 0 });

  function iniciar(evento) {
    const elemento = ref.current;
    if (!elemento || evento.button !== 0) return;
    estado.current = {
      ativo: true,
      arrastando: false,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      scrollInicial: elemento.scrollLeft,
    };
  }

  function mover(evento) {
    const elemento = ref.current;
    if (!elemento || !estado.current.ativo) return;
    const deslocamentoX = evento.clientX - estado.current.inicioX;
    const deslocamentoY = evento.clientY - estado.current.inicioY;

    if (!estado.current.arrastando) {
      if (Math.abs(deslocamentoX) < 6 && Math.abs(deslocamentoY) < 6) return;
      if (Math.abs(deslocamentoY) >= Math.abs(deslocamentoX)) {
        estado.current.ativo = false;
        return;
      }
      estado.current.arrastando = true;
      elemento.setPointerCapture?.(evento.pointerId);
      elemento.classList.add("cursor-grabbing", "select-none");
    }

    evento.preventDefault();
    elemento.scrollLeft = estado.current.scrollInicial - deslocamentoX;
  }

  function finalizar(evento) {
    const elemento = ref.current;
    if (!elemento || !estado.current.ativo) return;
    estado.current.ativo = false;
    elemento.releasePointerCapture?.(evento.pointerId);
    elemento.classList.remove("cursor-grabbing", "select-none");
  }

  return {
    ref,
    props: {
      onPointerDown: iniciar,
      onPointerMove: mover,
      onPointerUp: finalizar,
      onPointerCancel: finalizar,
      onPointerLeave: finalizar,
    },
  };
}
