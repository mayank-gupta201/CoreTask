import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { Menu, UserCircle, LogOut, CheckSquare, FileText, LayoutDashboard, Moon, Sun, Briefcase, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspaceSwitcher } from '@/features/workspaces/WorkspaceSwitcher';
import { InviteMemberDialog } from '@/features/workspaces/InviteMemberDialog';
import { AIChatBot } from '@/components/AIChatBot';
import { api } from '@/api/axios';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/ppm', icon: Briefcase, label: 'PPM & Portfolios' },
    { to: '/gantt', icon: LayoutList, label: 'Gantt Chart' },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/templates', icon: FileText, label: 'Templates' },
];

export function DashboardLayout() {
    const { user, logout } = useAuthStore();
    const { sidebarOpen, toggleSidebar, darkMode, toggleDarkMode } = useUIStore();

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            // Ignore failure, clear local state anyway
        } finally {
            logout();
        }
    };

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen w-full bg-background">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-10 flex w-60 flex-col bg-card border-r border-border/60 transition-all duration-300 md:relative md:translate-x-0",
                    !sidebarOpen && "-translate-x-full md:w-0 md:overflow-hidden md:border-0"
                )}
            >
                {/* Logo */}
                <div className="flex h-14 items-center px-5 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                            <CheckSquare className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="font-semibold text-[15px] tracking-tight">TaskMaster</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    {navItems.map(({ to, icon: Icon, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-smooth",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )
                            }
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* User section at bottom */}
                <div className="border-t border-border/60 p-3">
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                            <UserCircle className="h-4 w-4" />
                        </div>
                        <span className="truncate flex-1">{user.email}</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col min-w-0">
                {/* Header */}
                <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-card/80 backdrop-blur-sm px-4 sm:px-6">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={toggleSidebar}>
                        <Menu className="h-4 w-4" />
                    </Button>

                    <div className="flex-1" />

                    <div className="flex items-center gap-2">
                        <WorkspaceSwitcher />
                        <InviteMemberDialog />

                        <div className="h-5 w-px bg-border mx-1" />

                        {/* Dark mode toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={toggleDarkMode}
                            aria-label="Toggle dark mode"
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>

                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5" onClick={handleLogout}>
                            <LogOut className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Log out</span>
                        </Button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>

            {/* AI Chatbot */}
            <AIChatBot />
        </div>
    );
}
