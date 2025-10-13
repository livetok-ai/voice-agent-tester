import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transcribes audio using OpenAI Whisper API
 * @param {string} wavFilePath - Path to the WAV audio file
 * @returns {Promise<string>} - The transcribed text
 */
export async function transcribeAudio(wavFilePath) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required for transcription');
  }

  try {
    // Create a file stream for OpenAI
    const audioFile = fs.createReadStream(wavFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    return transcription.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

/**
 * Evaluates transcribed text against evaluation criteria using LLM with structured output
 * @param {string} transcription - The transcribed text
 * @param {string} evaluationPrompt - The evaluation criteria
 * @returns {Promise<{score: number, explanation: string}>} - The evaluation score from 0 to 1 and explanation
 */
export async function evaluateTranscription(transcription, evaluationPrompt) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required for evaluation');
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that evaluates transcribed speech against given criteria. Provide a numerical score from 0 to 1, where 0 means the criteria is not met at all and 1 means the criteria is fully met."
        },
        {
          role: "user",
          content: `Evaluation criteria: ${evaluationPrompt}\n\nTranscribed speech: "${transcription}"\n\nPlease evaluate whether the transcribed speech meets the criteria and provide a score from 0 to 1 with a brief explanation.`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "transcription_evaluation",
          schema: {
            type: "object",
            properties: {
              score: {
                type: "number",
                description: "A score from 0 to 1 indicating how well the transcription meets the criteria"
              },
              explanation: {
                type: "string",
                description: "A brief explanation of the score"
              }
            },
            required: ["score", "explanation"],
            additionalProperties: false
          },
          strict: true
        }
      },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error evaluating transcription:', error);
    throw new Error(`Evaluation failed: ${error.message}`);
  }
}

/**
 * Converts PCM buffer to WAV format
 * @param {Buffer} pcmBuffer - The PCM audio data
 * @param {number} sampleRate - Sample rate in Hz
 * @param {number} channels - Number of audio channels
 * @param {number} bitsPerSample - Bits per sample (usually 16)
 * @returns {Buffer} - The WAV file buffer
 */
export function pcmToWav(pcmBuffer, sampleRate, channels, bitsPerSample) {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  const wavBuffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF chunk descriptor
  wavBuffer.write('RIFF', offset); offset += 4;
  wavBuffer.writeUInt32LE(fileSize, offset); offset += 4;
  wavBuffer.write('WAVE', offset); offset += 4;

  // fmt sub-chunk
  wavBuffer.write('fmt ', offset); offset += 4;
  wavBuffer.writeUInt32LE(16, offset); offset += 4; // Sub-chunk size
  wavBuffer.writeUInt16LE(1, offset); offset += 2; // Audio format (1 = PCM)
  wavBuffer.writeUInt16LE(channels, offset); offset += 2;
  wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
  wavBuffer.writeUInt32LE(byteRate, offset); offset += 4;
  wavBuffer.writeUInt16LE(blockAlign, offset); offset += 2;
  wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data sub-chunk
  wavBuffer.write('data', offset); offset += 4;
  wavBuffer.writeUInt32LE(dataSize, offset); offset += 4;
  pcmBuffer.copy(wavBuffer, offset);

  return wavBuffer;
}
