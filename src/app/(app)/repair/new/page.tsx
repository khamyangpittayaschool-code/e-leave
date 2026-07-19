import { Metadata } from "next";
import RepairNewPage from "../_components/RepairNewPage";

export const metadata: Metadata = {
  title: "แจ้งซ่อมใหม่ | e-Leave",
  description: "กรอกรายละเอียดแจ้งซ่อม",
};

export default function NewRepairPage() {
  return <RepairNewPage />;
}
