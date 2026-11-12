'use client';

import { useState, useEffect, useRef } from 'react';
import { IoClose, IoCameraReverseOutline, IoSparkles, IoCamera, IoRefresh } from 'react-icons/io5';
import { MdDocumentScanner } from 'react-icons/md';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import { LuZoomIn, LuZoomOut, LuRotateCw } from 'react-icons/lu';

export default function OcrScannerModal({ isOpen, onClose, onScan }) {
  const [stream, setStream] = useState(null);
  const [erroCamera, setErroCamera] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [textoDetectado, setTextoDetectado] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);
  const [zoomAtual, setZoomAtual] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);

  const videoRef = useRef(null);
  const targetFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workerRef = useRef(null);

  // Som suave de confirmação
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  // Pré-aquecimento do Tesseract apenas como último recurso se não houver OCR nativo
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window !== 'undefined' && 'TextDetector' in window) {
      // Dispositivo suporta OCR nativo acelerado por hardware: não carrega Tesseract
      return;
    }

    let cancelado = false;

    const prepararWorker = async () => {
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        // PSM 7 = single text line — ideal para capturar uma única linha (ex: COLP 12225)
        // Sem char_whitelist: no Tesseract v4/v5 (LSTM) o whitelist degrada a acurácia
        await worker.setParameters({
          tessedit_pageseg_mode: '7',
        });

        if (!cancelado) {
          workerRef.current = worker;
        } else {
          worker.terminate();
        }
      } catch (err) {
        console.error('Erro ao pré-carregar OCR:', err);
      }
    };

    prepararWorker();

    return () => {
      cancelado = true;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [isOpen]);

  // Iniciar câmera com Macro e Zoom automáticos
  const startCamera = async (deviceId = null) => {
    setErroCamera(null);
    stopCamera();

    try {
      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        const advanced = [];

        // 1. Tentar ativar modo Macro ou Foco Contínuo nativo
        if (capabilities.focusMode && capabilities.focusMode.includes('macro')) {
          advanced.push({ focusMode: 'macro' });
        } else if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          advanced.push({ focusMode: 'continuous' });
        }

        // 2. Aplicar zoom inicial de 1.8x a 2.0x para foco nítido de perto (Macro ótico/digital)
        if (capabilities.zoom) {
          const maxZ = capabilities.zoom.max || 1;
          const minZ = capabilities.zoom.min || 1;
          setMaxZoom(maxZ);

          const zoomIdeal = Math.min(maxZ, Math.max(minZ, 1.8));
          setZoomAtual(zoomIdeal);
          advanced.push({ zoom: zoomIdeal });
        }

        if (advanced.length > 0 && track.applyConstraints) {
          try {
            await track.applyConstraints({ advanced });
          } catch (e) {
            console.warn('Não foi possível aplicar restrições avançadas de macro:', e);
          }
        }
      }

      // Buscar câmeras disponíveis
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoDevices);
      if (!deviceId && videoDevices.length > 0) {
        const backCam = videoDevices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('traseira') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        setCameraIdAtiva(backCam ? backCam.deviceId : videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Erro ao acessar câmera para OCR:', err);
      setErroCamera(
        err?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Habilite o acesso nas configurações do navegador ou use o botão de foto abaixo.'
          : 'Não foi possível ligar a câmera em tempo real. Você pode tirar uma foto usando o botão abaixo.'
      );
    }
  };

  const alternarZoom = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;

    const novoZoom = zoomAtual >= 1.8 ? 1 : Math.min(maxZoom, 2.0);
    try {
      await track.applyConstraints({ advanced: [{ zoom: novoZoom }] });
      setZoomAtual(novoZoom);
    } catch (e) {
      console.warn('Erro ao alterar zoom:', e);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleCamera = async () => {
    if (!cameras || cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.deviceId === cameraIdAtiva);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setCameraIdAtiva(nextCam.deviceId);
    await startCamera(nextCam.deviceId);
  };

  // Auxiliar para evitar que anos de prensagem (1940 a 2030) sejam confundidos com código
  const ehAno = (str) => {
    const n = parseInt(str, 10);
    return str.length === 4 && n >= 1940 && n <= 2030;
  };

  // Helper para rotacionar DataURL em 90 graus no sentido horário (lombadas verticais)
  const rotacionarDataUrl90 = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.height;
        canvas.height = img.width;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Avalia individualmente uma linha de texto com pontuação de relevância e filtros de ruído
  const extrairCodigoCatalogoLinha = (linha) => {
    if (!linha) return null;

    // 1. Limpeza de ruídos institucionais e técnicos típicos de capas brasileiras
    let limpo = linha.toUpperCase()
      .replace(/\bTAMB[EÉ]M\s+EM\s+(FITAS|CASSET[ET]E?)\b/gi, ' ')
      .replace(/\b(CASSET[ET]E|FITAS|STEREO|MONO|SOM\s+ESTEREOF[OÔ]NICO)\b/gi, ' ')
      .replace(/\b(DISCO\s+[EÉ]\s+CULTURA|S[EÉ]RIE\s+(LUXO|ESPECIAL)?|SOM\s+IND\s+E\s+COM)\b/gi, ' ')
      .replace(/\b(LADO\s+[12AB]|FAIXA\s+\d+|33\s+RPM|45\s+RPM)\b/gi, ' ')
      // Limpa referências e etiquetas de preço de loja
      .replace(/\bREF\.?\s*[:\-]?[A-Z0-9\-]+/gi, ' ')
      .replace(/\bNC[\-]?\d*[A-Z0-9]*\b/gi, ' ')
      .replace(/\b\d+[,.]\d{2}\b/g, ' ')
      .replace(/CGC|CNPJ|\/000\d/g, ' ')
      .replace(/[^A-Za-z0-9\-\.\s\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (limpo.length < 2 || limpo.length > 30) return null;

    // Ignora termos de capa comuns que não são códigos
    const ignorarExatos = [
      'DISCO E CULTURA', 'STEREO', 'MONO', '33 RPM', '45 RPM',
      'LADO 1', 'LADO 2', 'LADO A', 'LADO B', 'SERIE LUXO', 'SOM IND E COM'
    ];
    if (ignorarExatos.includes(limpo)) return null;

    // 1. Prefixo especial estilo EMI-Odeon: 31C 064 422894
    const matchEmi = limpo.match(/\b(\d{2}[A-Z][\s\-\.]+\d{2,4}[\s\-\.]+\d{4,8})\b/i);
    if (matchEmi) return { codigo: matchEmi[1].trim(), score: 100 };

    // 2. Letras clássicas + Números (ex: BPL 15, OW 606, SPS 575, COLP 82383, SMOFB 3749, XSLP 1001)
    // Aceita de 2 a 6 letras seguidas de 2 a 8 dígitos (abrangendo BPL 15 e OW 606)
    const matchLetras = limpo.match(/\b([A-Z]{2,6}[\s\-\.]+(\d{2,8})(?:[\s\-\.]\d{1,4})?)\b/i);
    if (matchLetras) {
      const p = matchLetras[1].trim();
      const digitos = matchLetras[2];
      const prefixo = p.split(/[\s\-\.]+/)[0];
      const ignorarPrefixos = ['DISCOS', 'BRASIL', 'EDICAO', 'GRAVACOES', 'PRODUCOES', 'ESTUDIO'];
      if (!ignorarPrefixos.includes(prefixo) && !ehAno(digitos)) {
        return { codigo: p, score: 95 };
      }
    }

    // 3. Padrão 7 dígitos Som Livre / RCA / WEA / Polygram (ex: 150 0006, 150.0006, 150 0016, 103 0680, 670 4085, 710 0680)
    const match7Dig = limpo.match(/\b(\d{3}[\s\.\-]\d{4})\b/);
    if (match7Dig) {
      return { codigo: match7Dig[1].trim(), score: 92 };
    }

    // 4. Padrão 6 dígitos CBS / Epic com separador (ex: 138.250, 138 250, 230.040, 144.190)
    const match6Dig = limpo.match(/\b(\d{3}[\s\.\-]\d{3})\b/);
    if (match6Dig) {
      return { codigo: match6Dig[1].trim(), score: 91 };
    }

    // 5. Numérico Composto genérico com pontuação ou espaço (ex: 6349 050, 103.0001, 403.6001, 825 000-1)
    const matchComposto = limpo.match(/\b(\d{2,6}[\s\.\-]+\d{2,6}(?:[\s\.\-]\d{1,4})?)\b/);
    if (matchComposto) {
      return { codigo: matchComposto[1].trim(), score: 90 };
    }

    // 6. Numérico Puro contínuo (5 a 10 dígitos) - ex: 138250, 138238, 230040, 144190, 00203, 1030680, 6349050
    const matchPuro = limpo.match(/\b(\d{5,10})\b/);
    if (matchPuro && !ehAno(matchPuro[1])) {
      return { codigo: matchPuro[1].trim(), score: 85 };
    }

    // 7. Letras juntas com números (ex: BPL15, OW606, SPS575, COLP82383)
    const matchJunto = limpo.match(/\b([A-Z]{2,6}(\d{2,8}))\b/i);
    if (matchJunto && !ehAno(matchJunto[2])) {
      return { codigo: matchJunto[1], score: 80 };
    }

    // 8. Tratamento para códigos numéricos com confusão típica de OCR (ex: '15O OOO6' ou '67O 4O85' ou '4O36OO1')
    const palavras = limpo.split(/\s+/);
    for (let i = 0; i < palavras.length; i++) {
      const w = palavras[i];
      const norm = w.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5');
      if (/^\d{5,10}$/.test(norm) && !ehAno(norm)) {
        return { codigo: norm, score: 75 };
      }
      if (i < palavras.length - 1) {
        const w2 = palavras[i + 1];
        const norm2 = (w + ' ' + w2).replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5');
        if (/^\d{2,6}\s\d{2,6}$/.test(norm2)) {
          return { codigo: norm2, score: 75 };
        }
      }
    }

    return null;
  };

  // Filtro inteligente de extração de códigos de catálogo
  // Analisa linha por linha para isolar o código mesmo se houver textos ou rabiscos acima/abaixo
  const extrairCodigoCatalogo = (textoBruto) => {
    if (!textoBruto) return '';

    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let melhorResultado = null;

    for (const linha of linhas) {
      const res = extrairCodigoCatalogoLinha(linha);
      if (res) {
        if (!melhorResultado || res.score > melhorResultado.score) {
          melhorResultado = res;
        }
      }
    }

    if (melhorResultado) {
      return melhorResultado.codigo;
    }

    // Fallback: se nenhuma linha isolada deu match, tenta na string completa normalizada
    const resTotal = extrairCodigoCatalogoLinha(textoBruto.replace(/\s+/g, ' '));
    if (resTotal) return resTotal.codigo;

    return '';
  };


  // Processar imagem via OCR Nativo de Hardware (Android) com fallback otimizado para iOS e Nuvem
  const executarOcrEmImagem = async (imageSource, autoRotate = true) => {
    setProcessando(true);
    setTextoDetectado('');

    let codigoEncontrado = '';
    let imagemParaIa = imageSource;

    try {
      // 1. OCR Nativo do Dispositivo (Android Chrome Shape Detection API / ML Kit)
      // Execução ultra-rápida (20ms a 50ms) direta na GPU/NPU do celular
      if (typeof window !== 'undefined' && 'TextDetector' in window) {
        try {
          const detector = new window.TextDetector();
          let detectTarget = imageSource;

          if (typeof imageSource === 'string') {
            detectTarget = await new Promise((resolve, reject) => {
              const el = new Image();
              el.crossOrigin = 'anonymous';
              el.onload = () => resolve(el);
              el.onerror = reject;
              el.src = imageSource;
            });
          }

          const detectedBlocks = await detector.detect(detectTarget);
          if (detectedBlocks && detectedBlocks.length > 0) {
            const rawText = detectedBlocks.map(b => b.rawValue).join('\n');
            codigoEncontrado = extrairCodigoCatalogo(rawText);
          }
        } catch (errNative) {
          console.warn('TextDetector nativo não processou:', errNative);
        }
      }

      // 2. Tenta a leitura local também com a lombada girada antes de chamar a IA.
      if (!codigoEncontrado && autoRotate && typeof imageSource === 'string') {
        try {
          const rotacionada = await rotacionarDataUrl90(imageSource);
          imagemParaIa = rotacionada;
          setFotoPreview(rotacionada);

          // Tenta primeiro o TextDetector nativo na imagem rotacionada
          if (typeof window !== 'undefined' && 'TextDetector' in window) {
            try {
              const detector = new window.TextDetector();
              const imgRot = await new Promise((resolve, reject) => {
                const el = new Image();
                el.crossOrigin = 'anonymous';
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = rotacionada;
              });
              const detectedBlocks = await detector.detect(imgRot);
              if (detectedBlocks && detectedBlocks.length > 0) {
                const rawText = detectedBlocks.map(b => b.rawValue).join('\n');
                codigoEncontrado = extrairCodigoCatalogo(rawText);
              }
            } catch (_) {}
          }

        } catch (e) {
          console.warn('Tentativa de rotação 90°:', e);
        }
      }

      // Uma única chamada remota por captura; usa a imagem girada quando a lombada é vertical.
      if (!codigoEncontrado && typeof imagemParaIa === 'string' && typeof navigator !== 'undefined' && navigator.onLine !== false) {
        try {
          const resp = await fetch('/api/ocr-assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imagemParaIa })
          });
          const data = await resp.json();
          if (data?.success && data.codigo) {
            codigoEncontrado = data.codigo.trim();
          }
        } catch (errIa) {
          console.warn('Falha no leitor assistido de OCR:', errIa);
        }
      }

      // 3. Fallback local (Tesseract.js) quando a leitura nativa ou remota não encontra código.
      if (!codigoEncontrado) {
        try {
          let worker = workerRef.current;
          if (!worker) {
            const { createWorker } = await import('tesseract.js');
            worker = await createWorker('eng');
            await worker.setParameters({ tessedit_pageseg_mode: '7' });
            workerRef.current = worker;
          }

          const ret = await worker.recognize(imagemParaIa);
          codigoEncontrado = extrairCodigoCatalogo(ret?.data?.text || '');
        } catch (errTesseract) {
          console.warn('Fallback Tesseract offline não concluiu:', errTesseract);
        }
      }

      if (codigoEncontrado) {
        playBeep();
        setTextoDetectado(codigoEncontrado);
      } else {
        setTextoDetectado('');
      }
    } catch (err) {
      console.error('Erro no OCR:', err);
    } finally {
      setProcessando(false);
    }
  };

  // Girar imagem capturada manualmente em 90° e reprocessar OCR
  const handleGirarFoto = async () => {
    if (!fotoPreview || processando) return;
    setProcessando(true);
    try {
      const rotated = await rotacionarDataUrl90(fotoPreview);
      setFotoPreview(rotated);
      await executarOcrEmImagem(rotated, false);
    } catch (err) {
      console.error('Erro ao girar foto:', err);
      setProcessando(false);
    }
  };

  // Capturar quadro do vídeo da câmera com recorte centralizado e resolução nítida
  const capturarDoVideo = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;

    // Recorta a faixa central onde a mira visual está posicionada com margem segura (faixa de 36% de altura)
    const cropWidth = Math.floor(vWidth * 0.88);
    const cropHeight = Math.floor(vHeight * 0.36);
    const cropX = Math.floor((vWidth - cropWidth) / 2);
    const cropY = Math.floor((vHeight - cropHeight) / 2);

    // Resolução nítida para OCR sem distorção
    const targetWidth = Math.min(cropWidth, 1080);
    const targetHeight = Math.floor((cropHeight / cropWidth) * targetWidth);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFotoPreview(dataUrl);
    executarOcrEmImagem(dataUrl);
  };

  // Capturar via foto macro nativa do celular
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.floor((h / w) * maxDim);
            w = maxDim;
          } else {
            w = Math.floor((w / h) * maxDim);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setFotoPreview(dataUrl);
        executarOcrEmImagem(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmar = () => {
    if (!textoDetectado.trim()) return;
    stopCamera();
    onScan(textoDetectado.trim());
    onClose();
  };

  const handleTentarNovamente = async () => {
    setFotoPreview(null);
    setTextoDetectado('');
    setProcessando(false);

    // Garante que o stream de vídeo continue tocando sem desconectar
    if (stream && videoRef.current) {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = stream;
      }
      try {
        await videoRef.current.play();
      } catch (e) {
        startCamera(cameraIdAtiva);
      }
    } else {
      startCamera(cameraIdAtiva);
    }
  };

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setTextoDetectado('');
      setFotoPreview(null);
      setProcessando(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay" onClick={() => { stopCamera(); onClose(); }}>
      <div className="scanner-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdDocumentScanner size={22} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>Leitor de Catálogo (OCR)</h3>
          </div>
          <button 
            type="button" 
            className="scanner-close-btn"
            onClick={() => { stopCamera(); onClose(); }}
            title="Fechar"
          >
            <IoClose size={22} />
          </button>
        </div>

        {/* Viewfinder da Câmera em Preto e Branco com Alto Contraste */}
        <div className="scanner-viewfinder-wrapper" style={{ minHeight: '300px', position: 'relative' }}>
          {/* O vídeo e a mira sempre continuam montados no DOM para a câmera nunca travar */}
          <div style={{ width: '100%', height: '100%', display: fotoPreview ? 'none' : 'block' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="ocr-camera-video"
            />

            {/* Mira visual para enquadrar o texto */}
            <div ref={targetFrameRef} className="ocr-target-frame">
              <div className="ocr-frame-corner top-left" />
              <div className="ocr-frame-corner top-right" />
              <div className="ocr-frame-corner bottom-left" />
              <div className="ocr-frame-corner bottom-right" />
              <span className="ocr-frame-hint">Enquadre o código (ex: COLP 12225 ou 6349 050)</span>
            </div>

            {/* Botões flutuantes de Zoom Macro e Câmera */}
            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '8px', zIndex: 5 }}>
              {maxZoom > 1 && (
                <button 
                  type="button"
                  onClick={alternarZoom}
                  className="ocr-floating-btn"
                  title="Alternar Macro / Zoom"
                >
                  {zoomAtual >= 1.8 ? <LuZoomOut size={16} /> : <LuZoomIn size={16} />}
                  <span>{zoomAtual >= 1.8 ? 'Macro (2x)' : '1x'}</span>
                </button>
              )}

              {cameras.length > 1 && (
                <button 
                  type="button"
                  onClick={toggleCamera}
                  className="ocr-floating-btn"
                  title="Alternar lente da câmera"
                >
                  <IoCameraReverseOutline size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Quando fotoPreview existir, ela é exibida por cima sem desmontar a câmera */}
          {fotoPreview && (
            <div style={{ width: '100%', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Foto capturada:</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoPreview} alt="Captura da câmera" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '6px' }} />
            </div>
          )}

          {processando && (
            <div className="scanner-status-overlay">
              <div className="scanner-spinner" />
              <span style={{ fontWeight: 500 }}>Lendo código de catálogo...</span>
            </div>
          )}

          {erroCamera && !fotoPreview && (
            <div className="scanner-error-box">
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#fc8181' }}>{erroCamera}</p>
            </div>
          )}
        </div>

        <div className="scanner-modal-footer">
          {fotoPreview ? (
            /* Estado quando a foto foi tirada / carregada */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {processando ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px 0' }}>
                  <div className="scanner-spinner" style={{ width: '22px', height: '22px' }} />
                  <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-header)' }}>
                    Lendo caracteres no disco...
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IoSparkles color="var(--accent)" size={16} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: textoDetectado ? 'var(--text-header)' : '#f6ad55' }}>
                        {textoDetectado ? 'Código detectado — confira antes de buscar:' : 'Nenhum código reconhecido com certeza:'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      value={textoDetectado} 
                      onChange={(e) => setTextoDetectado(e.target.value)}
                      placeholder="Ex: 138250, 150 0006, OW 606"
                      style={{ flex: 1, minHeight: '44px', fontSize: '15px', fontWeight: '600', letterSpacing: '0.5px', padding: '8px 12px' }}
                    />
                    <button 
                      type="button" 
                      onClick={handleConfirmar} 
                      disabled={!textoDetectado.trim()}
                      className="btn btn-primary"
                      style={{ minHeight: '44px', whiteSpace: 'nowrap', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <FaMagnifyingGlass size={14} /> Buscar
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button 
                      type="button" 
                      onClick={handleGirarFoto}
                      disabled={processando}
                      className="btn btn-secondary"
                      style={{ minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 500 }}
                      title="Girar foto em 90° para ler texto vertical de lombada"
                    >
                      <LuRotateCw size={17} /> Girar 90°
                    </button>
                    <button 
                      type="button" 
                      onClick={handleTentarNovamente}
                      disabled={processando}
                      className="btn btn-secondary"
                      style={{ minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 500 }}
                    >
                      <IoRefresh size={17} /> Tirar outra foto
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Estado de câmera ao vivo */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button 
                  type="button" 
                  onClick={capturarDoVideo} 
                  disabled={processando || !!erroCamera}
                  className="btn btn-primary" 
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '44px', fontWeight: 500 }}
                >
                  <IoCamera size={18} /> Capturar e Ler
                </button>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                capture="environment" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={processando}
                className="btn btn-secondary"
                style={{ width: '100%', minHeight: '44px', fontSize: '13px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                Tirar foto macro com foco da câmera nativa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
