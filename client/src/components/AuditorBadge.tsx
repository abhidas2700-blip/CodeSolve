import React from 'react';
import { Badge } from '@/components/ui/badge';
import { User, PlayCircle, CheckCircle } from 'lucide-react';

interface AuditorBadgeProps {
  assignedTo?: string;
  className?: string;
  status?: 'assigned' | 'inProgress' | 'completed';
}

/**
 * A component to display the assigned auditor with a consistent style
 */
export const AuditorBadge: React.FC<AuditorBadgeProps> = ({ 
  assignedTo, 
  className = '',
  status = 'assigned'
}) => {
  // Use a placeholder if no assignedTo value is provided
  const displayName = assignedTo || "Unassigned";
  
  // Configure label text and color based on status
  let label = "Assigned to:";
  let icon = <User className="h-3 w-3 mr-1" />;
  let badgeClass = "bg-blue-50 border-blue-200 text-blue-700";
  
  if (status === 'inProgress') {
    label = "In progress by:";
    icon = <PlayCircle className="h-3 w-3 mr-1" />;
    badgeClass = "bg-amber-50 border-amber-200 text-amber-700";
  } else if (status === 'completed') {
    label = "Audited by:";
    icon = <CheckCircle className="h-3 w-3 mr-1" />;
    badgeClass = "bg-green-50 border-green-200 text-green-700";
  }
  
  // Log for debugging
  console.log("AuditorBadge assignedTo:", assignedTo, "status:", status);
  
  return (
    <div className={`mt-1.5 ${className}`}>
      <Badge className={`${badgeClass} flex items-center`}>
        {icon}
        <span>{label} <span className="font-medium">{displayName}</span></span>
      </Badge>
    </div>
  );
};

export default AuditorBadge;