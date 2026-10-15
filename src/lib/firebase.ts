import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Configuration Firebase (comptes + base Firestore), lue dans les variables d'environnement.
 * Tant qu'elle manque, le site tourne en mode local : sans compte, bandes dans le navigateur.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

const configured = !!(config.apiKey && config.authDomain && config.projectId && config.appId)
const app = configured ? initializeApp(config) : null

/** null en mode local. */
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
