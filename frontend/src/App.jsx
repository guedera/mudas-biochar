import { NavLink, Route, Routes } from 'react-router-dom'
import Cadastro from './pages/Cadastro'
import Relatorio from './pages/Relatorio'
import Dashboard from './pages/Dashboard'
import Sessoes from './pages/Sessoes'
import SessaoDetalhe from './pages/SessaoDetalhe'
import SessaoNovaPlanta from './pages/SessaoNovaPlanta'
import SessaoRevisar from './pages/SessaoRevisar'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>mudas-biochar</h1>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/cadastro">Cadastro Individual</NavLink>
          <NavLink to="/sessao">Sessão</NavLink>
          <NavLink to="/relatorio">Relatório</NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/sessao" element={<Sessoes />} />
          <Route path="/sessao/:id" element={<SessaoDetalhe />} />
          <Route path="/sessao/:id/nova" element={<SessaoNovaPlanta />} />
          <Route path="/sessao/:id/revisar/:plantaId" element={<SessaoRevisar />} />
          <Route path="/relatorio" element={<Relatorio />} />
        </Routes>
      </main>
    </div>
  )
}
