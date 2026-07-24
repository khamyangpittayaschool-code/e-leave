import { prisma } from "@/lib/db";

export interface DispatchNotificationInput {
  recipientIds: string[];
  title: string;
  message: string;
  link?: string;
  payload?: Record<string, any>;
}

/**
 * Non-blocking Notification Dispatcher
 * Dispatches UI notifications and background workers without blocking the main Server Action response.
 */
export function dispatchNotification(input: DispatchNotificationInput) {
  setImmediate(async () => {
    try {
      if (!input.recipientIds || input.recipientIds.length === 0) return;

      const notifications = input.recipientIds.map((recipientId) => ({
        recipientId,
        title: input.title,
        message: input.message,
        link: input.link,
        payload: input.payload ?? {},
      }));

      await prisma.notification.createMany({
        data: notifications,
      });
    } catch (error) {
      console.error("[NOTIFICATION QUEUE ERROR]:", error);
    }
  });
}
