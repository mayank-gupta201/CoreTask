import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './features/auth/Login';
import { Register } from './features/auth/Register';
import { ForgotPassword } from './features/auth/ForgotPassword';
import { ResetPassword } from './features/auth/ResetPassword';
import { VerifyEmail } from './features/auth/VerifyEmail';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardOverview } from './features/dashboard/DashboardOverview';
import { TaskList } from './features/tasks/TaskList';
import { TemplatesPage } from './features/templates/TemplatesPage';
import { PpmDashboard } from './features/ppm/PpmDashboard';
import { GanttView } from '@/features/gantt/GanttView';
import { useAuthStore } from './store/authStore';

function App() {
    const token = useAuthStore((state) => state.token);

    return (
        <Router>
            <Routes>
                <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
                <Route path="/register" element={token ? <Navigate to="/" /> : <Register />} />
                <Route path="/forgot-password" element={token ? <Navigate to="/" /> : <ForgotPassword />} />
                <Route path="/reset-password" element={token ? <Navigate to="/" /> : <ResetPassword />} />
                <Route path="/verify-email" element={token ? <Navigate to="/" /> : <VerifyEmail />} />

                <Route path="/" element={<DashboardLayout />}>
                    <Route index element={<DashboardOverview />} />
                    <Route path="ppm" element={<PpmDashboard />} />
                    <Route path="tasks" element={<TaskList />} />
                    <Route path="templates" element={<TemplatesPage />} />
                    <Route path="gantt" element={<GanttView />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
