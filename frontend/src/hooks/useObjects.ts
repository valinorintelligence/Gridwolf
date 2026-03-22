import { useQuery } from '@tanstack/react-query';
import {
  listObjects,
  getObject,
  getObjectLinks,
  searchObjects,
} from '../services/objects';

export function useObjects(
  typeId?: string,
  filters?: Record<string, unknown>,
  page: number = 1,
  pageSize: number = 25
) {
  return useQuery({
    queryKey: ['objects', typeId, filters, page, pageSize],
    queryFn: () => listObjects(typeId, filters, page, pageSize),
    staleTime: 30 * 1000,
  });
}

export function useObject(id: string | null | undefined) {
  return useQuery({
    queryKey: ['object', id],
    queryFn: () => getObject(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useObjectLinks(id: string | null | undefined) {
  return useQuery({
    queryKey: ['objectLinks', id],
    queryFn: () => getObjectLinks(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useObjectSearch(query: string) {
  return useQuery({
    queryKey: ['objectSearch', query],
    queryFn: () => searchObjects(query),
    enabled: query.length >= 2,
    staleTime: 10 * 1000,
  });
}
