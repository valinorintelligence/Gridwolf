import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';

// ---------------------------------------------------------------------------
// Lazy-loaded pages
// ---------------------------------------------------------------------------

const Login = lazy(() => import('@/pages/Login'));
const CommandCenter = lazy(() => import('@/pages/CommandCenter'));
const OntologyExplorer = lazy(() => import('@/pages/OntologyExplorer'));
const ObjectDetailPage = lazy(() => import('@/pages/ObjectDetailPage'));
const RelationshipGraphPage = lazy(() => import('@/pages/RelationshipGraphPage'));
const NetworkTopology = lazy(() => import('@/pages/NetworkTopology'));
const AssetInventory = lazy(() => import('@/pages/AssetInventory'));
const VulnerabilityManagement = lazy(() => import('@/pages/VulnerabilityManagement'));
const ThreatIntelligence = lazy(() => import('@/pages/ThreatIntelligence'));
const AttackPaths = lazy(() => import('@/pages/AttackPaths'));
const Compliance = lazy(() => import('@/pages/Compliance'));
const SBOM = lazy(() => import('@/pages/SBOM'));
const SecurityScorecard = lazy(() => import('@/pages/SecurityScorecard'));
const SLATracker = lazy(() => import('@/pages/SLATracker'));
const MetricsAnalytics = lazy(() => import('@/pages/MetricsAnalytics'));
const Timeline = lazy(() => import('@/pages/Timeline'));
const ScanImport = lazy(() => import('@/pages/ScanImport'));
const Integrations = lazy(() => import('@/pages/Integrations'));
const Workshop = lazy(() => import('@/pages/Workshop'));
const Settings = lazy(() => import('@/pages/Settings'));
const AICopilot = lazy(() => import('@/pages/AICopilot'));
const ProtocolAnalyzer = lazy(() => import('@/pages/ProtocolAnalyzer'));
const PurdueModel = lazy(() => import('@/pages/PurdueModel'));

// ---------------------------------------------------------------------------
// Suspense wrapper
// ---------------------------------------------------------------------------

function SuspenseWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function page(Element: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <SuspenseWrapper>
      <Element />
    </SuspenseWrapper>
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

// Use HashRouter for static hosting (GitHub Pages), BrowserRouter for server deployments
const isStaticDeploy = import.meta.env.VITE_DEMO_MODE === 'true';
const createRouter = isStaticDeploy ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: page(Login) }],
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: page(CommandCenter) },
      { path: 'ontology', element: page(OntologyExplorer) },
      { path: 'ontology/:typeId/:objectId', element: page(ObjectDetailPage) },
      { path: 'graph', element: page(RelationshipGraphPage) },
      { path: 'network', element: page(NetworkTopology) },
      { path: 'assets', element: page(AssetInventory) },
      { path: 'vulnerabilities', element: page(VulnerabilityManagement) },
      { path: 'threats', element: page(ThreatIntelligence) },
      { path: 'attack-paths', element: page(AttackPaths) },
      { path: 'compliance', element: page(Compliance) },
      { path: 'sbom', element: page(SBOM) },
      { path: 'scorecard', element: page(SecurityScorecard) },
      { path: 'sla', element: page(SLATracker) },
      { path: 'metrics', element: page(MetricsAnalytics) },
      { path: 'timeline', element: page(Timeline) },
      { path: 'scans/import', element: page(ScanImport) },
      { path: 'integrations', element: page(Integrations) },
      { path: 'workshop', element: page(Workshop) },
      { path: 'settings', element: page(Settings) },
      { path: 'copilot', element: page(AICopilot) },
      { path: 'protocols', element: page(ProtocolAnalyzer) },
      { path: 'purdue', element: page(PurdueModel) },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
