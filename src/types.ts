import { ReactNode } from 'react';

export interface NavItem {
  name: string;
  href: string;
}

export interface Service {
  title: string;
  description: string;
  icon: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  category: string;
  image: string;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export type NotificationType = 'order' | 'payment' | 'promotion' | 'general';
export type NotificationAudience = 'individual' | 'selected' | 'all';
export type NotificationStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'PARTIAL_FAILURE' | 'FAILED';

export interface DeviceDeliveryResult {
  token: string;
  tokenPreview: string;
  success: boolean;
  messageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  cleanupAction?: string;
  timestamp: number;
}

export interface NotificationLog {
  id?: string;
  notificationId: string;
  type: NotificationType;
  audienceType: NotificationAudience;
  createdAt: number;
  createdBy: string;
  title: string;
  body: string;
  iconUrl?: string;
  imageUrl?: string | null;
  clickUrl: string;
  targetUserIds: string[];
  targetDeviceCount: number;
  successCount: number;
  failureCount: number;
  status: NotificationStatus;
  orderId?: string | null;
  deviceResults?: DeviceDeliveryResult[];
}

export interface UserNotificationPreferences {
  orders: boolean;
  payments: boolean;
  promotions: boolean;
  general: boolean;
  updatedAt?: number;
}
