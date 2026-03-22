export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  detail: string;
  status: number;
}

export interface DashboardStats {
  totalObjects: number;
  activeAlerts: number;
  criticalVulns: number;
  threatLevel: 'critical' | 'high' | 'medium' | 'low';
  severityBreakdown: Record<string, number>;
  objectTypeCounts: Record<string, number>;
  recentEvents: AuditEvent[];
}

export interface AuditEvent {
  id: string;
  objectId?: string;
  objectTitle?: string;
  objectType?: string;
  action: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  isActive: boolean;
}
