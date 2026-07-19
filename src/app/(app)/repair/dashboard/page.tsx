import { Metadata } from "next";
import RepairDashboardPage from "../_components/RepairDashboardPage";

export const metadata: Metadata = {
  title: "แดชบอร์ดแจ้งซ่อม | e-Leave",
  description: "วิเคราะห์และรายงานสรุป SLA ระบบแจ้งซ่อม",
};

export default function RepairDashboardRoute() {
  return <RepairDashboardPage />;
}
