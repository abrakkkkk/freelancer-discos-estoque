'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  IoClose, 
  IoCameraReverseOutline, 
  IoCamera, 
  IoRefresh, 
  IoImageOutline,
  IoFlash,
  IoFlashOutline,
  IoExpandOutline,
  IoContractOutline
} from 'react-icons/io5';

export default function CoverScannerModal({ isOpen, onClose, onRecognized, onCoverRecognized, title = 'Reconhecer Capa' }) {
  const handleRecognizedCallback = onRecognized || onCoverRecognized;
  const [stream, setStream] = useState(null);
  const [erro, setErro] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);

  // Controles de hardware de câmera (zoom, lanterna e enquadramento)
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [modoAmplo, setModoAmplo] = useState(false); // false = Guia 1:1 quadrada; true = Sensor completo sem crop

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const recognitionRequestRef = useRef(null);
  const pendingImageRef = useRef(null);

  // Som suave de confirmação ao reconhecer
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
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) {}

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  const startCamera = async (deviceId = null) => {
    setErro(null);
    stopCamera();

    try {
      // Constraints otimizadas: sem min restritivo para abertura instantânea e sem lag no hardware
      const constraints = {
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play?.().catch(() => {});
      }

      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        const advanced = [];

        // Autofoco contínuo sem forçar macro (macro causa zoom excessivo / teleobjetiva)
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          advanced.push({ focusMode: 'continuous' });
        }

        // Hardware Zoom: detecta suporte e força zoom mínimo (1x ou min) para não abrir com zoom excessivo
        if (capabilities.zoom) {
          setHasZoom(true);
          const minZ = capabilities.zoom.min || 1;
          const maxZ = capabilities.zoom.max || 1;
          const stepZ = capabilities.zoom.step || 0.1;
          setZoomRange({ min: minZ, max: maxZ, step: stepZ });
          setZoomLevel(minZ);
          advanced.push({ zoom: minZ });
        } else {
          setHasZoom(false);
        }

        // Lanterna
        if (capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }

        if (advanced.length > 0 && track.applyConstraints) {
          try {
            await track.applyConstraints({ advanced });
          } catch (_) {}
        }
      }

      // Enumeração assíncrona de câmeras em background para não travar a abertura inicial
      if (navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          setCameras(videoDevices);
          if (!deviceId && videoDevices.length > 0) {
            const backCam = videoDevices.find(d =>
              /back|traseira|rear|environment/i.test(d.label)
            );
            if (backCam) {
              setCameraIdAtiva(backCam.deviceId);
            }
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Erro ao acessar a câmera:', err);
      setErro('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  };

  const stopCamera = () => {
    setTorchOn(false);
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

  const applyZoom = async (level) => {
    try {
      const track = stream?.getVideoTracks?.()[0];
      if (track && track.applyConstraints) {
        await track.applyConstraints({ advanced: [{ zoom: level }] });
        setZoomLevel(level);
      }
    } catch (e) {
      console.warn('Erro ao aplicar zoom:', e);
    }
  };

  const toggleTorch = async () => {
    try {
      const track = stream?.getVideoTracks?.()[0];
      if (track && track.applyConstraints) {
        const next = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      }
    } catch (e) {
      console.warn('Erro ao alternar lanterna:', e);
    }
  };

  const triggerFocus = async (e) => {
    try {
      const track = stream?.getVideoTracks?.()[0];
      if (track && track.applyConstraints) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        }
      }
    } catch (_) {}
  };

  // Redimensiona mantendo ALTA RESOLUÇÃO (Full HD até 1920x1920) e máxima nitidez visual
  const recortarEComprimir = (origem, manterQuadroCompleto = modoAmplo) => {
    let srcW = 1920;
    let srcH = 1080;

    if (origem instanceof HTMLVideoElement) {
      srcW = origem.videoWidth || 1920;
      srcH = origem.videoHeight || 1080;
    } else if (origem instanceof HTMLImageElement) {
      srcW = origem.naturalWidth || origem.width || 1920;
      srcH = origem.naturalHeight || origem.height || 1080;
    } else if (typeof ImageBitmap !== 'undefined' && origem instanceof ImageBitmap) {
      srcW = origem.width;
      srcH = origem.height;
    }

    const cropSize = Math.min(srcW, srcH);
    const cropX = manterQuadroCompleto ? 0 : (srcW - cropSize) / 2;
    const cropY = manterQuadroCompleto ? 0 : (srcH - cropSize) / 2;
    const cropW = manterQuadroCompleto ? srcW : cropSize;
    const cropH = manterQuadroCompleto ? srcH : cropSize;

    const maxDimension = manterQuadroCompleto ? 1024 : 768;
    const scale = Math.min(1, maxDimension / Math.max(cropW, cropH));
    const targetWidth = Math.max(1, Math.round(cropW * scale));
    const targetHeight = Math.max(1, Math.round(cropH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(origem, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);

    let base64 = '';
    try {
      base64 = canvas.toDataURL('image/jpeg', 0.85);
    } catch (_) {
      base64 = canvas.toDataURL('image/png');
    }

    return { base64 };
  };

  const fecharScanner = () => {
    recognitionRequestRef.current?.abort();
    recognitionRequestRef.current = null;
    liberarImagemPendente(pendingImageRef.current, true);
    onClose();
  };

  const liberarImagemPendente = (pending, clearSource = false) => {
    if (!pending) return;
    pending.image.onload = null;
    pending.image.onerror = null;
    if (clearSource) pending.image.src = '';
    URL.revokeObjectURL(pending.url);
    if (pendingImageRef.current === pending) pendingImageRef.current = null;
  };

  const enviarParaReconhecimento = async (base64Image) => {
    setProcessando(true);
    setErro(null);
    const controller = new AbortController();
    recognitionRequestRef.current?.abort();
    recognitionRequestRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45_000);

    try {
      const res = await fetch('/api/recognize-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
        signal: controller.signal,
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        throw new Error('Falha na comunicação com o servidor de inteligência visual. Tente novamente.');
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Capa não reconhecida. Tente aproximar ou ajustar o enquadramento.');
      }

      playBeep();
      stopCamera();
      if (handleRecognizedCallback) {
        handleRecognizedCallback({
          artista: data.artista,
          titulo: data.titulo,
          ano: data.ano,
          preco: data.preco || '',
          confianca: data.confianca
        });
      }
      fecharScanner();
    } catch (err) {
      if (timedOut) {
        setErro('O reconhecimento demorou mais do que o esperado. Tente novamente.');
      } else if (err?.name !== 'AbortError') {
        setErro(err.message || 'Falha ao identificar a capa. Tente novamente.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (recognitionRequestRef.current === controller) recognitionRequestRef.current = null;
      setProcessando(false);
    }
  };

  const capturarDoVideo = async () => {
    if (!videoRef.current || processando) return;
    try {
      // Captura direta e instantânea do frame de vídeo ativo (0ms de atraso de obturador)
      const res = recortarEComprimir(videoRef.current);
      const base64 = res.base64;

      setFotoPreview(base64);
      enviarParaReconhecimento(base64);
    } catch (err) {
      setErro('Erro ao capturar frame da câmera.');
    }
  };

  const handleFileUpload = (e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';
    setErro(null);
    if (file.type && !file.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem compatível.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErro('A imagem excede 20 MB. Escolha uma versão menor.');
      return;
    }

    setProcessando(true);
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    const pendingImage = { url: imageUrl, image: img };
    pendingImageRef.current = pendingImage;
    img.onload = () => {
      liberarImagemPendente(pendingImage);
      try {
        const { base64 } = recortarEComprimir(img);
        setFotoPreview(base64);
        void enviarParaReconhecimento(base64);
      } catch (err) {
        setProcessando(false);
        setErro('Não foi possível preparar essa imagem. Tente outro arquivo ou tire uma foto.');
      }
    };
    img.onerror = () => {
      liberarImagemPendente(pendingImage);
      setProcessando(false);
      setErro('O navegador não conseguiu abrir essa imagem. Use JPEG, PNG ou WebP.');
    };
    img.src = imageUrl;
  };

  const tentarNovamente = () => {
    setFotoPreview(null);
    setErro(null);
    startCamera(cameraIdAtiva);
  };

  useEffect(() => {
    if (isOpen) {
      setFotoPreview(null);
      setErro(null);
      setProcessando(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => () => {
    recognitionRequestRef.current?.abort();
    recognitionRequestRef.current = null;
    liberarImagemPendente(pendingImageRef.current, true);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="cover-scanner-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={fecharScanner}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          backgroundColor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IoCamera size={20} color="var(--accent, #e53e3e)" />
            <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#fff', margin: 0 }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={fecharScanner}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #a1a1aa)',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)'
            }}
            aria-label="Fechar modal"
          >
            <IoClose size={24} />
          </button>
        </div>

        {/* Visor / Área da Câmera */}
        <div
          onClick={triggerFocus}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: modoAmplo ? '4 / 3' : '1 / 1',
            background: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'crosshair',
            transition: 'aspect-ratio 0.2s ease'
          }}
        >
          {/* Câmera ao vivo */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: modoAmplo ? 'contain' : 'cover',
              display: fotoPreview ? 'none' : 'block'
            }}
          />

          {/* Guia Visual Quadrada de Enquadramento da Capa (1:1 Vinil) */}
          {!fotoPreview && (
            <div
              style={{
                position: 'absolute',
                inset: modoAmplo ? '8px' : '16px',
                border: '2px dashed rgba(255, 255, 255, 0.55)',
                borderRadius: 'var(--radius-md)',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                zIndex: 2
              }}
            >
              {/* Cantoneiras estilizadas */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '22px', height: '22px', borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderTopLeftRadius: '8px' }} />
                <div style={{ width: '22px', height: '22px', borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderTopRightRadius: '8px' }} />
              </div>

              <div style={{ textAlign: 'center', padding: '4px 8px' }}>
                <span
                  style={{
                    background: 'rgba(0, 0, 0, 0.72)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    letterSpacing: '0.2px'
                  }}
                >
                  {modoAmplo ? 'Sensor Amplo (Sem Zoom Óptico)' : 'Enquadre a capa frontal (1:1)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '22px', height: '22px', borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderBottomLeftRadius: '8px' }} />
                <div style={{ width: '22px', height: '22px', borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderBottomRightRadius: '8px' }} />
              </div>
            </div>
          )}

          {/* Barra de Ações Rápidas Flutuantes no Canto Superior */}
          {!fotoPreview && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                display: 'flex',
                gap: '8px',
                zIndex: 4
              }}
            >
              {/* Alternar Lanterna */}
              {hasTorch && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleTorch(); }}
                  style={{
                    background: torchOn ? '#e53e3e' : 'rgba(0, 0, 0, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title={torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
                >
                  {torchOn ? <IoFlash size={18} /> : <IoFlashOutline size={18} />}
                </button>
              )}

              {/* Alternar Modo Amplo (evita zoom óptico do crop 1:1) */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setModoAmplo(!modoAmplo); }}
                style={{
                  background: modoAmplo ? '#e53e3e' : 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title={modoAmplo ? 'Modo Quadrado (1:1)' : 'Modo Sensor Completo (Sem Zoom)'}
              >
                {modoAmplo ? <IoContractOutline size={18} /> : <IoExpandOutline size={18} />}
              </button>

              {/* Alternar Câmera */}
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCamera(); }}
                  style={{
                    background: 'rgba(0, 0, 0, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Alternar câmera"
                >
                  <IoCameraReverseOutline size={19} />
                </button>
              )}
            </div>
          )}

          {/* Prévia da imagem capturada */}
          {fotoPreview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fotoPreview}
              alt="Prévia da capa"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: '#09090b',
                display: 'block'
              }}
            />
          )}

          {/* Overlay de Processamento */}
          {processando && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.82)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                zIndex: 10
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                  borderTopColor: 'var(--accent, #e53e3e)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>
                Reconhecendo arte visual...
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #a1a1aa)' }}>
                Identificando capa e obra fonográfica
              </span>
            </div>
          )}
        </div>

        {/* Controles de Zoom de Hardware (Botões rápidos 0.5x, 1x, 2x) */}
        {!fotoPreview && hasZoom && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '6px 12px',
              background: '#121214',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            {zoomRange.min < 0.9 && (
              <button
                type="button"
                onClick={() => applyZoom(zoomRange.min)}
                style={{
                  padding: '3px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: zoomLevel === zoomRange.min ? '1px solid #e53e3e' : '1px solid rgba(255, 255, 255, 0.15)',
                  background: zoomLevel === zoomRange.min ? 'rgba(229, 62, 62, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                0.5x (Grande Angular)
              </button>
            )}
            <button
              type="button"
              onClick={() => applyZoom(1)}
              style={{
                padding: '3px 12px',
                borderRadius: 'var(--radius-sm)',
                border: Math.abs(zoomLevel - 1) < 0.2 ? '1px solid #e53e3e' : '1px solid rgba(255, 255, 255, 0.15)',
                background: Math.abs(zoomLevel - 1) < 0.2 ? 'rgba(229, 62, 62, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              1x (Padrão)
            </button>
            {zoomRange.max >= 2 && (
              <button
                type="button"
                onClick={() => applyZoom(2)}
                style={{
                  padding: '3px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: Math.abs(zoomLevel - 2) < 0.2 ? '1px solid #e53e3e' : '1px solid rgba(255, 255, 255, 0.15)',
                  background: Math.abs(zoomLevel - 2) < 0.2 ? 'rgba(229, 62, 62, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                2x (Zoom)
              </button>
            )}
          </div>
        )}

        {/* Mensagem de Erro (se houver) */}
        {erro && (
          <div
            role="alert"
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(229, 62, 62, 0.12)',
              borderBottom: '1px solid rgba(229, 62, 62, 0.3)',
              color: '#fc8181',
              fontSize: '12.5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              flexShrink: 0
            }}
          >
            <span style={{ fontWeight: 500 }}>Atenção:</span>
            <span>{erro}</span>
          </div>
        )}

        {/* Rodapé / Controles */}
        <div
          style={{
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '10px',
            minHeight: '130px',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          {fotoPreview && !processando ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button
                type="button"
                onClick={tentarNovamente}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  minHeight: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                <IoRefresh size={18} /> Tirar outra foto
              </button>
            </div>
          ) : (
            <>
              {/* Botão Obturador Central */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={capturarDoVideo}
                  disabled={processando || !!erro}
                  style={{
                    width: '68px',
                    height: '68px',
                    minWidth: '68px',
                    minHeight: '68px',
                    maxWidth: '68px',
                    maxHeight: '68px',
                    aspectRatio: '1 / 1',
                    flexShrink: 0,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '4px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.25)',
                    cursor: processando ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.15s ease',
                    padding: 0,
                    boxSizing: 'border-box',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    opacity: processando ? 0.6 : 1
                  }}
                  aria-label="Capturar foto da capa"
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      minWidth: '52px',
                      minHeight: '52px',
                      aspectRatio: '1 / 1',
                      flexShrink: 0,
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      border: '2px solid #18181b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <IoCamera size={24} color="#18181b" />
                  </div>
                </button>
              </div>

              {/* Botão Secundário: Carregar da Galeria */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processando}
                className="btn btn-secondary"
                style={{
                  minHeight: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                <IoImageOutline size={17} /> Escolher foto da galeria
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
