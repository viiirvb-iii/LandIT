import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AppLayout from './components/AppLayout'
import SwipeFeed from './pages/SwipeFeed'
import ReviewPage from './pages/ReviewPage'
import WishlistPage from './pages/WishlistPage'
import './App.css'

function MainApp() {
  const [activeTab, setActiveTab] = useState('swipe')

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {({ showToast }) => (
        <>
          {activeTab === 'swipe' && <SwipeFeed showToast={showToast} />}
          {activeTab === 'review' && <ReviewPage onToast={showToast} />}
          {activeTab === 'wishlist' && <WishlistPage onToast={showToast} />}
        </>
      )}
    </AppLayout>
  )
}

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

  if (!user) return <Navigate to="/login" />
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

  if (user) return <Navigate to="/app" />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/app" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
          <Route path="/swipe" element={<Navigate to="/app" />} />
          <Route path="/dashboard" element={<Navigate to="/app" />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
