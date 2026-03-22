import { useQuery } from '@tanstack/react-query';
import { listObjectTypes, getObjectType } from '../services/ontology';

export function useObjectTypes() {
  return useQuery({
    queryKey: ['objectTypes'],
    queryFn: listObjectTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useObjectType(id: string | null | undefined) {
  return useQuery({
    queryKey: ['objectType', id],
    queryFn: () => getObjectType(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
