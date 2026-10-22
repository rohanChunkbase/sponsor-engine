export type StoredConversation = {
  id: string;
  title: string;
  subtitle: string;
  request_id?: string;
  original_message?: string;
  created_at: number;
  messages: unknown[];
};

const KEY = "raft.conversations.v1";

export function loadConversations(): StoredConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]") as StoredConversation[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.created_at - a.created_at) : [];
  } catch {
    return [];
  }
}

export function getConversation(id: string): StoredConversation | undefined {
  return loadConversations().find((item) => item.id === id);
}

export function findByRequest(requestId: string): StoredConversation | undefined {
  return loadConversations().find((item) => item.request_id === requestId);
}

export function saveConversation(conversation: StoredConversation) {
  if (typeof window === "undefined") return;
  const rest = loadConversations().filter((item) => item.id !== conversation.id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([conversation, ...rest].slice(0, 50)));
  } catch {
    return;
  }
  window.dispatchEvent(new Event("raft:conversations"));
}
