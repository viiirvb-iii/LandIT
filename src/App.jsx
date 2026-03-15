import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AppLayout from './components/AppLayout'
import SwipeFeed from './pages/SwipeFeed'
import ReviewPage from './pages/ReviewPage'
import WishlistPage from './pages/WishlistPage'
import Onboarding from './pages/Onboarding'
import './App.css'

// Auth guard — redirects to /login if not authenticated
function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#999' }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function WrappedPage({ Component, propName = 'showToast' }) {
  const location = useLocation()
  const path = location.pathname
  const activeTab = path.includes('/review') ? 'review' : path.includes('/wishlist') ? 'wishlist' : 'swipe'

  return (
    <AppLayout activeTab={activeTab}>
      {({ showToast }) => {
        const props = { [propName]: showToast }
        return <Component {...props} />
      }}
    </AppLayout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth><WrappedPage Component={SwipeFeed} /></RequireAuth>} />
      <Route path="/app/swipe" element={<RequireAuth><WrappedPage Component={SwipeFeed} /></RequireAuth>} />
      <Route path="/app/review" element={<RequireAuth><WrappedPage Component={ReviewPage} propName="onToast" /></RequireAuth>} />
      <Route path="/app/wishlist" element={<RequireAuth><WrappedPage Component={WishlistPage} propName="onToast" /></RequireAuth>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
