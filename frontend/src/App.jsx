import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Cadastro from './pages/Cadastro'
import Relatorio from './pages/Relatorio'
import Tabela from './pages/Tabela'
import Dashboard from './pages/Dashboard'
import Sessoes from './pages/Sessoes'
import SessaoDetalhe from './pages/SessaoDetalhe'
import SessaoNovaPlanta from './pages/SessaoNovaPlanta'
import SessaoRevisar from './pages/SessaoRevisar'
import './App.css'

export default function App() {
  // a tabela de dados tem muitas colunas: nessa página o app sai da largura de celular
  const { pathname } = useLocation()
  const paginaLarga = pathname.startsWith('/tabela')

  return (
    <div className={`app ${paginaLarga ? 'app-larga' : ''}`}>
      <header className="app-header">
        <h1>mudas-biochar</h1>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/cadastro">Cadastro Individual</NavLink>
          <NavLink to="/sessao">Sessão</NavLink>
          <NavLink to="/tabela">Tabela</NavLink>
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
          <Route path="/tabela" element={<Tabela />} />
          <Route path="/relatorio" element={<Relatorio />} />
        </Routes>
      </main>
    </div>
  )
}
