import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { BankCallback } from './pages/BankCallback'
import { Dashboard } from './pages/Dashboard'
import { Home } from './pages/Home'
import { Onboarding } from './pages/Onboarding'

function Protected() {
  const { token } = useAuth()
  if (!token) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/tink-callback" element={<BankCallback />} />
      <Route path="/onboarding/bank-callback" element={<BankCallback />} />
      <Route element={<Protected />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
