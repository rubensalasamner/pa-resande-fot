import { describe, expect, it } from "vitest";
import { sendInBatches } from "../src/queue/sendInBatches";
import { createFakeQueue } from "./helpers/fakeQueue";

describe("sendInBatches", () => {
  it("sends empty input without calling the queue", async () => {
    const fake = createFakeQueue<{ n: number }>();
    expect(await sendInBatches(fake.queue, [])).toBe(0);
  });

  it("sends all bodies and returns the call count", async () => {
    const fake = createFakeQueue<{ n: number }>();
    const calls = await sendInBatches(
      fake.queue,
      Array.from({ length: 5 }, (_, n) => ({ n }))
    );
    expect(calls).toBe(1);
    expect(fake.sent).toEqual([{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }]);
  });

  it("splits when a batch would exceed 100 messages", async () => {
    const fake = createFakeQueue<{ n: number }>();
    const calls = await sendInBatches(
      fake.queue,
      Array.from({ length: 101 }, (_, n) => ({ n }))
    );
    expect(calls).toBe(2);
    expect(fake.sent).toHaveLength(101);
  });
});
