import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWakeLock } from './useWakeLock'

interface FakeSentinel {
  released: boolean
  release: ReturnType<typeof vi.fn>
}

function makeSentinel(): FakeSentinel {
  const sentinel: FakeSentinel = {
    released: false,
    release: vi.fn(() => {
      sentinel.released = true
      return Promise.resolve()
    }),
  }
  return sentinel
}

function setWakeLock(request: ReturnType<typeof vi.fn> | undefined) {
  Object.defineProperty(navigator, 'wakeLock', { value: request ? { request } : undefined, configurable: true })
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

// Deja que se resuelvan las promesas pendientes (el sentinel se guarda después de esperar la respuesta)
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => setVisibility('visible'))
afterEach(() => {
  // en jsdom la propiedad no existe: se quita la que se definió para las pruebas
  Reflect.deleteProperty(navigator, 'wakeLock')
})

describe('useWakeLock', () => {
  it('pide mantener la pantalla encendida cuando está activo', async () => {
    const request = vi.fn(() => Promise.resolve(makeSentinel()))
    setWakeLock(request)
    renderHook(() => useWakeLock(true))
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
  })

  it('no pide nada si está desactivado', () => {
    const request = vi.fn(() => Promise.resolve(makeSentinel()))
    setWakeLock(request)
    renderHook(() => useWakeLock(false))
    expect(request).not.toHaveBeenCalled()
  })

  it('suelta el bloqueo al desmontar', async () => {
    const sentinel = makeSentinel()
    const request = vi.fn(() => Promise.resolve(sentinel))
    setWakeLock(request)
    const { unmount } = renderHook(() => useWakeLock(true))
    await waitFor(() => expect(request).toHaveBeenCalled())
    await flushPromises()
    unmount()
    expect(sentinel.release).toHaveBeenCalled()
  })

  it('suelta el bloqueo si se desactiva', async () => {
    const sentinel = makeSentinel()
    const request = vi.fn(() => Promise.resolve(sentinel))
    setWakeLock(request)
    const { rerender } = renderHook(({ enabled }) => useWakeLock(enabled), { initialProps: { enabled: true } })
    await waitFor(() => expect(request).toHaveBeenCalled())
    await flushPromises()
    rerender({ enabled: false })
    expect(sentinel.release).toHaveBeenCalled()
  })

  it('si se desmonta antes de que responda el navegador, lo suelta apenas llega', async () => {
    const sentinel = makeSentinel()
    const request = vi.fn(() => Promise.resolve(sentinel))
    setWakeLock(request)
    const { unmount } = renderHook(() => useWakeLock(true))
    unmount() // antes de que se resuelva la petición
    await flushPromises()
    expect(sentinel.release).toHaveBeenCalled()
  })

  it('lo vuelve a pedir al regresar a la app, si el navegador lo soltó', async () => {
    const first = makeSentinel()
    const second = makeSentinel()
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    setWakeLock(request)
    renderHook(() => useWakeLock(true))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    await flushPromises()

    first.released = true // el navegador lo suelta al pasar a segundo plano
    setVisibility('hidden')
    setVisibility('visible')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  })

  it('no lo vuelve a pedir si sigue activo', async () => {
    const request = vi.fn(() => Promise.resolve(makeSentinel()))
    setWakeLock(request)
    renderHook(() => useWakeLock(true))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    await flushPromises()
    setVisibility('visible')
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('no falla si el navegador no soporta Wake Lock', () => {
    setWakeLock(undefined)
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
  })

  it('no falla si el navegador lo niega', async () => {
    const request = vi.fn(() => Promise.reject(new DOMException('denegado', 'NotAllowedError')))
    setWakeLock(request)
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
    await waitFor(() => expect(request).toHaveBeenCalled())
  })
})
