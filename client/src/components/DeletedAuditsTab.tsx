import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Download } from "lucide-react";

// Types
interface User {
  username?: string;
  rights?: string[];
}

interface EditHistory {
  timestamp: number;
  editor: string;
  action: string;
}

interface DeletedAudit {
  id: number | string;
  auditId: string;
  agent: string;
  formName?: string;
  timestamp: number;
  score: number;
  deletedBy: string;
  deletedAt: number;
  editHistory?: EditHistory[];
}

interface DeletedAuditsTabProps {
  isAdmin?: boolean;
  currentUser?: User | null;
  dateFrom?: Date;
  dateTo?: Date;
  isDateFilterActive?: boolean;
}

export default function DeletedAuditsTab({ 
  isAdmin = false, 
  currentUser = null,
  dateFrom,
  dateTo,
  isDateFilterActive = false
}: DeletedAuditsTabProps) {
  const [deletedReports, setDeletedReports] = useState<DeletedAudit[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredReports, setFilteredReports] = useState<DeletedAudit[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Load deleted audits
  useEffect(() => {
    if (!isAdmin && !currentUser?.rights?.includes('manager') && !currentUser?.rights?.includes('teamLeader')) {
      // Non-admin/manager/team leader users should not see deleted audits
      setDeletedReports([]);
      return;
    }

    // Load from both deleted audits and reports collections
    const deletedAudits = JSON.parse(localStorage.getItem('qa-deleted-audits') || '[]');
    const deletedReports = JSON.parse(localStorage.getItem('qa-deleted-reports') || '[]');
    
    // Combine both sources
    const combinedReports = [...deletedAudits, ...deletedReports];
    
    // Sort by deletion date (newest first)
    combinedReports.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    
    setDeletedReports(combinedReports);
  }, [isAdmin, currentUser]);

  // Filter by search term and dates
  useEffect(() => {
    // Start with all reports 
    let filtered = [...deletedReports];
    
    // Apply date filter first if active
    if (isDateFilterActive) {
      filtered = filtered.filter(report => {
        // For deleted audits, we can filter by either creation date or deletion date
        // Here we'll use the original creation date (timestamp) to be consistent with other tabs
        const reportDate = new Date(report.timestamp);
        
        // Check if the report date is within the selected range
        const isAfterStart = !dateFrom || reportDate >= dateFrom;
        
        // For the end date, we need to set the time to end of day for proper comparison
        let isBeforeEnd = true;
        if (dateTo) {
          // Create a copy of dateTo with time set to 23:59:59
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          isBeforeEnd = reportDate <= endOfDay;
        }
        
        return isAfterStart && isBeforeEnd;
      });
      
      console.log(`Date filter applied: ${filtered.length} reports matching date range`);
    }
    
    // Then apply search term filter if provided
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(report => 
        (report.auditId && report.auditId.toLowerCase().includes(lowerSearchTerm)) ||
        (report.agent && report.agent.toLowerCase().includes(lowerSearchTerm)) ||
        (report.formName && report.formName.toLowerCase().includes(lowerSearchTerm)) ||
        (report.deletedBy && report.deletedBy.toLowerCase().includes(lowerSearchTerm))
      );
      
      console.log(`Search filter applied: ${filtered.length} reports matching "${searchTerm}"`);
    }
    
    setFilteredReports(filtered);
  }, [searchTerm, deletedReports, isDateFilterActive, dateFrom, dateTo]);

  const toggleHistory = (id: string | number) => {
    setExpandedHistoryId(expandedHistoryId === String(id) ? null : String(id));
  };

  // Function to restore a deleted audit (admin only)
  const handleRestoreAudit = (audit: DeletedAudit) => {
    if (!isAdmin && !currentUser?.rights?.includes('manager')) {
      alert("You don't have permission to restore deleted audits");
      return;
    }

    // First check if we have the full data for this audit
    if (!audit) {
      alert("Cannot restore this audit - data not found");
      return;
    }

    if (!window.confirm(`Are you sure you want to restore audit ${audit.auditId}?`)) {
      return;
    }

    try {
      console.log("Starting audit restoration for:", audit);
      
      // Create a clean copy of the audit without deleted properties
      const { deletedBy, deletedAt, ...auditWithoutDeletedProps } = audit;
      
      // Add restoration info to history
      const restoredAudit = {
        ...auditWithoutDeletedProps,
        editHistory: [
          ...(audit.editHistory || []),
          {
            timestamp: Date.now(),
            editor: currentUser?.username || "Unknown",
            action: "restored from deleted items"
          }
        ]
      };
      
      console.log("Restored audit to be saved:", restoredAudit);

      // Add back to reports
      const reports = JSON.parse(localStorage.getItem('qa-reports') || '[]');
      reports.unshift(restoredAudit); // Add to beginning of array
      localStorage.setItem('qa-reports', JSON.stringify(reports));
      console.log("Updated reports in localStorage");

      // Remove from deleted collections
      const deleteFromDeletedCollections = (key: string) => {
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        const updatedItems = items.filter((item: any) => {
          const idMatch = String(item.id) !== String(audit.id);
          const auditIdMatch = String(item.auditId) !== String(audit.auditId);
          return idMatch && auditIdMatch; // Only keep items that don't match either ID
        });
        localStorage.setItem(key, JSON.stringify(updatedItems));
        console.log(`Removed from ${key}, remaining items: ${updatedItems.length}`);
      };

      deleteFromDeletedCollections('qa-deleted-audits');
      deleteFromDeletedCollections('qa-deleted-reports');

      // Update the UI
      setDeletedReports(prevReports => 
        prevReports.filter(r => String(r.id) !== String(audit.id))
      );
      
      // Refresh filtered reports
      setFilteredReports(prevFiltered => 
        prevFiltered.filter(r => String(r.id) !== String(audit.id))
      );
      
      alert(`Audit ${audit.auditId} restored successfully!`);
    } catch (error) {
      console.error("Error restoring audit:", error);
      alert("Failed to restore the audit. Please try again.");
    }
  };

  const handlePermanentDelete = (audit: DeletedAudit) => {
    if (!isAdmin) {
      alert("Only administrators can permanently delete audits.");
      return;
    }

    if (!window.confirm(
      "WARNING: This action cannot be undone!\n\nAre you absolutely sure you want to permanently delete this audit?"
    )) {
      return;
    }

    try {
      console.log("Starting permanent deletion for audit:", audit);
      
      // Remove from both deleted collections
      const removeFromCollection = (key: string) => {
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        console.log(`Before deletion from ${key}: ${items.length} items`);
        
        const updatedItems = items.filter((item: any) => {
          // If either ID matches, filter the item out (return false)
          const idMatches = String(item.id) === String(audit.id);
          const auditIdMatches = String(item.auditId) === String(audit.auditId);
          
          // Return true to keep items that DON'T match either ID
          return !idMatches && !auditIdMatches;
        });
        
        console.log(`After deletion from ${key}: ${updatedItems.length} items`);
        localStorage.setItem(key, JSON.stringify(updatedItems));
        return updatedItems.length !== items.length; // Return true if something was deleted
      };

      const removedFromAudits = removeFromCollection('qa-deleted-audits');
      const removedFromReports = removeFromCollection('qa-deleted-reports');

      // Add to permanently deleted IDs to prevent re-adding
      const permanentlyDeletedIds = JSON.parse(localStorage.getItem('qa-permanently-deleted-ids') || '[]');
      permanentlyDeletedIds.push(String(audit.id));
      permanentlyDeletedIds.push(String(audit.auditId));
      localStorage.setItem('qa-permanently-deleted-ids', JSON.stringify(permanentlyDeletedIds));
      console.log("Added to permanently deleted IDs");

      // Update both state variables to refresh UI
      setDeletedReports(prevReports => 
        prevReports.filter(r => String(r.id) !== String(audit.id))
      );
      
      // Also update filtered reports
      setFilteredReports(prevFiltered => 
        prevFiltered.filter(r => String(r.id) !== String(audit.id))
      );
      
      if (removedFromAudits || removedFromReports) {
        alert("Audit permanently deleted.");
      } else {
        console.warn("No items were removed from storage");
        alert("Audit removed from view, but may not have been found in storage.");
      }
    } catch (error) {
      console.error("Error permanently deleting audit:", error);
      alert("Failed to delete the audit. Please try again.");
    }
  };

  // Enhanced Export to Excel function with detailed audit data
  const exportToExcel = () => {
    if (filteredReports.length === 0) {
      return;
    }
    
    // Create comprehensive headers for CSV
    let headers = [
      "ID", 
      "Audit ID", 
      "Agent", 
      "Form Name", 
      "Created Date", 
      "Score", 
      "Deleted By", 
      "Deleted Date",
      "Edit History"
    ];
    
    // Create CSV content with headers
    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";
    
    // Add data for each report
    filteredReports.forEach(report => {
      const timestamp = new Date(report.timestamp).toLocaleString();
      const deletedAt = new Date(report.deletedAt).toLocaleString();
      
      // Format edit history as a text summary
      let editHistoryText = "";
      if (report.editHistory && report.editHistory.length > 0) {
        editHistoryText = report.editHistory
          .map(edit => `${new Date(edit.timestamp).toLocaleString()} - ${edit.action} by ${edit.editor}`)
          .join(" | ");
      }
      
      const row = [
        report.id,
        report.auditId,
        report.agent,
        report.formName || "Unknown",
        timestamp,
        report.score,
        report.deletedBy,
        deletedAt,
        editHistoryText
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`)
       .join(",");
      
      csvContent += row + "\n";
    });
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `deleted-audit-reports-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdmin && !currentUser?.rights?.includes('manager') && !currentUser?.rights?.includes('teamLeader')) {
    return null; // Don't render anything for non-privileged users
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="text-amber-500 h-5 w-5" />
          <h3 className="text-lg font-medium">Deleted Audits</h3>
        </div>
        <div className="flex items-center gap-4">
          {filteredReports.length > 0 && (
            <Button 
              variant="outline" 
              onClick={exportToExcel}
              className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border-green-200"
              size="sm"
            >
              <Download className="h-4 w-4" />
              <span>Export Data</span>
            </Button>
          )}
          <div className="w-60">
            <Input 
              placeholder="Search by ID, agent, form name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filteredReports.length > 0 ? (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit ID</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Created On</TableHead>
                <TableHead>Deleted By</TableHead>
                <TableHead>Deleted On</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report, index) => (
                <TableRow key={`deleted-audit-${index}-${String(report.id)}`}>
                  <TableCell>{report.auditId}</TableCell>
                  <TableCell>{report.agent}</TableCell>
                  <TableCell>{report.formName || "Unknown"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      report.score >= 90 ? 'bg-green-100 text-green-800' : 
                      report.score >= 80 ? 'bg-blue-100 text-blue-800' : 
                      report.score >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {report.score}%
                    </span>
                  </TableCell>
                  <TableCell>{new Date(report.timestamp).toLocaleDateString()}</TableCell>
                  <TableCell>{report.deletedBy}</TableCell>
                  <TableCell>{new Date(report.deletedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {(isAdmin || currentUser?.rights?.includes('manager')) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRestoreAudit(report)}
                        >
                          Restore
                        </Button>
                      )}
                      {isAdmin && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handlePermanentDelete(report)}
                        >
                          Delete
                        </Button>
                      )}
                      {report.editHistory && report.editHistory.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleHistory(report.id)}
                        >
                          {expandedHistoryId === String(report.id) ? "Hide History" : "History"}
                        </Button>
                      )}
                    </div>
                    
                    {expandedHistoryId === String(report.id) && report.editHistory && (
                      <div className="mt-2 text-xs">
                        <h4 className="font-semibold mb-1">Edit History:</h4>
                        <ul className="space-y-1">
                          {report.editHistory.map((edit, idx) => (
                            <li key={idx} className="text-gray-600">
                              {new Date(edit.timestamp).toLocaleString()} - {edit.action} by {edit.editor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">No deleted audits found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}