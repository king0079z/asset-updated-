import { DashboardLayout } from "@/components/DashboardLayout";
import TicketDashboard from "@/components/TicketDashboard";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function TicketDashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TicketDashboard />
      </DashboardLayout>
    </ProtectedRoute>
  );
}