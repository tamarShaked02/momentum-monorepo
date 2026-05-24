export interface User {
  id: string;
  email: string;
  businessName: string | null;
  businessType: string | null;
  moduleConfig: ModuleConfig | null;
}

export interface ModuleConfig {
  id: string;
  userId: string;
  schedulingEnabled: boolean;
  crmEnabled: boolean;
  inventoryEnabled: boolean;
  tasksEnabled: boolean;
  marketingEnabled: boolean;
  analyticsEnabled: boolean;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { appointments: number };
  appointments?: Appointment[];
}

export interface Appointment {
  id: string;
  userId: string;
  customerId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  notes: string | null;
  createdAt: string;
  customer?: { id: string; name: string; phone?: string };
}

export interface InventoryItem {
  id: string;
  userId: string;
  name: string;
  sku: string | null;
  quantity: number;
  lowThreshold: number;
  price: number | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingCampaign {
  id: string;
  userId: string;
  name: string;
  goal: string | null;
  status: string;
  channels: string[];
  smsContent: string | null;
  emailContent: string | null;
  socialContent: string | null;
  imageUrl: string | null;
  scheduledAt: string | null;
  createdAt: string;
}

export interface DashboardData {
  user: { businessName: string | null; businessType: string | null };
  moduleConfig: ModuleConfig;
  widgets: {
    greeting: string;
    scheduling?: {
      totalToday: number;
      upcoming: Array<{ id: string; title: string; startTime: string; endTime: string; customerName: string; status: string }>;
      nextAppointment: { id: string; title: string; startTime: string; customerName: string } | null;
    };
    crm?: { totalCustomers: number; recentCustomers: Array<{ id: string; name: string; createdAt: string }> };
    inventory?: { totalItems: number; criticalLowCount: number; criticalItems: Array<{ id: string; name: string; quantity: number; lowThreshold: number }> };
    tasks?: { counts: { pending: number; in_progress: number; completed: number }; pendingTasks: Array<{ id: string; title: string; status: string; priority: string; category: string | null; dueDate: string | null }> };
    analytics?: { weekCompletedAppointments: number; totalAppointments: number };
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OnboardingResponse {
  type: 'greeting' | 'question' | 'recommendation';
  message?: string;
  recommended_modules?: Array<{ id: string; reason: string }>;
  summary?: string;
  businessType?: string;
}
