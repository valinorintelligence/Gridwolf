import { Outlet } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/navigation/Sidebar';
import TopBar from '@/components/navigation/TopBar';
import CommandPalette from '@/components/navigation/CommandPalette';
import { Toaster } from 'react-hot-toast';

export function AppLayout() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(64);

  const handleSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen bg-bg-primary">
      <Sidebar onWidthChange={handleSidebarWidth} />

      {/* Main content area - adjusts margin based on sidebar width */}
      <div
        className="flex h-screen flex-col transition-[margin-left] duration-200"
        style={{ marginLeft: sidebarWidth }}
      >
        <TopBar />
        <main className="flex-1 overflow-auto p-6 pt-20">
          <Outlet />
        </main>
      </div>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface-card)',
            color: 'var(--content-primary)',
            border: '1px solid var(--border)',
          },
          duration: 4000,
        }}
      />
    </div>
  );
}

export default AppLayout;
