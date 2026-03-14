import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import SwipeFeed from './pages/SwipeFeed'
import './App.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-plane">✈</div>
        <p>Preparing for takeoff...</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-plane">✈</div>
        <p>Preparing for takeoff...</p>
      </div>
    )
  }
  if (user) return <Navigate to="/swipe" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup"    element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/swipe"     element={<ProtectedRoute><SwipeFeed /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*"          element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
