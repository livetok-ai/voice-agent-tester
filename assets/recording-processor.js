// Check if we're in the AudioWorklet context
if (typeof AudioWorkletProcessor !== 'undefined') {

class RecordingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.recordedBuffers = [];
    
    // Listen for messages from the main thread
    this.port.onmessage = (event) => {
      const { command } = event.data;
      
      switch (command) {
        case 'start':
          this.startRecording();
          break;
        case 'stop':
          this.stopRecording();
          break;
      }
    };
  }
  
  startRecording() {
    this.isRecording = true;
    this.recordedBuffers = [];
    console.log('AudioWorklet: Recording started');
  }
  
  stopRecording() {
    this.isRecording = false;
    
    // Combine all recorded buffers
    const totalLength = this.recordedBuffers.reduce((acc, buffer) => acc + buffer.length, 0);
    const combinedBuffer = new Float32Array(totalLength);
    
    let offset = 0;
    for (const buffer of this.recordedBuffers) {
      combinedBuffer.set(buffer, offset);
      offset += buffer.length;
    }
    
    // Send the recorded data back to the main thread
    this.port.postMessage({
      command: 'recordingComplete',
      audioData: combinedBuffer,
      sampleRate: sampleRate
    });
    
    this.recordedBuffers = [];
    console.log('AudioWorklet: Recording stopped, data sent to main thread');
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    // Pass audio through (input to output)
    if (input.length > 0 && output.length > 0) {
      const inputChannel = input[0];
      const outputChannel = output[0];
      
      // Copy input to output to maintain audio flow
      for (let i = 0; i < inputChannel.length; i++) {
        outputChannel[i] = inputChannel[i];
      }
      
      // Record audio if recording is active
      if (this.isRecording && inputChannel.length > 0) {
        const buffer = new Float32Array(inputChannel.length);
        buffer.set(inputChannel);
        this.recordedBuffers.push(buffer);
      }
    }
    
    // Keep the processor alive
    return true;
  }
}

registerProcessor('recording-processor', RecordingProcessor);

} else {
  console.warn('AudioWorkletProcessor not available - this module should only be loaded in an AudioWorklet context');
}