/** One chat message after a channel adapter has read it. */
export type InboundMessage = {
  channel: string;
  from: string;
  text: string;
  receivedAt: string;
  threadId: string;
};
