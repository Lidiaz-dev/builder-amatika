import { useLayoutEffect, useRef } from 'react'
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
import TooltipLayer from './components/TooltipLayer'
import CampaignsPage from './pages/CampaignsPage'
import PseudoPage from './pages/PseudoPage'
import CampaignPage from './pages/CampaignPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { localMode, user, loading, pseudo } = useAuth()
  if (localMode) return children
  if (loading) return <p className="muted center">Chargement…</p>
  if (!user) return <LoginPage />
  // Première connexion (ou compte Google) : le pseudo est demandé une fois.
  return pseudo ? children : <PseudoPage />
}

function Header() {
  const { localMode, user, pseudo, signOut } = useAuth()
  // Hauteur réelle de l'en-tête (il passe sur deux lignes sur petit écran) : les barres collantes se placent dessous.
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    apply()
    const obs = new ResizeObserver(apply)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <header ref={ref} className="site-header no-print">
      <NavLink to="/" className="brand">
        <span className="brand-mark">◆</span> Builder Amatika
      </NavLink>
      <nav>
        <NavLink to="/bandes">Mes bandes</NavLink>
        {!localMode && <NavLink to="/campagnes">Campagnes</NavLink>}
        <NavLink to="/partie">Partie</NavLink>
        <NavLink to="/regles">Compendium</NavLink>
      </nav>
      <div className="header-user">
        {localMode ? (
          <span className="pill" data-tip="Les comptes ne sont pas encore branchés : les bandes sont enregistrées dans ce navigateur uniquement.">
            Mode local
          </span>
        ) : user ? (
          <>
            <NavLink to="/profil" className="header-pseudo hide-mobile" data-tip="Changer de pseudo">{pseudo || user.email}</NavLink>
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
            <Route path="/profil" element={<RequireAuth><PseudoPage edit /></RequireAuth>} />
            <Route path="/campagnes" element={<RequireAuth><CampaignsPage /></RequireAuth>} />
            <Route path="/campagnes/:id" element={<RequireAuth><CampaignPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <TooltipLayer />
      </HashRouter>
    </AuthProvider>
  )
}
