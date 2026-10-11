// Bloquea el desplazamiento de la página de fondo mientras hay una ventana emergente abierta.
//
// Con "overflow: hidden" en el body, Safari de iPhone igual deja mover el fondo. Lo que sí funciona en todos los
// navegadores es fijar el body en su posición actual (position: fixed) y, al desbloquear, volver a la misma altura.
// Varias ventanas abiertas a la vez (una dentro de otra) comparten un solo bloqueo: se libera al cerrar la última.
let lockCount = 0
let savedScrollY = 0

export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    savedScrollY = window.scrollY
    const { style } = document.body
    style.position = 'fixed'
    style.top = `-${savedScrollY}px`
    style.left = '0'
    style.right = '0'
    style.width = '100%'
  }
  lockCount += 1

  let isReleased = false
  return () => {
    if (isReleased) return // liberar dos veces no debe restar dos
    isReleased = true
    lockCount -= 1
    if (lockCount === 0) {
      const { style } = document.body
      style.position = ''
      style.top = ''
      style.left = ''
      style.right = ''
      style.width = ''
      window.scrollTo(0, savedScrollY)
    }
  }
}
