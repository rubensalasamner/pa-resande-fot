export interface FakeQueue<T> {
  queue: Queue<T>;
  sent: T[];
  drain(): T[];
}

export function createFakeQueue<T>(): FakeQueue<T> {
  const sent: T[] = [];
  const queue = {
    async send(body: T) {
      sent.push(body);
    },
    async sendBatch(messages: Iterable<MessageSendRequest<T>>) {
      for (const message of messages) sent.push(message.body);
    },
  } as unknown as Queue<T>;

  return {
    queue,
    sent,
    drain() {
      return sent.splice(0, sent.length);
    },
  };
}
