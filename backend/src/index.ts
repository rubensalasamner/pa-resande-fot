import { createApp } from "./app";
import type { Env } from "./env";
import { createQueueConsumer } from "./queue/consumers";
import { dispatchBatch } from "./queue/dispatchBatch";

const app = createApp();

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const consumer = createQueueConsumer(batch.queue, env);
    if (!consumer) {
      console.error(`No consumer registered for queue "${batch.queue}"`);
      batch.retryAll();
      return;
    }
    await dispatchBatch(batch, consumer);
  },
};
