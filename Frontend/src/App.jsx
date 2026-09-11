import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

import Landing from './pages/landing/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import Leads from './pages/leads/Leads';
import Clients from './pages/clients/Clients';
import Projects from './pages/projects/Projects';
import Payments from './pages/payments/Payments';
import Meetings from './pages/meetings/Meetings';
import MeetingHistory from './pages/meetings/MeetingHistory';
import Tasks from './pages/tasks/Tasks';
import Documents from './pages/documents/Documents';
import Invoices from './pages/invoices/Invoices';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <SidebarProvider>
              <BrowserRouter>
                <Routes>
                  {/* ---- Public routes ------------------------------------ */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* ---- Authenticated routes, wrapped in the app shell ---- */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/leads" element={<Leads />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/payments" element={<Payments />} />
                      <Route path="/meetings" element={<Meetings />} />
                      <Route path="/meetings/history" element={<MeetingHistory />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="/documents" element={<Documents />} />
                      <Route path="/invoices" element={<Invoices />} />
                    </Route>
                  </Route>

                  {/* ---- Fallback -------------------------------------------- */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </SidebarProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
