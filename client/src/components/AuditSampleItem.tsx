import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Undo2, User, Trash2, Save } from 'lucide-react';
import AuditorBadge from './AuditorBadge';

interface AuditSample {
  id: string;
  customerName: string;
  ticketId: string;
  date: number;
  status: 'available' | 'assigned' | 'completed' | 'inProgress' | 'skipped';
  assignedTo?: string;
  formType: string;
  priority?: 'low' | 'medium' | 'high';
  metadata?: {
    channel?: 'call' | 'email' | 'chat';
    duration?: number;
    category?: string;
  };
  skipReason?: string;
  hasDraft?: boolean; // Flag to indicate whether this sample has a saved draft
}

interface AuditSampleItemProps {
  sample: AuditSample;
  isAuditor: boolean;
  isAdmin?: boolean;
  onStartAudit?: (sample: AuditSample) => void;
  onResetAssignment?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  getPriorityBadge: (priority?: 'low' | 'medium' | 'high') => React.ReactNode;
  formatDuration?: (duration: number) => string;
}

/**
 * A component to display an audit sample consistently
 */
const AuditSampleItem: React.FC<AuditSampleItemProps> = ({
  sample,
  isAuditor,
  isAdmin = false,
  onStartAudit,
  onResetAssignment,
  onPermanentDelete,
  getPriorityBadge,
  formatDuration = (d) => `${d}s`,
}) => {
  // Debug: Log the sample to see assignedTo value
  console.log("AuditSampleItem sample:", sample.id, sample.customerName, "Assigned to:", sample.assignedTo);
  
  // Determine if this sample is assigned to someone
  const isAssigned = sample.status === 'assigned' && sample.assignedTo;
  
  return (
    <div 
      key={sample.id}
      className="p-3 border rounded-md hover:bg-muted transition-colors flex justify-between items-center"
    >
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{sample.customerName}</h3>
          {getPriorityBadge(sample.priority)}
          {sample.hasDraft && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs">
              <Save className="h-3 w-3 mr-1" />
              Draft
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">{sample.ticketId}</span>
        </div>
        
        {/* Always display the assigned auditor with appropriate status-based label */}
        {sample.assignedTo && (
          <AuditorBadge 
            assignedTo={sample.assignedTo} 
            status={sample.status as 'assigned' | 'inProgress' | 'completed'}
          />
        )}
        
        <div className="flex text-xs text-muted-foreground gap-3 mt-1">
          <span>Type: {sample.formType}</span>
          <span>Date: {new Date(sample.date).toLocaleDateString()}</span>
          {sample.metadata?.duration && (
            <span>Duration: {formatDuration(sample.metadata.duration)}</span>
          )}
          <span>Status: {sample.status}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {isAuditor ? (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onStartAudit?.(sample)}
            disabled={false} // Modified to enable the Start Audit button always
          >
            <ClipboardList className="h-4 w-4 mr-1" />
            Start Audit
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onResetAssignment?.(sample.id)}
              disabled={sample.status !== 'assigned'}
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Reset
            </Button>
            {isAdmin && onPermanentDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onPermanentDelete(sample.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditSampleItem;