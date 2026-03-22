import { useState } from 'react';
import { LayoutDashboard, Plus, GripVertical, X, Save, BarChart3, PieChart, Table2, Activity, Clock, Hash, Eye } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { Widget } from '@/stores/dashboardStore';
import { cn } from '@/lib/cn';

const WIDGET_PALETTE = [
  { type: 'bar-chart', label: 'Bar Chart', icon: BarChart3, description: 'Comparative bar chart visualization' },
  { type: 'pie-chart', label: 'Pie Chart', icon: PieChart, description: 'Distribution donut/pie chart' },
  { type: 'table', label: 'Data Table', icon: Table2, description: 'Sortable data table widget' },
  { type: 'line-chart', label: 'Line Chart', icon: Activity, description: 'Trend line chart over time' },
  { type: 'timeline', label: 'Timeline', icon: Clock, description: 'Event timeline feed' },
  { type: 'stat-card', label: 'Stat Card', icon: Hash, description: 'Single metric with trend' },
];

function generateId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Workshop() {
  const { widgets, isEditing, addWidget, removeWidget, toggleEditing, saveDashboard } = useDashboardStore();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('');

  const handleAddWidget = (type: string, label: string) => {
    const col = widgets.length % 2 === 0 ? 0 : 6;
    const row = Math.floor(widgets.length / 2);
    const widget: Widget = {
      id: generateId(),
      type,
      title: label,
      x: col,
      y: row,
      w: 6,
      h: 4,
      config: {},
    };
    addWidget(widget);
  };

  const handleSave = () => {
    if (dashboardName.trim()) {
      saveDashboard(dashboardName.trim());
      setDashboardName('');
      setSaveModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Dashboard Workshop</h1>
            <p className="text-sm text-content-secondary">Build custom dashboards by adding and arranging widgets</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isEditing ? 'primary' : 'secondary'}
            size="sm"
            onClick={toggleEditing}
            icon={isEditing ? <Eye className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
          >
            {isEditing ? 'Preview' : 'Edit Mode'}
          </Button>
          <Button variant="secondary" size="sm" icon={<Save className="h-4 w-4" />} onClick={() => setSaveModalOpen(true)} disabled={widgets.length === 0}>
            Save Dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Widget Palette */}
        <div className="col-span-3">
          <Card className="sticky top-4">
            <CardHeader title="Widget Palette" />
            <CardContent className="space-y-2">
              {WIDGET_PALETTE.map((w) => {
                const Icon = w.icon;
                return (
                  <button
                    key={w.type}
                    onClick={() => handleAddWidget(w.type, w.label)}
                    className="flex items-center gap-3 w-full rounded-lg border border-border-default p-3 text-left hover:bg-surface-hover/50 hover:border-border-hover transition-colors cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content-primary">{w.label}</p>
                      <p className="text-xs text-content-tertiary truncate">{w.description}</p>
                    </div>
                    <Plus className="h-4 w-4 text-content-tertiary shrink-0 ml-auto" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Grid Preview */}
        <div className="col-span-9">
          <Card className="min-h-[600px]">
            <CardHeader
              title="Dashboard Canvas"
              action={
                <div className="flex items-center gap-2">
                  <Badge variant="info">{widgets.length} widgets</Badge>
                  {isEditing && <Badge variant="default" dot>Editing</Badge>}
                </div>
              }
            />
            <CardContent>
              {widgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-content-secondary">
                  <LayoutDashboard className="h-12 w-12 mb-4 text-content-tertiary" />
                  <p className="text-sm font-medium mb-1">No widgets added yet</p>
                  <p className="text-xs text-content-tertiary">Click widgets from the palette to add them to your dashboard</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {widgets.map((widget) => {
                    const palItem = WIDGET_PALETTE.find((p) => p.type === widget.type);
                    const Icon = palItem?.icon || BarChart3;
                    return (
                      <div
                        key={widget.id}
                        className={cn(
                          'relative rounded-lg border border-border-default p-4 transition-colors',
                          isEditing ? 'border-dashed border-accent/50 bg-accent/5' : 'bg-surface-hover/20'
                        )}
                      >
                        {/* Drag Handle */}
                        {isEditing && (
                          <div className="absolute top-2 left-2 cursor-grab text-content-tertiary hover:text-content-secondary">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        )}

                        {/* Remove Button */}
                        {isEditing && (
                          <button
                            onClick={() => removeWidget(widget.id)}
                            className="absolute top-2 right-2 rounded p-0.5 text-content-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <div className="flex flex-col items-center justify-center py-8">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-hover mb-3">
                            <Icon className="h-6 w-6 text-content-tertiary" />
                          </div>
                          <p className="text-sm font-medium text-content-primary">{widget.title}</p>
                          <p className="text-xs text-content-tertiary mt-1">{widget.type}</p>
                          <div className="mt-3 h-24 w-full rounded bg-surface-hover/50 flex items-center justify-center">
                            <span className="text-xs text-content-tertiary">Widget Preview Area</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Modal */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Dashboard"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSaveModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!dashboardName.trim()}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-content-secondary">
            Save the current widget layout as a reusable dashboard.
          </p>
          <Input
            label="Dashboard Name"
            placeholder="e.g., OT Security Overview"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
          />
          <p className="text-xs text-content-tertiary">{widgets.length} widgets will be saved</p>
        </div>
      </Modal>
    </div>
  );
}
