import { DashboardLayout } from "@/components/DashboardLayout";
import EnhancedKanbanBoard from "@/components/EnhancedKanbanBoard";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function KanbanBoardPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <EnhancedKanbanBoard />
      </DashboardLayout>
    </ProtectedRoute>
  );
}