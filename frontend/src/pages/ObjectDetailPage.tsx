import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Box } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ObjectDetail } from '@/components/ontology/ObjectDetail';
import { PropertyPanel } from '@/components/ontology/PropertyPanel';
import { api } from '@/services/api';
import type { OntologyObject, ObjectTypeDefinition, ObjectLink } from '@/types/ontology';

export default function ObjectDetailPage() {
  const { typeId, objectId } = useParams<{ typeId: string; objectId: string }>();
  const navigate = useNavigate();
  const [object, setObject] = useState<OntologyObject | null>(null);
  const [relatedLinks, setRelatedLinks] = useState<ObjectLink[]>([]);
  const [typeDefinitions, setTypeDefinitions] = useState<ObjectTypeDefinition[]>([]);
  const [linkedObjects, setLinkedObjects] = useState<OntologyObject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [objRes, linksRes, typesRes] = await Promise.all([
          api.get(`/objects/${objectId}`).catch(() => ({ data: null })),
          api.get(`/objects/${objectId}/links`).catch(() => ({ data: [] })),
          api.get('/ontology/types').catch(() => ({ data: [] })),
        ]);
        setObject(objRes.data as OntologyObject);
        const links = Array.isArray(linksRes.data) ? linksRes.data : linksRes.data?.results ?? [];
        setRelatedLinks(links as ObjectLink[]);
        const types = Array.isArray(typesRes.data) ? typesRes.data : typesRes.data?.results ?? [];
        setTypeDefinitions(types as ObjectTypeDefinition[]);

        // Resolve linked objects from links
        const linkedIds = new Set<string>();
        for (const link of links) {
          if (String((link as ObjectLink).sourceId) !== objectId) linkedIds.add(String((link as ObjectLink).sourceId));
          if (String((link as ObjectLink).targetId) !== objectId) linkedIds.add(String((link as ObjectLink).targetId));
        }
        if (linkedIds.size > 0) {
          const linkedResults = await Promise.all(
            Array.from(linkedIds).map((id) =>
              api.get(`/objects/${id}`).catch(() => ({ data: null }))
            )
          );
          setLinkedObjects(linkedResults.map((r) => r.data).filter(Boolean) as OntologyObject[]);
        }
      } catch {
        setObject(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [objectId]);

  const typeDefinition = useMemo(
    () => typeDefinitions.find((t) => t.id === (typeId ?? object?.typeId)),
    [typeId, object, typeDefinitions]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-lg font-semibold text-content-primary">Object not found</p>
        <p className="text-sm text-content-secondary">
          No object with ID "{objectId}" exists.
        </p>
        <Button variant="outline" icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <span className="text-xs text-content-tertiary">/</span>
        <span className="text-xs text-content-tertiary">{object.typeName}</span>
        <span className="text-xs text-content-tertiary">/</span>
        <span className="text-xs font-medium text-content-secondary">{object.title}</span>
        <span className="ml-auto text-[10px] font-mono text-content-muted">{object.id}</span>
      </div>

      {/* Main layout: Detail + Property Panel */}
      <div className="flex gap-4">
        {/* Main detail */}
        <div className="flex-1">
          <ObjectDetail
            object={object}
            typeDefinition={typeDefinition}
            links={relatedLinks}
            linkedObjects={linkedObjects}
          />
        </div>

        {/* Side property panel */}
        <div className="hidden xl:block">
          <PropertyPanel
            object={object}
            typeDefinition={typeDefinition}
          />
        </div>
      </div>

      {/* Related objects quick links */}
      {linkedObjects.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-border-default">
            <h3 className="text-sm font-semibold text-content-primary">
              Related Objects ({linkedObjects.length})
            </h3>
          </div>
          <div className="divide-y divide-border-default">
            {linkedObjects.map((lo) => {
              const link = relatedLinks.find(
                (l) =>
                  (l.sourceId === lo.id && l.targetId === objectId) ||
                  (l.targetId === lo.id && l.sourceId === objectId)
              );
              return (
                <button
                  key={lo.id}
                  type="button"
                  onClick={() => navigate(`/ontology/${lo.typeId}/${lo.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-hover"
                >
                  <span className="flex-1 font-medium text-content-primary">{lo.title}</span>
                  <span className="text-xs text-content-tertiary">{lo.typeName}</span>
                  {link && (
                    <span className="rounded bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-content-secondary">
                      {link.linkType.replace(/_/g, ' ')}
                    </span>
                  )}
                  <ExternalLink size={12} className="text-content-muted" />
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
