import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

interface AuthState {
  /** true quand Firebase n'est pas configuré : pas de compte, stockage navigateur. */
  localMode: boolean
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Messages Firebase traduits pour l'écran de connexion. */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Adresse ou mot de passe incorrect.',
  'auth/wrong-password': 'Adresse ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cette adresse.',
  'auth/invalid-email': "Cette adresse email n'est pas valide.",
  'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse : connectez-vous.',
  'auth/weak-password': 'Mot de passe trop court : 6 caractères minimum.',
  'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion internet.',
  'auth/popup-closed-by-user': 'Fenêtre Google fermée avant la fin de la connexion.',
  'auth/unauthorized-domain': "Ce site n'est pas encore autorisé dans Firebase (Authentication > Settings > Authorized domains).",
  'auth/operation-not-allowed': "Ce mode de connexion n'est pas activé dans Firebase.",
}

function friendly(err: unknown): Error {
  const code = (err as { code?: string }).code ?? ''
  return new Error(MESSAGES[code] ?? (err as Error).message)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!auth)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const value: AuthState = {
    localMode: !auth,
    user,
    loading,
    async signIn(email, password) {
      try {
        await signInWithEmailAndPassword(auth!, email, password)
      } catch (err) {
        throw friendly(err)
      }
    },
    async signUp(email, password) {
      try {
        await createUserWithEmailAndPassword(auth!, email, password)
      } catch (err) {
        throw friendly(err)
      }
    },
    async resetPassword(email) {
      try {
        await sendPasswordResetEmail(auth!, email)
      } catch (err) {
        throw friendly(err)
      }
    },
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider()
      try {
        await signInWithPopup(auth!, provider)
      } catch (err) {
        // Fenêtre bloquée (certains mobiles) : on passe par une redirection.
        if ((err as { code?: string }).code === 'auth/popup-blocked') return signInWithRedirect(auth!, provider)
        throw friendly(err)
      }
    },
    async signOut() {
      if (auth) await firebaseSignOut(auth)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
