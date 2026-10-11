import { auth,db} from '@/firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot} from 'firebase/firestore'
import type { Phase, PhaseRepository } from '@/repositories/PhaseRepository'

function phasesCollection() {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('No hay usuario autenticado')
    return collection(db, 'users', uid, 'phases')
}

function savePhase(phase: Phase) {
  setDoc(doc(phasesCollection(), phase.id), phase)
}

export const firebasePhaseRepository: PhaseRepository = {
  generatePhaseId() { return doc(phasesCollection()).id },
  subscribePhases(onChange) { 
    return onSnapshot(phasesCollection(), (snapshot) => {
        // Las fases guardadas antes de existir la transición no traen ese campo
        const phases = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<Phase, 'id' | 'transition'> & Partial<Pick<Phase, 'transition'>>
          return { id: docSnap.id, ...data, transition: data.transition ?? null } satisfies Phase
        })
        onChange(phases)
    })},
  addPhase(phase) { savePhase(phase) },
  updatePhase(phase) { savePhase(phase) },
  deletePhase(id) { deleteDoc(doc(phasesCollection(), id)) },
}