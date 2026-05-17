"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function submitLeaveRequest(data: {
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const newRequest = await prisma.leaveRequest.create({
    data: {
      userId: session.user.id,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
      status: "PENDING",
    }
  });

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");

  return { success: true, data: newRequest };
}

export async function getMyLeaveHistory() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const requests = await prisma.leaveRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  });

  return requests;
}

export async function getPendingApprovals() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const requests = await prisma.leaveRequest.findMany({
    where: { status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  return requests;
}

export async function updateLeaveStatus(id: string, status: "APPROVED" | "REJECTED") {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const updatedRequest = await prisma.leaveRequest.update({
    where: { id },
    data: { status }
  });

  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/approvals");

  return { success: true, data: updatedRequest };
}
