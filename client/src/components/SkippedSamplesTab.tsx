import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface User {
  id?: number;
  username?: string;
  rights?: string[];
}

interface SkippedSample {
  id: number;
  auditId: string;
  formName: string;
  agent: string;
  agentId: string;
  auditor: number | null;
  auditorName: string;
  reason: string;
  timestamp: Date | string;
  status: string;
}

interface SkippedSamplesTabProps {
  isAdmin?: boolean;
  currentUser?: User | null;
  dateFrom?: Date;
  dateTo?: Date;
  isDateFilterActive?: boolean;
}

export default function SkippedSamplesTab({ 
  isAdmin = false, 
  currentUser = null,
  dateFrom,
  dateTo,
  isDateFilterActive = false
}: SkippedSamplesTabProps) {
  const [skippedSamples, setSkippedSamples] = useState<SkippedSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSample, setSelectedSample] = useState<SkippedSample | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Check if user has permission to view this tab
  const hasPermission = () => {
    if (!currentUser || !currentUser.rights) return false;
    
    // Only admin, manager, and teamleader can access this tab
    // Auditors should NOT see this tab
    return currentUser.rights.some(right => 
      ["admin", "manager", "teamleader"].includes(right)
    );
  };

  // Load skipped samples when component mounts
  useEffect(() => {
    if (!hasPermission()) return;
    
    loadSkippedSamples();
  }, [currentUser]);

  const loadSkippedSamples = async () => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/skipped-samples", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch skipped samples");
      }
      
      const data = await response.json();
      setSkippedSamples(data);
    } catch (error) {
      console.error("Error loading skipped samples:", error);
      // Fallback to localStorage if API fails
      const localStorage = window.localStorage;
      const stored = localStorage.getItem('qa-skipped-samples');
      if (stored) {
        try {
          setSkippedSamples(JSON.parse(stored));
        } catch (e) {
          console.error('Error parsing stored skipped samples:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSkippedSample = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this skipped sample?")) {
      return;
    }

    try {
      const response = await fetch(`/api/skipped-samples/${id}`, {
        method: "DELETE",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete skipped sample");
      }
      
      // Remove from local state
      setSkippedSamples(prevSamples => 
        prevSamples.filter(sample => sample.id !== id)
      );
      
      // Close dialog if the deleted sample was being viewed
      if (selectedSample && selectedSample.id === id) {
        setShowDetailsDialog(false);
        setSelectedSample(null);
      }
    } catch (error) {
      console.error("Error deleting skipped sample:", error);
      alert("Failed to delete skipped sample. Please try again.");
    }
  };

  const handleViewDetails = (sample: SkippedSample) => {
    setSelectedSample(sample);
    setShowDetailsDialog(true);
  };

  // Filter samples based on search query and date range
  const filteredSamples = skippedSamples.filter(sample => {
    // Step 1: Apply date filter if active
    if (isDateFilterActive) {
      const sampleDate = new Date(sample.timestamp);
      
      // Check if date is within range
      const isAfterStart = !dateFrom || sampleDate >= dateFrom;
      
      // For end date, set time to end of day for inclusive comparison
      let isBeforeEnd = true;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        isBeforeEnd = sampleDate <= endOfDay;
      }
      
      // If not in date range, filter it out
      if (!isAfterStart || !isBeforeEnd) {
        return false;
      }
      
      // For debugging
      console.log("Date filter applied to skipped samples");
    }
    
    // Step 2: Apply search query filter if provided
    if (searchQuery.trim() === '') {
      return true; // Keep all items if no search term
    }
    
    const query = searchQuery.toLowerCase();
    return (
      sample.auditId.toLowerCase().includes(query) ||
      sample.formName.toLowerCase().includes(query) ||
      sample.agent.toLowerCase().includes(query) ||
      sample.agentId.toLowerCase().includes(query) ||
      sample.auditorName.toLowerCase().includes(query) ||
      sample.reason.toLowerCase().includes(query)
    );
  });
  
  // Log the results of filtering
  if (isDateFilterActive) {
    console.log(`Date filter applied to SkippedSamplesTab: ${filteredSamples.length} samples match the date range`);
  }

  // If user doesn't have permission, show nothing
  if (!hasPermission()) {
    return null;
  }

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>Skipped Samples</CardTitle>
          <CardDescription>
            View and manage samples that were skipped during the audit process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input 
              placeholder="Search skipped samples..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          {loading ? (
            <div className="text-center py-8">Loading skipped samples...</div>
          ) : skippedSamples.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No skipped samples found.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Auditor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSamples.map((sample) => (
                    <TableRow key={sample.id}>
                      <TableCell className="font-medium">{sample.auditId}</TableCell>
                      <TableCell>{sample.formName}</TableCell>
                      <TableCell>{sample.agent}</TableCell>
                      <TableCell>{sample.auditorName}</TableCell>
                      <TableCell>{new Date(sample.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        {sample.reason.length > 30
                          ? `${sample.reason.substring(0, 30)}...`
                          : sample.reason}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewDetails(sample)}
                          >
                            View
                          </Button>
                          {/* Only show delete button for admins or if the auditor is the one who skipped it */}
                          {(currentUser?.rights?.includes('admin') || 
                            currentUser?.rights?.includes('manager') || 
                            currentUser?.rights?.includes('teamleader') ||
                            (currentUser?.id === sample.auditor)) && (
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteSkippedSample(sample.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Skipped Sample Details</DialogTitle>
            <DialogDescription>
              Details of the skipped sample
            </DialogDescription>
          </DialogHeader>
          
          {selectedSample && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Sample ID</p>
                  <p>{selectedSample.auditId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Form</p>
                  <p>{selectedSample.formName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p>{new Date(selectedSample.timestamp).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Agent</p>
                  <p>{selectedSample.agent}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Agent ID</p>
                  <p>{selectedSample.agentId}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Auditor</p>
                <p>{selectedSample.auditorName}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Reason for Skipping</p>
                <div className="p-3 border rounded-md bg-gray-50 mt-1">
                  {selectedSample.reason}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            {/* Only show delete button for admins or if the auditor is the one who skipped it */}
            {(currentUser?.rights?.includes('admin') || 
              currentUser?.rights?.includes('manager') || 
              currentUser?.rights?.includes('teamleader') ||
              (selectedSample && currentUser?.id === selectedSample.auditor)) && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (selectedSample) {
                    handleDeleteSkippedSample(selectedSample.id);
                  }
                }}
              >
                Delete
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setShowDetailsDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}