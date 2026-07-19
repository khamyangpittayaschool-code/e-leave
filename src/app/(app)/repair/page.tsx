import { Metadata } from "next";
import RepairListPage from "./_components/RepairListPage";

export const metadata: Metadata = {
  title: "ระบบแจ้งซ่อม | e-Leave",
  description: "จัดการคำขอแจ้งซ่อมในโรงเรียน",
};

export default function RepairPage() {
  return <RepairListPage />;
}
