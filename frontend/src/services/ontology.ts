import { api } from './api';
import type {
  ObjectTypeDefinition,
  ObjectLink,
  ObjectAction,
  GraphData,
} from '../types';

export async function listObjectTypes(): Promise<ObjectTypeDefinition[]> {
  const { data } = await api.get<ObjectTypeDefinition[]>('/ontology/types');
  return data;
}

export async function getObjectType(
  id: string
): Promise<ObjectTypeDefinition> {
  const { data } = await api.get<ObjectTypeDefinition>(
    `/ontology/types/${id}`
  );
  return data;
}

export async function createObjectType(
  typeData: Partial<ObjectTypeDefinition>
): Promise<ObjectTypeDefinition> {
  const { data } = await api.post<ObjectTypeDefinition>(
    '/ontology/types',
    typeData
  );
  return data;
}

export async function updateObjectType(
  id: string,
  typeData: Partial<ObjectTypeDefinition>
): Promise<ObjectTypeDefinition> {
  const { data } = await api.put<ObjectTypeDefinition>(
    `/ontology/types/${id}`,
    typeData
  );
  return data;
}

export async function getGraph(
  objectId: string,
  depth: number = 2
): Promise<GraphData> {
  const { data } = await api.get<GraphData>(`/ontology/graph/${objectId}`, {
    params: { depth },
  });
  return data;
}

export async function createLink(linkData: {
  sourceId: string;
  targetId: string;
  linkType: string;
  properties?: Record<string, unknown>;
}): Promise<ObjectLink> {
  const { data } = await api.post<ObjectLink>('/ontology/links', linkData);
  return data;
}

export async function deleteLink(id: string): Promise<void> {
  await api.delete(`/ontology/links/${id}`);
}

export async function listActions(typeId: string): Promise<ObjectAction[]> {
  const { data } = await api.get<ObjectAction[]>(
    `/ontology/types/${typeId}/actions`
  );
  return data;
}

export async function executeAction(
  actionId: string,
  objectId: string
): Promise<Record<string, unknown>> {
  const { data } = await api.post<Record<string, unknown>>(
    `/ontology/actions/${actionId}/execute`,
    { objectId }
  );
  return data;
}
