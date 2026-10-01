import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { OrdersBoardPage } from './pages/OrdersBoardPage';
import { TableQrPage } from './pages/TableQrPage';
import { TablesPage } from './pages/TablesPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { accessToken, sessionReady } = useAuth();
  if (!sessionReady) {
    return <p className="p-6 text-slate-400">Restoring session…</p>;
  }
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <OrdersBoardPage />
          </Protected>
        }
      />
      <Route
        path="/tables"
        element={
          <Protected>
            <TablesPage />
          </Protected>
        }
      />
      <Route
        path="/tables/:tableId/qr"
        element={
          <Protected>
            <TableQrPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
