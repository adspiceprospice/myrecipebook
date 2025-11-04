import { NextRequest, NextResponse } from 'next/server';
import { textToSpeech } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const audioData = await textToSpeech(text);

    if (!audioData) {
      return NextResponse.json(
        { error: 'Failed to generate audio' },
        { status: 500 }
      );
    }

    return NextResponse.json({ audio: audioData });
  } catch (error) {
    console.error('Error generating TTS:', error);
    return NextResponse.json(
      { error: 'Failed to generate text-to-speech' },
      { status: 500 }
    );
  }
}
