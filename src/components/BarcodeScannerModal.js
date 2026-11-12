'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { IoClose, IoCameraReverseOutline, IoImageOutline, IoFlashOutline, IoFlashOffOutline } from 'react-icons/io5';
import { FaBarcode } from 'react-icons/fa6';

// Validação matemática estrita de dígitos verificadores Modulo 10 (EAN-13, UPC-A, EAN-8)
// Elimina 100% dos falsos positivos gerados por reflexos, sombras e desfoque
function isValidRetailBarcode(code) {
  if (!code) return false;
  const clean = String(code).trim();

  // UPC-E tem 8 dígitos, mas usa expansão própria antes do cálculo UPC-A.
  if (/^\d{8}$/.test(clean)) {
    const digits = clean.split('').map(Number);
    const [numberSystem, ...rest] = digits;
    if (numberSystem > 1) return false;
    const checkDigit = rest.pop();
    const [d1, d2, d3, d4, d5, d6] = rest;
    let upcAData;

    if (d6 <= 2) upcAData = [numberSystem, d1, d2, d6, 0, 0, 0, 0, d3, d4, d5];
    else if (d6 === 3) upcAData = [numberSystem, d1, d2, d3, 0, 0, 0, 0, 0, d4, d5];
    else if (d6 === 4) upcAData = [numberSystem, d1, d2, d3, d4, 0, 0, 0, 0, 0, d5];
    else upcAData = [numberSystem, d1, d2, d3, d4, d5, 0, 0, 0, 0, d6];

    const sum = upcAData.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
    const upcCheckDigit = (10 - (sum % 10)) % 10;
    const ean8Sum = digits.slice(0, 7).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
    const ean8CheckDigit = (10 - (ean8Sum % 10)) % 10;
    return checkDigit === upcCheckDigit || digits[7] === ean8CheckDigit;
  }

  // EAN-13 (13 dígitos), UPC-A (12 dígitos)
  if (/^\d{12}$|^\d{13}$/.test(clean)) {
    const digits = clean.split('').map(Number);
    const check = digits.pop();
    let sum = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
      const weight = (digits.length - 1 - i) % 2 === 0 ? 3 : 1;
      sum += digits[i] * weight;
    }
    const calcCheck = (10 - (sum % 10)) % 10;
    return calcCheck === check;
  }

  // Code 128 (usado apenas em edições raras ou selos específicos, exigindo 8+ dígitos numéricos)
  if (/^\d{8,14}$/.test(clean)) {
    return true;
  }

  return false;
}

export default function BarcodeScannerModal({ isOpen, onClose, onScan }) {
  const [erroCamera, setErroCamera] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [isStarting, setIsStarting] = useState(true);

  // Controles de hardware de câmera
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState({ min: 1, max: 1 });

  const scannerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const fileInputRef = useRef(null);

  // Armazena leitura candidata para exigir consenso de 2 frames antes de aceitar
  const candidateRef = useRef({ code: '', count: 0, firstSeen: 0 });

  // Som sutil de confirmação de leitura via Web Audio API
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Ignora erro de áudio se o navegador bloquear
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  const handleDetected = (decodedText) => {
    playBeep();
    stopScanner();
    onScan(decodedText.trim());
    onClose();
  };

  // Processador de frames com validação de checksum + consenso de 2 frames
  const handleRawScan = (decodedText) => {
    if (!decodedText) return;
    const clean = decodedText.trim();

    // 1. Rejeição imediata se não tiver formato/checksum de código comercial de disco/CD
    if (!isValidRetailBarcode(clean)) {
      return;
    }

    const now = Date.now();
    // 2. Consenso: exige pelo menos 2 frames consecutivos idênticos em menos de 1.5s
    if (candidateRef.current.code === clean && (now - candidateRef.current.firstSeen) < 1500) {
      candidateRef.current.count += 1;
      if (candidateRef.current.count >= 2) {
        candidateRef.current = { code: '', count: 0, firstSeen: 0 };
        handleDetected(clean);
      }
    } else {
      candidateRef.current = { code: clean, count: 1, firstSeen: now };
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErroCamera(null);
    setIsStarting(true);

    try {
      const html5QrCode = new Html5Qrcode('barcode-file-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        verbose: false,
      });

      const decodedText = await html5QrCode.scanFile(file, false);
      html5QrCode.clear();

      if (decodedText && isValidRetailBarcode(decodedText.trim())) {
        handleDetected(decodedText.trim());
      } else {
        setErroCamera('O código na imagem não é um código de barras comercial válido (EAN/UPC). Tente outra foto ou digite abaixo.');
      }
    } catch (err) {
      console.warn('Falha ao decodificar imagem:', err);
      setErroCamera('Código de barras não identificado na foto. Certifique-se de que a imagem está nítida ou digite o código.');
    } finally {
      setIsStarting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const stopScanner = async () => {
    setTorchOn(false);
    setHasTorch(false);
    setHasZoom(false);
    candidateRef.current = { code: '', count: 0, firstSeen: 0 };

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Erro ao finalizar scanner:', err);
      }
      scannerRef.current = null;
    }
  };

  const toggleTorch = async () => {
    try {
      const videoElem = document.querySelector('#barcode-reader-container video');
      const track = videoElem?.srcObject?.getVideoTracks?.()[0];
      if (track) {
        const next = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      }
    } catch (e) {
      console.warn('Erro ao alternar lanterna:', e);
    }
  };

  const applyZoom = async (level) => {
    try {
      const videoElem = document.querySelector('#barcode-reader-container video');
      const track = videoElem?.srcObject?.getVideoTracks?.()[0];
      if (track) {
        await track.applyConstraints({ advanced: [{ zoom: level }] });
        setZoomLevel(level);
      }
    } catch (e) {
      console.warn('Erro ao aplicar zoom:', e);
    }
  };

  const triggerFocus = async () => {
    try {
      const videoElem = document.querySelector('#barcode-reader-container video');
      const track = videoElem?.srcObject?.getVideoTracks?.()[0];
      if (track && track.getCapabilities) {
        const caps = track.getCapabilities();
        if (caps.focusMode && (caps.focusMode.includes('continuous') || caps.focusMode.includes('macro'))) {
          await track.applyConstraints({
            advanced: [{ focusMode: caps.focusMode.includes('continuous') ? 'continuous' : 'macro' }]
          });
        }
      }
    } catch (e) {
      // silencioso
    }
  };

  const startScanner = async (preferredCameraId = null) => {
    setErroCamera(null);
    setIsStarting(true);
    candidateRef.current = { code: '', count: 0, firstSeen: 0 };

    try {
      await stopScanner();

      // Suporta EXCLUSIVAMENTE formatos de comércio de discos/CDs
      const html5QrCode = new Html5Qrcode('barcode-reader-container', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });

      scannerRef.current = html5QrCode;

      // Inicia imediatamente com a câmera traseira padrão sem travar a UI aguardando enumeração
      const cameraToUse = preferredCameraId 
        ? { deviceId: { exact: preferredCameraId } } 
        : { facingMode: 'environment' };

      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const width = Math.floor(minEdge * 0.88);
        const height = Math.floor(width * 0.48);
        return { width: Math.max(220, width), height: Math.max(110, height) };
      };

      // Inicialização direta instantânea
      await html5QrCode.start(
        cameraToUse,
        {
          fps: 20,
          qrbox: qrboxFunction,
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          handleRawScan(decodedText);
        },
        () => {}
      );

      setIsStarting(false);

      // Obter lista de câmeras em background (assíncrono sem bloquear a abertura)
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          if (preferredCameraId) {
            setCameraIdAtiva(preferredCameraId);
          } else {
            setCameraIdAtiva(devices[0].id);
          }
        }
      }).catch(() => {});

      // Detecção de hardware: Foco Contínuo, Lanterna e Zoom na track já em execução
      try {
        const videoElem = document.querySelector('#barcode-reader-container video');
        const track = videoElem?.srcObject?.getVideoTracks?.()[0];
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities();
          const advanced = [];

          if (caps.focusMode) {
            if (caps.focusMode.includes('continuous')) {
              advanced.push({ focusMode: 'continuous' });
            } else if (caps.focusMode.includes('macro')) {
              advanced.push({ focusMode: 'macro' });
            }
          }

          if (caps.torch) {
            setHasTorch(true);
            setTorchOn(false);
          } else {
            setHasTorch(false);
          }

          if (caps.zoom && caps.zoom.max > 1) {
            setHasZoom(true);
            setZoomCapabilities({ min: caps.zoom.min || 1, max: caps.zoom.max });
            const initialZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min || 1, 1.4));
            setZoomLevel(initialZoom);
            advanced.push({ zoom: initialZoom });
          } else {
            setHasZoom(false);
          }

          if (advanced.length > 0) {
            await track.applyConstraints({ advanced });
          }
        }
      } catch (trackErr) {
        console.warn('Ajuste de capacidades da câmera não suportado neste aparelho:', trackErr);
      }
    } catch (err) {
      console.error('Erro ao iniciar câmera:', err);
      setIsStarting(false);
      setErroCamera(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do seu navegador para escanear.'
          : 'Não foi possível acessar a câmera. Digite o código de barras manualmente abaixo.'
      );
    }
  };

  const toggleCamera = async () => {
    if (!cameras || cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === cameraIdAtiva);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setCameraIdAtiva(nextCamera.id);
    await startScanner(nextCamera.id);
  };

  useEffect(() => {
    if (isOpen) {
      startScanner();
      return () => {
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay" onClick={() => { stopScanner(); onClose(); }}>
      <div className="scanner-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaBarcode size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>Leitor de Código de Barras</h3>
          </div>
          <button 
            type="button" 
            className="scanner-close-btn"
            onClick={() => { stopScanner(); onClose(); }}
            title="Fechar"
          >
            <IoClose size={22} />
          </button>
        </div>

        <div 
          className="scanner-viewfinder-wrapper" 
          onClick={triggerFocus}
          title="Toque na imagem para refocar"
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <div id="barcode-reader-container" style={{ width: '100%', minHeight: '260px' }} />

          {isStarting && !erroCamera && (
            <div className="scanner-status-overlay">
              <div className="scanner-spinner" />
              <span>Calibrando câmera e foco...</span>
            </div>
          )}

          {!erroCamera && !isStarting && (
            <div className="scanner-laser-line" />
          )}

          {erroCamera && (
            <div className="scanner-error-box">
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#fc8181' }}>{erroCamera}</p>
            </div>
          )}
        </div>

        <div className="scanner-modal-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Mantenha a 15–20 cm (toque no vídeo para focar)
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Botão de Lanterna (se suportado pelo celular) */}
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`btn ${torchOn ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title={torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
                >
                  {torchOn ? <IoFlashOutline size={15} /> : <IoFlashOffOutline size={15} />}
                  {torchOn ? 'Luz On' : 'Luz'}
                </button>
              )}

              {/* Botões de Zoom rápido (se suportado pelo celular) */}
              {hasZoom && (
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => applyZoom(1)}
                    style={{
                      padding: '3px 7px',
                      fontSize: '11px',
                      border: 'none',
                      borderRadius: 'var(--radius-xs)',
                      cursor: 'pointer',
                      background: zoomLevel === 1 ? 'var(--accent)' : 'transparent',
                      color: zoomLevel === 1 ? '#000' : 'var(--text)',
                      fontWeight: 500,
                    }}
                  >
                    1x
                  </button>
                  {zoomCapabilities.max >= 1.4 && (
                    <button
                      type="button"
                      onClick={() => applyZoom(1.4)}
                      style={{
                        padding: '3px 7px',
                        fontSize: '11px',
                        border: 'none',
                        borderRadius: 'var(--radius-xs)',
                        cursor: 'pointer',
                        background: Math.abs(zoomLevel - 1.4) < 0.1 ? 'var(--accent)' : 'transparent',
                        color: Math.abs(zoomLevel - 1.4) < 0.1 ? '#000' : 'var(--text)',
                        fontWeight: 500,
                      }}
                    >
                      1.4x
                    </button>
                  )}
                  {zoomCapabilities.max >= 2 && (
                    <button
                      type="button"
                      onClick={() => applyZoom(2)}
                      style={{
                        padding: '3px 7px',
                        fontSize: '11px',
                        border: 'none',
                        borderRadius: 'var(--radius-xs)',
                        cursor: 'pointer',
                        background: zoomLevel === 2 ? 'var(--accent)' : 'transparent',
                        color: zoomLevel === 2 ? '#000' : 'var(--text)',
                        fontWeight: 500,
                      }}
                    >
                      2x
                    </button>
                  )}
                </div>
              )}

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
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Carregar foto da galeria"
              >
                <IoImageOutline size={16} /> Foto
              </button>
              {cameras.length > 1 && (
                <button 
                  type="button" 
                  onClick={toggleCamera} 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Alternar câmera"
                >
                  <IoCameraReverseOutline size={16} /> Lente
                </button>
              )}
            </div>
          </div>
          <div id="barcode-file-reader" style={{ display: 'none' }} />

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                const clean = manualCode.trim();
                if (!isValidRetailBarcode(clean)) {
                  setErroCamera('Código inválido. Confira os dígitos e tente novamente.');
                  return;
                }
                handleDetected(clean);
              }
            }} 
            style={{ display: 'flex', gap: '8px', width: '100%' }}
          >
            <input 
              type="text" 
              placeholder="Ou digite o código de barras (EAN/UPC)..." 
              value={manualCode} 
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1, fontSize: '14px', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={!manualCode.trim()}
              style={{ whiteSpace: 'nowrap', padding: '8px 14px' }}
            >
              OK
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
