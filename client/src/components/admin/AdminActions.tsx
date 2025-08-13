// AdminActions component has been removed from the production version
// This component contained debugging tools and data manipulation utilities
// that are not needed in the production environment

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminActionsProps {
  user: {
    username: string;
    rights: string[];
  } | null;
}

export default function AdminActions({ user }: AdminActionsProps) {
  // Check if user has admin rights
  const isAdmin = user?.rights?.includes('admin');

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Admin Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">
          Welcome to the administrator dashboard.
        </p>
      </CardContent>
    </Card>
  );
}