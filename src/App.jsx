import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AppLayout from './components/AppLayout'
import SwipeFeed from './pages/SwipeFeed'
import ReviewPage from './pages/ReviewPage'
import WishlistPage from './pages/WishlistPage'
import './App.css'

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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/app" element={<WrappedPage Component={SwipeFeed} />} />
          <Route path="/app/swipe" element={<WrappedPage Component={SwipeFeed} />} />
          <Route path="/app/review" element={<WrappedPage Component={ReviewPage} propName="onToast" />} />
          <Route path="/app/wishlist" element={<WrappedPage Component={WishlistPage} propName="onToast" />} />
          <Route path="*" element={<Navigate to="/app" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
