import { Navigate, Route, Routes } from 'react-router-dom';
import { useI18n } from '../../shared/i18n/index.tsx';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { MenuPage } from './pages/MenuPage';
import { OrdersBoardPage } from './pages/OrdersBoardPage';
import { TableQrPage } from './pages/TableQrPage';
import { TablesPage } from './pages/TablesPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { accessToken, sessionReady } = useAuth();
  const { t } = useI18n();
  if (!sessionReady) {
    return <p className="admin-app p-6 text-stone-500">{t('admin.restoringSession')}</p>;
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
        path="/menu"
        element={
          <Protected>
            <MenuPage />
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
