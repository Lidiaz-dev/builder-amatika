import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import CrewListPage from './pages/CrewListPage'
import NewCrewPage from './pages/NewCrewPage'
import CrewBuilderPage from './pages/CrewBuilderPage'
import CrewSheetsPage from './pages/CrewSheetsPage'
import AfterBattlePage from './pages/AfterBattlePage'
import ReferencePage from './pages/ReferencePage'
import GameAssistantPage from './pages/GameAssistantPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { localMode, session, loading } = useAuth()
  if (localMode) return children
  if (loading) return <p className="muted center">Chargement…</p>
  return session ? children : <LoginPage />
}

function Header() {
  const { localMode, session, signOut } = useAuth()
  return (
    <header className="site-header no-print">
      <NavLink to="/" className="brand">
        <span className="brand-mark">◆</span> Builder Amatika
      </NavLink>
      <nav>
        <NavLink to="/bandes">Mes bandes</NavLink>
        <NavLink to="/partie">Partie</NavLink>
        <NavLink to="/regles">Compendium</NavLink>
      </nav>
      <div className="header-user">
        {localMode ? (
          <span className="pill" title="Supabase n'est pas configuré : les bandes sont stockées dans ce navigateur.">
            Mode local
          </span>
        ) : session ? (
          <>
            <span className="muted small hide-mobile">{session.user.email}</span>
            <button className="btn ghost small" onClick={signOut}>Déconnexion</button>
          </>
        ) : null}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Header />
        <main className="page">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/bandes" element={<RequireAuth><CrewListPage /></RequireAuth>} />
            <Route path="/bandes/nouvelle" element={<RequireAuth><NewCrewPage /></RequireAuth>} />
            <Route path="/bandes/:id" element={<RequireAuth><CrewBuilderPage /></RequireAuth>} />
            <Route path="/bandes/:id/fiches" element={<RequireAuth><CrewSheetsPage /></RequireAuth>} />
            <Route path="/bandes/:id/apres-partie" element={<RequireAuth><AfterBattlePage /></RequireAuth>} />
            <Route path="/regles/*" element={<ReferencePage />} />
            <Route path="/partie" element={<GameAssistantPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </HashRouter>
    </AuthProvider>
  )
}
