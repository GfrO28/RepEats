import { auth, db } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, onSnapshot, Timestamp, type DocumentData } from 'firebase/firestore'
import type { Session, SessionRepository, SessionExercise, CompletedSet, DropSet } from '@/repositories/SessionRepository'

function sessionsCollection() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return collection(db, 'users', uid, 'sessions')
}

// Firestore rechaza los campos con valor undefined (aquí, un RIR que no se llenó): se omiten
function dropToFirestore({ rir, completedAt, ...drop }: DropSet) {
  return { ...drop, ...(rir !== undefined && { rir }), completedAt: Timestamp.fromDate(completedAt) }
}

function setToFirestore({ rir, completedAt, drops, ...set }: CompletedSet) {
  return {
    ...set,
    ...(rir !== undefined && { rir }),
    completedAt: Timestamp.fromDate(completedAt),
    ...(drops !== undefined && { drops: drops.map(dropToFirestore) }),
  }
}

// Session (con Date) → forma que Firestore espera (con Timestamp)
function sessionToFirestore(session: Session) {
  return {
    ...session,
    startedAt: Timestamp.fromDate(session.startedAt),
    endedAt: session.endedAt ? Timestamp.fromDate(session.endedAt) : null,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map(setToFirestore),
    })),
  }
}

// Lo que devuelve Firestore (con Timestamp) → Session (con Date)
function sessionFromFirestore(id: string, data: DocumentData): Session {
  return {
    id,
    ...data,
    startedAt: (data.startedAt as Timestamp).toDate(),
    endedAt: data.endedAt ? (data.endedAt as Timestamp).toDate() : null,
    manualExerciseKcal: (data.manualExerciseKcal as number | undefined) ?? null,
    exercises: data.exercises.map((exercise: SessionExercise) => ({
      ...exercise,
      sets: exercise.sets.map((set: CompletedSet) => ({
        ...set,
        completedAt: (set.completedAt as unknown as Timestamp).toDate(),
        ...(set.drops && {
          drops: set.drops.map((drop: DropSet) => ({
            ...drop,
            completedAt: (drop.completedAt as unknown as Timestamp).toDate(),
          })),
        }),
      })),
    })),
  } as Session
}

function saveSession(session: Session) {
  setDoc(doc(sessionsCollection(), session.id), sessionToFirestore(session))
}

export const firebaseSessionRepository: SessionRepository = {
  generateSessionId() { return doc(sessionsCollection()).id },
  subscribeSessions(onChange) {
    return onSnapshot(sessionsCollection(), (snapshot) => {
      const sessions = snapshot.docs.map((docSnap) => sessionFromFirestore(docSnap.id, docSnap.data()))
      onChange(sessions)
    })
  },
  addSession(session) { saveSession(session) },
  updateSession(session) { saveSession(session) },
  deleteSession(id) { deleteDoc(doc(sessionsCollection(), id)) },
}
