import type { RetryPolicy } from "./retryPolicy";

export interface JobHandler<T> {
  /** Throw to have the message retried according to the consumer's RetryPolicy. */
  handle(body: T): Promise<void>;
  /** Called once the last attempt has failed; must record the terminal failure. */
  giveUp(body: T, error: unknown): Promise<void>;
}

export interface QueueConsumer<T> {
  handler: JobHandler<T>;
  retry: RetryPolicy;
}

type KindHandlers<M extends { kind: string }> = {
  [K in M["kind"]]: JobHandler<Extract<M, { kind: K }>>;
};

export function byKind<M extends { kind: string }>(
  handlers: KindHandlers<M>
): JobHandler<M> {
  const pick = (message: M) =>
    handlers[message.kind as M["kind"]] as unknown as JobHandler<M>;
  return {
    handle: (message) => pick(message).handle(message),
    giveUp: (message, error) => pick(message).giveUp(message, error),
  };
}

export async function dispatchBatch<T>(
  batch: MessageBatch<T>,
  consumer: QueueConsumer<T>
): Promise<void> {
  const { handler, retry } = consumer;

  for (const message of batch.messages) {
    try {
      await handler.handle(message.body);
      message.ack();
    } catch (error) {
      console.error(
        `[${batch.queue}] attempt ${message.attempts} failed:`,
        error instanceof Error ? error.message : error
      );

      if (message.attempts < retry.maxAttempts) {
        message.retry({ delaySeconds: retry.delaySeconds(message.attempts) });
        continue;
      }

      try {
        await handler.giveUp(message.body, error);
        message.ack();
      } catch (giveUpError) {
        console.error(`[${batch.queue}] giveUp failed:`, giveUpError);
        message.retry({ delaySeconds: retry.delaySeconds(message.attempts) });
      }
    }
  }
}
