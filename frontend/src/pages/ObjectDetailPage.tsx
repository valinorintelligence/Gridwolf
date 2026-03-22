import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ObjectDetail } from '@/components/ontology/ObjectDetail';
import { PropertyPanel } from '@/components/ontology/PropertyPanel';
import {
  MOCK_OBJECTS,
  MOCK_LINKS,
  OBJECT_TYPE_DEFINITIONS,
} from '@/data/mock';

export default function ObjectDetailPage() {
  const { typeId, objectId } = useParams<{ typeId: string; objectId: string }>();
  const navigate = useNavigate();

  const object = useMemo(
    () => MOCK_OBJECTS.find((o) => o.id === objectId),
    [objectId]
  );

  const typeDefinition = useMemo(
    () => OBJECT_TYPE_DEFINITIONS.find((t) => t.id === (typeId ?? object?.typeId)),
    [typeId, object?.typeId]
  );

  // Find links related to this object
  const relatedLinks = useMemo(
    () =>
      MOCK_LINKS.filter(
        (l) => l.sourceId === objectId || l.targetId === objectId
      ),
    [objectId]
  );

  // Resolve linked objects
  const linkedObjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const link of relatedLinks) {
      if (link.sourceId !== objectId) ids.add(link.sourceId);
      if (link.targetId !== objectId) ids.add(link.targetId);
    }
    return ids;
  }, [relatedLinks, objectId]);

  const linkedObjects = useMemo(
    () => MOCK_OBJECTS.filter((o) => linkedObjectIds.has(o.id)),
    [linkedObjectIds]
  );

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
