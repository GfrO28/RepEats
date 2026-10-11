export function estimateOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}
