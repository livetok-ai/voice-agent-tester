console.log("🎤 audio_input_hooks.js loaded and executing");
console.log("Setting up audio input monitoring...");
console.log("Audio input hooks ready for voice detection");

// Configuration flag to control whether speak audio should be audible
const MAKE_SPEAK_AUDIO_AUDIBLE = true;

// Global variables for MediaStream control
let currentAudioContext = null;
let currentGainNode = null;
let currentSourceNode = null;
let currentMediaStream = null;
let silenceSourceNode = null;
let speakAudioContext = null;

// Create AudioContext and setup silence generation
function createControlledMediaStream() {
  if (!currentAudioContext) {
    currentAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // Create a MediaStreamDestination to output our controlled audio
  const destination = currentAudioContext.createMediaStreamDestination();
  
  // Create gain node for volume control
  currentGainNode = currentAudioContext.createGain();
  currentGainNode.connect(destination);
  
  // Start with silence - create an oscillator with zero gain
  silenceSourceNode = currentAudioContext.createOscillator();
  const silenceGain = currentAudioContext.createGain();
  silenceGain.gain.setValueAtTime(0, currentAudioContext.currentTime);
  
  silenceSourceNode.connect(silenceGain);
  silenceGain.connect(currentGainNode);
  silenceSourceNode.start();
  
  currentMediaStream = destination.stream;
  return currentMediaStream;
}

// Replace getUserMedia to return our controlled stream
const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = function(constraints) {
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
window.__speak = function(textOrUrl) {
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
window.__speakFromUrl = function(url) {
  console.log(`Playing audio from URL in MediaStream: ${url}`);
  playAudioInMediaStream(url);
};

function speakTextInMediaStream(text) {
  console.log(`🎤 Converting text to speech in MediaStream: ${text}`);
  
  if (!currentAudioContext || !currentGainNode) {
    console.error('AudioContext not initialized');
    return;
  }
  
  // Create a temporary audio element for speech synthesis
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Notify when speech starts
  utterance.onstart = function() {
    console.log('🎤 Speech synthesis started');
    if (typeof __publishEvent === 'function') {
      __publishEvent('speechstart', { text: text });
    }
  };
  
  // Notify when speech ends
  utterance.onend = function() {
    console.log('🎤 Speech synthesis ended');
    if (typeof __publishEvent === 'function') {
      __publishEvent('speechend', { text: text });
    }
  };
  
  // Handle speech errors
  utterance.onerror = function(event) {
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
  console.log(`🎤 Playing audio in MediaStream: ${url}`);
  
  if (!currentAudioContext || !currentGainNode) {
    console.error('AudioContext not initialized');
    return;
  }
  
  // Stop current audio source if it exists
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch (e) {
      console.warn('Error stopping current source:', e);
    }
  }
  
  // Create new audio element
  const audio = new Audio(url);
  audio.crossOrigin = 'anonymous'; // Enable CORS if needed
  
  // Set up audio routing through our MediaStream
  audio.addEventListener('canplaythrough', function() {
    console.log('🎤 Audio ready to play, routing to MediaStream');
    
    try {
      // Create media element source
      currentSourceNode = currentAudioContext.createMediaElementSource(audio);
      currentSourceNode.connect(currentGainNode);
      
      // If flag is enabled, also make it audible by connecting to destination
      if (MAKE_SPEAK_AUDIO_AUDIBLE) {
        // Use the same source node and connect it to destination for audible playback
        currentSourceNode.connect(currentAudioContext.destination);
        console.log('🎤 Audio will be audible through speakers');
      }
      
      // Notify when audio starts
      if (typeof __publishEvent === 'function') {
        __publishEvent('speechstart', { url: url });
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
  audio.addEventListener('ended', function() {
    console.log('🎤 Audio playback ended');
    if (typeof __publishEvent === 'function') {
      __publishEvent('speechend', { url: url });
    }
  });
  
  // Handle errors
  audio.addEventListener('error', function(event) {
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
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
      currentSourceNode = null;
      console.log('🎤 Stopped current audio source');
    } catch (e) {
      console.warn('Error stopping current audio source:', e);
    }
  }
}

// Expose helper function for external control
window.__stopAudio = stopCurrentAudio;

