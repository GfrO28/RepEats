export type DeliverResult = 'shared' | 'downloaded' | 'cancelled'

// Entrega un archivo de texto al usuario. En el teléfono usa la hoja de compartir del sistema (permite guardarlo
// en Archivos o Drive, que es lo que funciona en una PWA instalada); si no está disponible, lo descarga.
export async function deliverTextFile(text: string, fileName: string, mimeType: string): Promise<DeliverResult> {
  const file = new File([text], fileName, { type: mimeType })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'shared'
    } catch (error) {
      // El usuario cerró la hoja de compartir: no es un fallo ni hace falta descargar
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Cualquier otro fallo (p. ej. el navegador ya no considera el gesto como reciente): se descarga
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
