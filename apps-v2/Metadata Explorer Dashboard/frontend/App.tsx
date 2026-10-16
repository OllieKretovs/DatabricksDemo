import { Route, Routes } from 'react-router-dom'
import UniversePage from './pages/UniversePage'
import './appTheme.css'

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<UniversePage />} />
    </Routes>
  )
}
