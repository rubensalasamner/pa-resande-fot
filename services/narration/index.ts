import { DeviceSpeechStrategy } from "./DeviceSpeechStrategy";
import { NarrationQueue } from "./NarrationQueue";
import { PrerecordedAudioStrategy } from "./PrerecordedAudioStrategy";

export const narrator = new NarrationQueue([
  new PrerecordedAudioStrategy(),
  new DeviceSpeechStrategy(),
]);

export { DeviceSpeechStrategy, NarrationQueue, PrerecordedAudioStrategy };
