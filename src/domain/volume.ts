import type { Session } from '@/repositories/SessionRepository'
import { getSetVolume } from './dropSet'

export function calculateSessionVolume(session: Session): number {
  return session.exercises.reduce((total, exercise) => {
    const exerciseVolume = exercise.sets
      .filter((set) => set.type !== 'Calentamiento')
      .reduce((subtotal, set) => subtotal + getSetVolume(set), 0)
    return total + exerciseVolume
  }, 0)
}
