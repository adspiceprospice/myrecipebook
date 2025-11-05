export function encode(data: Int16Array): string {
  const bytes = new Uint8Array(data.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  audioData: Uint8Array,
  audioContext: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const totalSamples = audioData.length / 2;
  const audioBuffer = audioContext.createBuffer(
    numChannels,
    totalSamples,
    sampleRate
  );

  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < totalSamples; i++) {
    const int16 = (audioData[i * 2 + 1] << 8) | audioData[i * 2];
    channelData[i] = int16 / 32768.0;
  }

  return audioBuffer;
}
