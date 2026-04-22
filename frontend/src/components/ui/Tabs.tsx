import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs compound components must be used within <Tabs>');
  return ctx;
}

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

function TabList({ children, className }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex border-b border-border-default gap-0',
        className
      )}
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function Tab({ value, children, className, disabled = false }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  const handleClick = useCallback(() => {
    if (!disabled) setActiveTab(value);
  }, [disabled, setActiveTab, value]);

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'px-3 py-2 text-xs font-medium transition-colors relative -mb-px cursor-pointer',
        'hover:text-content-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive
          ? 'text-accent-cyan border-b border-accent-cyan'
          : 'text-content-secondary border-b border-transparent',
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function TabPanel({ value, children, className }: TabPanelProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;

  return (
    <div role="tabpanel" className={cn('py-3', className)}>
      {children}
    </div>
  );
}

Tabs.displayName = 'Tabs';
TabList.displayName = 'TabList';
Tab.displayName = 'Tab';
TabPanel.displayName = 'TabPanel';

export { Tabs, TabList, Tab, TabPanel, type TabsProps, type TabProps, type TabPanelProps };
