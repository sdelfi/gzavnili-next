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

export type SmsQueueEntryDTO = { id: number; phone: string; text: string; phoneType: string; createdAt: string };

export type SmsQueuePreview = {
  count: number;
  queue: SmsQueueEntryDTO[];
  queueFirst: SmsQueueEntryDTO[] | null;
};

export function getSmsQueuePreview() {
  return apiGet<SmsQueuePreview>('/api/bema/sms/bulk');
}

export function sendBulkSms(payload: {
  status: string;
  country: 'GE' | 'US' | '';
  sendTo: ('customer' | 'receiver')[];
  message: string;
}) {
  return apiPost<{ found: number; inserted: number }>('/api/bema/sms/bulk', payload);
}

export function cleanSmsQueue() {
  return apiDelete<{ cleared: number }>('/api/bema/sms/bulk');
}

// bema "Send message" (legacy `bema/messages/message_add.cfm` + `message_view.cfm`) — see
// docs/decisions/0033-bema-send-message.md.

export type ComposeMessagePayload = {
  userId: string;
  parcelId?: string | null;
  messageTypeKey: string;
  subject: string;
  subjectGe: string;
  message: string;
  gemessage: string;
  trackingnum: string;
  trackingnum2: string;
  today: string;
  firstname: string;
  rname: string;
  rcity: string;
  receiverid: string;
  senddate: string;
  deliverydate: string;
  servicetransit: string;
  missinginfo: string;
  service: string;
};

export function composeMessage(payload: ComposeMessagePayload) {
  return apiPost<{ id: number }>('/api/bema/messages/compose', payload);
}

export function getMessageTemplate(key: string) {
  return apiGet<{ en: string; ge: string }>(`/api/bema/messages/templates/${encodeURIComponent(key)}`);
}

export type MessageDetail = {
  id: number;
  chain: number | null;
  replyToId: number | null;
  senderUsername: string | null;
  username: string | null;
  trackingNum: string | null;
  subject: string | null;
  subjectGe: string | null;
  bodyFormatted: string | null;
  bodyFormattedGe: string | null;
  createdAt: string;
};

export function getMessage(id: number) {
  return apiGet<{ message: MessageDetail; replyMessage: { bodyFormatted: string | null; bodyFormattedGe: string | null } | null }>(
    `/api/bema/messages/${id}`,
  );
}

export function replyToMessage(id: number, payload: { reply: string; gereply: string }) {
  return apiPost<{ id: number }>(`/api/bema/messages/${id}/reply`, payload);
}
