import { auth,db} from '@/firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot} from 'firebase/firestore'
import type { WorkoutRepository, Exercise } from '@/repositories/WorkoutRepository'

function exercisesCollection() {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('No hay usuario autenticado')
    return collection(db, 'users', uid, 'exercises')
}

function saveExercise(exercise: Exercise) {
  setDoc(doc(exercisesCollection(), exercise.id), exercise)
}

export const firebaseWorkoutRepository: WorkoutRepository = {
  generateExerciseId() { return doc(exercisesCollection()).id },
  subscribeExercises(onChange) { 
    return onSnapshot(exercisesCollection(), (snapshot) => {
        const exercises = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Exercise)
        onChange(exercises)
    })},
  addExercise(exercise) { saveExercise(exercise) },
  updateExercise(exercise) { saveExercise(exercise) },
  deleteExercise(id) { deleteDoc(doc(exercisesCollection(), id)) },
}