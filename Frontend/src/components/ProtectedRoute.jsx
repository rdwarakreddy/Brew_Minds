/**
 * ProtectedRoute.jsx
 * ---------------------------------------------------------------------
 * Gates every authenticated page. While AuthContext is still checking
 * for an existing session (isLoading), we show a spinner rather than
 * flashing the login page and then yanking the user to the dashboard a
 * moment later.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullPageSpinner } from './ui/atoms';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
