import { Component } from 'lucide-react';

export default function SBOM() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-400">
          <Component className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">Software Bill of Materials</h1>
          <p className="text-sm text-content-secondary">Component inventory, licenses, and dependency analysis</p>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20">
        <Component className="h-12 w-12 text-content-muted" />
        <h2 className="mt-4 text-lg font-semibold text-content-primary">No Data Yet</h2>
        <p className="mt-1 text-sm text-content-secondary">SBOM data will be available after scanning assets for software components.</p>
      </div>
    </div>
  );
}
