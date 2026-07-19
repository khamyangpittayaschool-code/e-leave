import { Metadata } from "next";
import RepairDetailPage from "../../_components/RepairDetailPage";

export const metadata: Metadata = {
  title: "รายละเอียดการซ่อม | e-Leave",
};

export default function RepairDetailRoute({ params }: { params: { id: string } }) {
  return <RepairDetailPage repairId={params.id} />;
}
