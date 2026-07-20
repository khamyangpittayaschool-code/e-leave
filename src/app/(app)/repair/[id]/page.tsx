import { Metadata } from "next";
import RepairDetailPage from "../_components/RepairDetailPage";

export const metadata: Metadata = {
  title: "รายละเอียดการซ่อม | e-Leave",
};

export default async function RepairDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RepairDetailPage repairId={id} />;
}
