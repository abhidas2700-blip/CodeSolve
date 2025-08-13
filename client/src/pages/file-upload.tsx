import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, Trash2, RotateCcw, CheckCircle, AlertTriangle, Clock } from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: string;
  status: "uploading" | "completed" | "failed";
  errorMessage?: string;
}

interface UploadStats {
  total: number;
  successful: number;
  failed: number;
  totalSize: number;
}

export default function FileUpload() {
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: files = [], refetch: refetchFiles } = useQuery<UploadedFile[]>({
    queryKey: ["/api/files"],
  });

  const { data: stats } = useQuery<UploadStats>({
    queryKey: ["/api/upload-stats"],
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const handleFileUpload = async (selectedFiles: FileList) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();

    Array.from(selectedFiles).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Upload successful",
        description: `${result.uploadedFiles.length} file${result.uploadedFiles.length > 1 ? 's' : ''} uploaded successfully`,
      });

      refetchFiles();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Delete failed');

      toast({
        title: "File deleted",
        description: "File has been removed successfully",
      });

      refetchFiles();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Could not delete file",
        variant: "destructive",
      });
    }
  };

  const handleRetryFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/retry`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Retry failed');

      toast({
        title: "Retry initiated",
        description: "File upload retry has been started",
      });

      setTimeout(() => refetchFiles(), 2000);
    } catch (error) {
      toast({
        title: "Retry failed",
        description: "Could not retry file upload",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️';
    if (mimeType.startsWith('text/')) return '📃';
    return '📁';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'uploading':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">File Upload Center</h1>
        <p className="text-gray-600">Upload and manage your files with drag-and-drop functionality</p>
      </div>

      {/* Upload Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.successful || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.failed || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? formatBytes(stats.totalSize) : '0 Bytes'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>Drag and drop files here or click to browse</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 cursor-pointer ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-primary hover:bg-primary/5'
            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!isUploading) {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files) handleFileUpload(target.files);
                };
                input.click();
              }
            }}
          >
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isUploading ? 'Uploading files...' : 'Drop files here to upload'}
            </h3>
            <p className="text-gray-600 mb-6">
              {isUploading ? 'Please wait while files are being processed' : 'or click to browse from your device'}
            </p>
            <Button disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Browse Files'}
            </Button>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            <p><strong>Requirements:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Max file size: 50MB</li>
              <li>Max files: 20 per upload</li>
              <li>Supported formats: PDF, JPG, PNG, DOC, XLS, TXT, ZIP, and more</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files</CardTitle>
          <CardDescription>Manage your uploaded files</CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <File className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
                    <div>
                      <p className="font-medium text-gray-900">{file.originalName}</p>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        {getStatusIcon(file.status)}
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(file.uploadedAt)}</span>
                        {file.status === 'failed' && file.errorMessage && (
                          <>
                            <span>•</span>
                            <span className="text-red-600">{file.errorMessage}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {file.status === 'failed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryFile(file.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}