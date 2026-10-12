import { describe, expect, it } from 'vitest'
import {
  buildSupersetSequence,
  canJoinWithNext,
  getSupersetPartnerIndex,
  isRoundEnd,
  joinWithNext,
  normalizeSupersets,
  separate,
} from './superset'

interface Item {
  id: string
  supersetGroup?: string
}
const item = (id: string, supersetGroup?: string): Item => (supersetGroup === undefined ? { id } : { id, supersetGroup })
const groups = (items: readonly Item[]) => items.map((i) => i.supersetGroup)

describe('canJoinWithNext / joinWithNext', () => {
  it('une dos ejercicios consecutivos sueltos con el mismo grupo', () => {
    const result = joinWithNext([item('a'), item('b'), item('c')], 0)
    expect(groups(result)).toEqual(['ss1', 'ss1', undefined])
  })

  it('no cambia los demás ejercicios ni muta la lista original', () => {
    const original = [item('a'), item('b'), item('c')]
    const result = joinWithNext(original, 1)
    expect(groups(result)).toEqual([undefined, 'ss1', 'ss1'])
    expect(groups(original)).toEqual([undefined, undefined, undefined])
  })

  it('el último ejercicio no tiene siguiente', () => {
    const list = [item('a'), item('b')]
    expect(canJoinWithNext(list, 1)).toBe(false)
    expect(joinWithNext(list, 1)).toEqual(list)
  })

  it('un índice fuera de rango o una lista vacía no hacen nada', () => {
    expect(canJoinWithNext([], 0)).toBe(false)
    expect(joinWithNext([item('a')], 5)).toEqual([item('a')])
  })

  it('no une si alguno de los dos ya está en un superset (solo parejas)', () => {
    const list = [item('a', 'ss1'), item('b', 'ss1'), item('c')]
    expect(canJoinWithNext(list, 1)).toBe(false) // b ya tiene pareja
    expect(canJoinWithNext(list, 0)).toBe(false)
    expect(joinWithNext(list, 1)).toEqual(list)
  })

  it('un segundo superset recibe un identificador distinto al que ya existe', () => {
    const list = [item('a', 'ss1'), item('b', 'ss1'), item('c'), item('d')]
    expect(groups(joinWithNext(list, 2))).toEqual(['ss1', 'ss1', 'ss2', 'ss2'])
  })

  it('reutiliza un identificador libre en vez de repetir uno en uso', () => {
    const list = [item('a'), item('b'), item('c', 'ss1'), item('d', 'ss1')]
    expect(groups(joinWithNext(list, 0))).toEqual(['ss2', 'ss2', 'ss1', 'ss1'])
  })
})

describe('separate', () => {
  it('deja sueltos a los dos miembros, sin dejar el campo (ni como undefined)', () => {
    const result = separate([item('a', 'ss1'), item('b', 'ss1'), item('c')], 1)
    expect(result).toEqual([item('a'), item('b'), item('c')])
    expect('supersetGroup' in result[0]!).toBe(false)
    expect('supersetGroup' in result[1]!).toBe(false)
  })

  it('funciona desde cualquiera de los dos miembros y respeta otros supersets', () => {
    const list = [item('a', 'ss1'), item('b', 'ss1'), item('c', 'ss2'), item('d', 'ss2')]
    expect(groups(separate(list, 0))).toEqual([undefined, undefined, 'ss2', 'ss2'])
    expect(groups(separate(list, 3))).toEqual(['ss1', 'ss1', undefined, undefined])
  })

  it('sobre un ejercicio suelto no hace nada', () => {
    const list = [item('a'), item('b')]
    expect(separate(list, 0)).toEqual(list)
    expect(separate(list, 9)).toEqual(list)
  })
})

describe('getSupersetPartnerIndex', () => {
  const list = [item('a'), item('b', 'ss1'), item('c', 'ss1'), item('d')]

  it('encuentra al compañero, delante o detrás', () => {
    expect(getSupersetPartnerIndex(list, 1)).toBe(2)
    expect(getSupersetPartnerIndex(list, 2)).toBe(1)
  })

  it('un ejercicio suelto o un índice inexistente no tienen compañero', () => {
    expect(getSupersetPartnerIndex(list, 0)).toBeNull()
    expect(getSupersetPartnerIndex(list, 3)).toBeNull()
    expect(getSupersetPartnerIndex(list, 10)).toBeNull()
  })

  it('un grupo cuyos miembros no son consecutivos no tiene compañero', () => {
    expect(getSupersetPartnerIndex([item('a', 'ss1'), item('b'), item('c', 'ss1')], 0)).toBeNull()
  })
})

describe('normalizeSupersets', () => {
  it('conserva los supersets válidos tal cual', () => {
    const list = [item('a', 'ss1'), item('b', 'ss1'), item('c')]
    expect(normalizeSupersets(list)).toEqual(list)
  })

  it('si se quita un miembro, el otro queda suelto', () => {
    // era a-b-c con a y b juntos; se quitó b
    expect(normalizeSupersets([item('a', 'ss1'), item('c')])).toEqual([item('a'), item('c')])
  })

  it('si el reordenamiento separó a la pareja, ambos quedan sueltos', () => {
    const result = normalizeSupersets([item('a', 'ss1'), item('x'), item('b', 'ss1')])
    expect(groups(result)).toEqual([undefined, undefined, undefined])
  })

  it('un grupo de tres no es una pareja: ninguno se conserva', () => {
    const result = normalizeSupersets([item('a', 'ss1'), item('b', 'ss1'), item('c', 'ss1')])
    expect(groups(result)).toEqual([undefined, undefined, undefined])
  })

  it('con varias parejas, valida cada una por separado', () => {
    const list = [item('a', 'ss1'), item('b', 'ss1'), item('c', 'ss2'), item('x'), item('d', 'ss2')]
    expect(groups(normalizeSupersets(list))).toEqual(['ss1', 'ss1', undefined, undefined, undefined])
  })

  it('lista vacía', () => {
    expect(normalizeSupersets([])).toEqual([])
  })
})

describe('buildSupersetSequence', () => {
  it('alterna A y B por ronda', () => {
    expect(buildSupersetSequence(2, 2)).toEqual([
      { member: 0, setIndex: 0 },
      { member: 1, setIndex: 0 },
      { member: 0, setIndex: 1 },
      { member: 1, setIndex: 1 },
    ])
  })

  it('si A tiene más series, las últimas rondas son solo de A', () => {
    expect(buildSupersetSequence(3, 1)).toEqual([
      { member: 0, setIndex: 0 },
      { member: 1, setIndex: 0 },
      { member: 0, setIndex: 1 },
      { member: 0, setIndex: 2 },
    ])
  })

  it('si B tiene más series, las últimas rondas son solo de B', () => {
    expect(buildSupersetSequence(1, 3)).toEqual([
      { member: 0, setIndex: 0 },
      { member: 1, setIndex: 0 },
      { member: 1, setIndex: 1 },
      { member: 1, setIndex: 2 },
    ])
  })

  it('sin series en uno de los dos, solo quedan las del otro; sin series en ninguno, nada', () => {
    expect(buildSupersetSequence(2, 0)).toEqual([
      { member: 0, setIndex: 0 },
      { member: 0, setIndex: 1 },
    ])
    expect(buildSupersetSequence(0, 0)).toEqual([])
  })
})

describe('isRoundEnd', () => {
  it('con rondas parejas, se descansa después de la serie de B', () => {
    const steps = buildSupersetSequence(2, 2)
    expect(steps.map((step) => isRoundEnd(step, 2))).toEqual([false, true, false, true])
  })

  it('si B ya no tiene serie en esa ronda, se descansa después de la de A', () => {
    const steps = buildSupersetSequence(3, 1)
    expect(steps.map((step) => isRoundEnd(step, 1))).toEqual([false, true, true, true])
  })

  it('si B tiene más series, cada una de B cierra su ronda', () => {
    const steps = buildSupersetSequence(1, 3)
    expect(steps.map((step) => isRoundEnd(step, 3))).toEqual([false, true, true, true])
  })
})
