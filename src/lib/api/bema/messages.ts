import { apiDelete, apiGet, apiPatch, apiPost } from '../http';

export type ListMessagesParams = {
  page: number;
  perPage: number;
  search?: string;
  chain?: number;
  userId?: string;
};

export type MessageListItem = {
  id: number;
  chain: number | null;
  replyToId: number | null;
  username: string | null;
  senderUsername: string | null;
  trackingNum: string | null;
  subject: string | null;
  messageTypeLabel: string | null;
  createdAt: string;
  active: boolean;
  read: boolean;
};

export function listMessages(params: ListMessagesParams) {
  const qs = new URLSearchParams({ page: String(params.page), perPage: String(params.perPage) });
  if (params.search) qs.set('search', params.search);
  if (params.chain !== undefined) qs.set('chain', String(params.chain));
  if (params.userId) qs.set('userId', params.userId);
  return apiGet<{ items: MessageListItem[]; total: number }>(`/api/bema/messages?${qs.toString()}`);
}

export function setMessageActive(id: number, active: boolean) {
  return apiPatch<{ message: { id: number; active: boolean } }>(`/api/bema/messages/${id}`, { active });
}

export function deleteMessage(id: number) {
  return apiDelete(`/api/bema/messages/${id}`);
}

export type ListSmsParams = {
  page: number;
  perPage: number;
  search?: string;
  userId?: string;
};

export type SmsListItem = {
  id: number;
  smsTo: string | null;
  smsBody: string | null;
  trackingNum: string | null;
  createdAt: string;
};

export function listSms(params: ListSmsParams) {
  const qs = new URLSearchParams({ page: String(params.page), perPage: String(params.perPage) });
  if (params.search) qs.set('search', params.search);
  if (params.userId) qs.set('userId', params.userId);
  return apiGet<{ items: SmsListItem[]; total: number }>(`/api/bema/sms?${qs.toString()}`);
}

export function sendSms(payload: { phone1: string; message: string }) {
  return apiPost<{ id: number }>('/api/bema/sms', payload);
}
