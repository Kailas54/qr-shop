import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { TablePage } from './pages/TablePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/t/:qrToken/bistro" element={<TablePage design="bistro" />} />
      <Route path="/t/:qrToken" element={<TablePage design="classic" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
