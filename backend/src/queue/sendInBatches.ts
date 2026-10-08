const MAX_MESSAGES_PER_BATCH = 100;
const MAX_BYTES_PER_BATCH = 250_000;
const PER_MESSAGE_OVERHEAD_BYTES = 100;

const encoder = new TextEncoder();

export async function sendInBatches<T>(
  queue: Queue<T>,
  bodies: T[]
): Promise<number> {
  let batch: MessageSendRequest<T>[] = [];
  let batchBytes = 0;
  let calls = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await queue.sendBatch(batch);
    calls += 1;
    batch = [];
    batchBytes = 0;
  };

  for (const body of bodies) {
    const size =
      encoder.encode(JSON.stringify(body)).byteLength +
      PER_MESSAGE_OVERHEAD_BYTES;
    if (
      batch.length >= MAX_MESSAGES_PER_BATCH ||
      batchBytes + size > MAX_BYTES_PER_BATCH
    ) {
      await flush();
    }
    batch.push({ body });
    batchBytes += size;
  }

  await flush();
  return calls;
}
