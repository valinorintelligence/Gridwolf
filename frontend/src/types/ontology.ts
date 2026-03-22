export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ObjectStatus = 'active' | 'resolved' | 'mitigated' | 'false_positive' | 'risk_accepted';

export interface PropertySchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'json';
  required: boolean;
  enumValues?: string[];
}

export interface ObjectTypeDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  propertiesSchema: PropertySchema[];
  createdAt: string;
}

export interface OntologyObject {
  id: string;
  typeId: string;
  typeName: string;
  title: string;
  properties: Record<string, unknown>;
  status: string;
  severity?: Severity;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectLink {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: string;
  properties?: Record<string, unknown>;
  createdAt: string;
}

export interface ObjectAction {
  id: string;
  name: string;
  objectTypeId: string;
  actionType: 'jira' | 'isolate' | 'remediate' | 'notify' | 'custom';
  config: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
