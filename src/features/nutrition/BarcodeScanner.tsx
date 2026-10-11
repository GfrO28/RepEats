import { useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const READER_ID = 'barcode-reader'

// Solo códigos de productos (no QR): menos lecturas falsas
const PRODUCT_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
]

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onCameraError: (message: string) => void
}

function describeCameraError(error: unknown): string {
  const text = String(error)
  if (/NotAllowed|Permission/i.test(text)) return 'No hay permiso para usar la cámara. Actívalo en los ajustes del navegador.'
  if (/NotFound|Requested device not found/i.test(text)) return 'No se encontró una cámara en este dispositivo.'
  if (!window.isSecureContext) return 'La cámara solo funciona en una página segura (HTTPS).'
  return 'No se pudo abrir la cámara.'
}

// Muestra la cámara y avisa una sola vez cuando lee un código. Se detiene sola al desmontarse.
export function BarcodeScanner({ onScan, onCameraError }: BarcodeScannerProps) {
  // Los callbacks van en refs para que cambiar de función no reinicie la cámara
  const onScanRef = useRef(onScan)
  const onCameraErrorRef = useRef(onCameraError)
  useEffect(() => {
    onScanRef.current = onScan
    onCameraErrorRef.current = onCameraError
  })

  useEffect(() => {
    let cancelled = false
    let hasScanned = false
    // useBarCodeDetectorIfSupported: false → mismo lector en iPhone y Android (BarcodeDetector solo existe en Android)
    const scanner = new Html5Qrcode(READER_ID, {
      verbose: false,
      formatsToSupport: PRODUCT_FORMATS,
      useBarCodeDetectorIfSupported: false,
    })

    // El arranque se difiere un instante: en desarrollo React monta, desmonta y vuelve a montar el efecto de inmediato,
    // y así la primera pasada se cancela antes de abrir la cámara (dos lectores sobre el mismo elemento se estorban)
    let starting: Promise<void> | null = null
    const timer = window.setTimeout(() => {
      starting = scanner
        .start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 300, height: 160 },
            disableFlip: true, // un código de barras se lee igual al derecho que espejado: no vale la pena probar ambos
            // Resolución más alta que la que pide el navegador por defecto (a veces 640×480): con poca definición,
            // un código de barras chico o algo curvado en el empaque no se termina de leer bien
            videoConstraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          },
          (decodedText) => {
            if (hasScanned || cancelled) return
            hasScanned = true
            onScanRef.current(decodedText)
          },
          undefined,
        )
        .then(() => undefined)
        .catch((error: unknown) => {
          if (!cancelled) onCameraErrorRef.current(describeCameraError(error))
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      // Si ya estaba arrancando hay que esperar a que termine antes de detenerla, si no la cámara queda encendida
      void starting?.then(async () => {
        try {
          if (scanner.isScanning) await scanner.stop()
          scanner.clear()
        } catch {
          // ya estaba detenida
        }
      })
    }
  }, [])

  return <div id={READER_ID} className="w-full overflow-hidden rounded-xl bg-slate-900" />
}
