import { api } from './api';
import type { OntologyObject, ObjectLink, PaginatedResponse } from '../types';

export async function listObjects(
  typeId?: string,
  filters?: Record<string, unknown>,
  page: number = 1,
  pageSize: number = 25
): Promise<PaginatedResponse<OntologyObject>> {
  const params: Record<string, unknown> = { page, page_size: pageSize };
  if (typeId) params.type_id = typeId;
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value;
      }
    });
  }
  const { data } = await api.get<PaginatedResponse<OntologyObject>>(
    '/objects',
    { params }
  );
  return data;
}

export async function getObject(id: string): Promise<OntologyObject> {
  const { data } = await api.get<OntologyObject>(`/objects/${id}`);
  return data;
}

export async function createObject(
  objectData: Partial<OntologyObject>
): Promise<OntologyObject> {
  const { data } = await api.post<OntologyObject>('/objects', objectData);
  return data;
}

export async function updateObject(
  id: string,
  objectData: Partial<OntologyObject>
): Promise<OntologyObject> {
  const { data } = await api.put<OntologyObject>(
    `/objects/${id}`,
    objectData
  );
  return data;
}

export async function deleteObject(id: string): Promise<void> {
  await api.delete(`/objects/${id}`);
}

export async function getObjectLinks(id: string): Promise<ObjectLink[]> {
  const { data } = await api.get<ObjectLink[]>(`/objects/${id}/links`);
  return data;
}

export async function searchObjects(
  query: string
): Promise<OntologyObject[]> {
  const { data } = await api.get<OntologyObject[]>('/objects/search', {
    params: { q: query },
  });
  return data;
}
