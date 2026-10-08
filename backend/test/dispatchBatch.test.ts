import { describe, expect, it, vi } from "vitest";
import {
  byKind,
  dispatchBatch,
  type JobHandler,
} from "../src/queue/dispatchBatch";
import { exponentialBackoff } from "../src/queue/retryPolicy";

function makeMessage<T>(
  body: T,
  attempts: number
): Message<T> & { acked: boolean; retries: number[] } {
  const message = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    body,
    attempts,
    acked: false,
    retries: [] as number[],
    ack() {
      this.acked = true;
    },
    retry(opts?: { delaySeconds?: number }) {
      this.retries.push(opts?.delaySeconds ?? 0);
    },
  };
  return message as Message<T> & { acked: boolean; retries: number[] };
}

function makeBatch<T>(
  messages: Array<Message<T> & { acked: boolean; retries: number[] }>
): MessageBatch<T> {
  return {
    queue: "test",
    messages,
    retryAll() {},
    ackAll() {},
  } as MessageBatch<T>;
}

describe("dispatchBatch", () => {
  it("acks on success", async () => {
    const message = makeMessage({ n: 1 }, 1);
    const handler: JobHandler<{ n: number }> = {
      handle: vi.fn(async () => undefined),
      giveUp: vi.fn(async () => undefined),
    };

    await dispatchBatch(makeBatch([message]), {
      handler,
      retry: exponentialBackoff(3, 10),
    });

    expect(handler.handle).toHaveBeenCalledWith({ n: 1 });
    expect(message.acked).toBe(true);
    expect(message.retries).toEqual([]);
    expect(handler.giveUp).not.toHaveBeenCalled();
  });

  it("retries with exponential delay before the last attempt", async () => {
    const message = makeMessage({ n: 1 }, 2);
    await dispatchBatch(makeBatch([message]), {
      handler: {
        handle: async () => {
          throw new Error("boom");
        },
        giveUp: vi.fn(async () => undefined),
      },
      retry: exponentialBackoff(4, 10),
    });

    expect(message.acked).toBe(false);
    expect(message.retries).toEqual([20]);
  });

  it("calls giveUp and acks on the final attempt", async () => {
    const message = makeMessage({ n: 1 }, 4);
    const giveUp = vi.fn(async () => undefined);

    await dispatchBatch(makeBatch([message]), {
      handler: {
        handle: async () => {
          throw new Error("boom");
        },
        giveUp,
      },
      retry: exponentialBackoff(4, 10),
    });

    expect(giveUp).toHaveBeenCalledOnce();
    expect(message.acked).toBe(true);
  });
});

describe("byKind", () => {
  it("dispatches to the matching kind handler", async () => {
    type Msg =
      | { kind: "a"; value: number }
      | { kind: "b"; value: string };

    const a = vi.fn(async () => undefined);
    const b = vi.fn(async () => undefined);
    const handler = byKind<Msg>({
      a: { handle: a, giveUp: async () => undefined },
      b: { handle: b, giveUp: async () => undefined },
    });

    await handler.handle({ kind: "a", value: 1 });
    expect(a).toHaveBeenCalledWith({ kind: "a", value: 1 });
    expect(b).not.toHaveBeenCalled();
  });
});
