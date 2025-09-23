console.log("🎤 audio_input_hooks.js loaded and executing");
console.log("Setting up audio input monitoring...");
console.log("Audio input hooks ready for voice detection");

// Configuration flag to control whether speak audio should be audible
const MAKE_SPEAK_AUDIO_AUDIBLE = true;

// Global variables for MediaStream control
let globalAudioContext = null;
let mediaStreams = []; // Array to store multiple MediaStream instances
let currentPlaybackNodes = []; // Array to store current playback nodes for all streams

// Create AudioContext and setup silence generation (multiple streams)
function createControlledMediaStream() {
  // Always create a new stream instead of returning existing one
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Create a MediaStreamDestination to output our controlled audio
  const destination = globalAudioContext.createMediaStreamDestination();

  // Create gain node for volume control
  const gainNode = globalAudioContext.createGain();
  gainNode.connect(destination);

  // Start with silence - create an oscillator with zero gain
  const silenceSourceNode = globalAudioContext.createOscillator();
  const silenceGain = globalAudioContext.createGain();
  silenceGain.gain.setValueAtTime(0, globalAudioContext.currentTime);

  silenceSourceNode.connect(silenceGain);
  silenceGain.connect(gainNode);
  silenceSourceNode.start();

  const mediaStream = destination.stream;

  // Store the stream and its associated nodes
  const streamData = {
    stream: mediaStream,
    gainNode: gainNode,
    destination: destination,
    silenceSourceNode: silenceSourceNode,
    silenceGain: silenceGain,
    currentSourceNode: null,
    id: `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  mediaStreams.push(streamData);
  console.log(`🎤 Created new controlled MediaStream: ${streamData.id} (Total: ${mediaStreams.length})`);
  return mediaStream;
}

// Replace getUserMedia to return our controlled stream
const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = function (constraints) {
  console.log("🎤 Intercepted getUserMedia call with constraints:", constraints);

  // If audio is requested, return our controlled stream
  if (constraints && constraints.audio) {
    console.log("🎤 Returning controlled MediaStream instead of real microphone");
    const controlledStream = createControlledMediaStream();
    return Promise.resolve(controlledStream);
  }

  // For video-only or other requests, use original implementation
  return originalGetUserMedia(constraints);
};

// Expose __speak method to be called from voice-agent-tester.js
window.__speak = function (textOrUrl) {
  console.log(`Speaking: ${textOrUrl}`);

  // Check if input is a URL
  if (textOrUrl.startsWith('http')) {
    console.log(`Detected URL, playing audio in MediaStream: ${textOrUrl}`);
    playAudioInMediaStream(textOrUrl);
  } else {
    console.log(`Detected text, converting to speech in MediaStream: ${textOrUrl}`);
    speakTextInMediaStream(textOrUrl);
  }
};

// Expose dedicated __speakFromUrl method for file-based speech
window.__speakFromUrl = function (url) {
  console.log(`Playing audio from URL in MediaStream: ${url}`);
  playAudioInMediaStream(url);
};

function speakTextInMediaStream(text) {
  console.log(`🎤 Converting text to speech in all MediaStreams: ${text}`);

  if (!globalAudioContext || mediaStreams.length === 0) {
    console.error('AudioContext not initialized or no MediaStreams available');
    return;
  }

  // Create a temporary audio element for speech synthesis
  const utterance = new SpeechSynthesisUtterance(text);

  // Notify when speech starts
  utterance.onstart = function () {
    console.log('🎤 Speech synthesis started');
    if (typeof __publishEvent === 'function') {
      __publishEvent('speechstart', { text: text });
    }
  };

  // Notify when speech ends
  utterance.onend = function () {
    console.log('🎤 Speech synthesis ended');
    if (typeof __publishEvent === 'function') {
      __publishEvent('speechend', { text: text });
    }
  };

  // Handle speech errors
  utterance.onerror = function (event) {
    console.error('Speech synthesis error:', event.error);
    if (typeof __publishEvent === 'function') {
      __publishEvent('speecherror', { error: event.error, text: text });
    }
  };

  // Use speech synthesis but we'll need a different approach for MediaStream
  // For now, we'll use the original method but this could be enhanced
  window.speechSynthesis.speak(utterance);
}

function playAudioInMediaStream(url) {
  console.log(`🎤 Playing audio in all MediaStreams (${mediaStreams.length} streams): ${url}`);

  if (!globalAudioContext || mediaStreams.length === 0) {
    console.error('AudioContext not initialized or no MediaStreams available');
    return;
  }

  // Stop current audio sources in all streams
  stopCurrentAudio();

  // Create new audio element
  const audio = new Audio(url);
  audio.crossOrigin = 'anonymous'; // Enable CORS if needed

  // Set up audio routing through all MediaStreams
  audio.addEventListener('canplaythrough', function () {
    console.log(`🎤 Audio ready to play, routing to ${mediaStreams.length} MediaStreams`);

    try {
      // Create media element source
      const sourceNode = globalAudioContext.createMediaElementSource(audio);

      // Connect to all MediaStream gain nodes
      mediaStreams.forEach((streamData, index) => {
        sourceNode.connect(streamData.gainNode);
        console.log(`🎤 Connected audio to stream ${streamData.id}`);
      });

      // Store the source node for cleanup
      currentPlaybackNodes.push(sourceNode);

      // If flag is enabled, also make it audible by connecting to destination
      if (MAKE_SPEAK_AUDIO_AUDIBLE) {
        sourceNode.connect(globalAudioContext.destination);
        console.log('🎤 Audio will be audible through speakers');
      }

      // Notify when audio starts
      if (typeof __publishEvent === 'function') {
        __publishEvent('speechstart', { url: url, streamCount: mediaStreams.length });
      }

      // Play the audio
      audio.play();
    } catch (error) {
      console.error('Error setting up audio source:', error);
      if (typeof __publishEvent === 'function') {
        __publishEvent('speecherror', { error: error.message, url: url });
      }
    }
  });

  // Handle audio end
  audio.addEventListener('ended', function () {
    console.log('🎤 Audio playback ended');
    if (typeof __publishEvent === 'function') {
      __publishEvent('speechend', { url: url });
    }
  });

  // Handle errors
  audio.addEventListener('error', function (event) {
    console.error('Audio playback error:', event);
    if (typeof __publishEvent === 'function') {
      __publishEvent('speecherror', { error: 'Audio playback failed', url: url });
    }
  });

  // Start loading the audio
  audio.load();
}

// Helper function to stop current audio and reset to silence
function stopCurrentAudio() {
  currentPlaybackNodes.forEach((sourceNode, index) => {
    try {
      sourceNode.stop();
      sourceNode.disconnect();
      console.log(`🎤 Stopped audio source ${index}`);
    } catch (e) {
      console.warn(`Error stopping audio source ${index}:`, e);
    }
  });
  currentPlaybackNodes = [];
  console.log('🎤 Stopped all current audio sources');
}

// Helper function to get information about all MediaStreams
window.__getMediaStreamInfo = function() {
  return {
    totalStreams: mediaStreams.length,
    streams: mediaStreams.map(streamData => ({
      id: streamData.id,
      streamId: streamData.stream.id,
      active: streamData.stream.active,
      tracks: streamData.stream.getTracks().length
    }))
  };
};

// Helper function to remove a specific MediaStream
window.__removeMediaStream = function(streamId) {
  const index = mediaStreams.findIndex(streamData => streamData.id === streamId || streamData.stream.id === streamId);
  if (index !== -1) {
    const streamData = mediaStreams[index];
    try {
      streamData.silenceSourceNode.stop();
      streamData.silenceSourceNode.disconnect();
      streamData.gainNode.disconnect();
      streamData.stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.warn('Error cleaning up MediaStream:', e);
    }
    mediaStreams.splice(index, 1);
    console.log(`🎤 Removed MediaStream: ${streamId} (Remaining: ${mediaStreams.length})`);
    return true;
  }
  return false;
};

// Expose helper function for external control
window.__stopAudio = stopCurrentAudio;

