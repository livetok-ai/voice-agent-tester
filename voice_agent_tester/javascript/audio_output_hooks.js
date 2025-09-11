let i = 0;

class AudioElementMonitor {
  constructor() {
    this.monitoredElements = new Map();
    this.audioContext = null;
    this.bodyMutationObserver = null; // Observer for new elements added to body
    this.audioElementObservers = new Map(); // Map of individual observers for each audio element
    this.init();
  }

  init() {
    this.setupAudioContext();
    this.setupBodyMutationObserver();
    this.scanExistingAudioElements();
    console.log("AudioElementMonitor initialized");
  }

  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log("AudioContext created successfully");
    } catch (error) {
      console.error("Failed to create AudioContext:", error);
    }
  }

  setupBodyMutationObserver() {
    if (this.bodyMutationObserver) {
      // Already set up
      return;
    }
    this.bodyMutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForNewAudioElements(node);
            }
          });
        }
      });
    });

    this.bodyMutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log("Body MutationObserver setup complete");
  }

  setupAudioElementObserver(audioElement) {
    const elementId = this.getElementId(audioElement);

    if (this.audioElementObservers.has(elementId)) {
      // Already observing this element
      return;
    }

    // Since srcObject is a property, not an attribute, we need to use a different approach
    // We'll override the srcObject setter to detect changes
    const originalDescriptor = Object.getOwnPropertyDescriptor(audioElement, 'srcObject') ||
      Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');

    // Create a property descriptor that intercepts srcObject changes
    const monitor = this;
    Object.defineProperty(audioElement, 'srcObject', {
      get() {
        return originalDescriptor ? originalDescriptor.get.call(this) : this._srcObject;
      },
      set(value) {
        const previousValue = this.srcObject;

        // Set the actual srcObject using the original setter
        if (originalDescriptor && originalDescriptor.set) {
          originalDescriptor.set.call(this, value);
        } else {
          this._srcObject = value;
        }

        console.log(`Audio element srcObject changed: ${elementId} from ${previousValue} to ${value}`);

        // Trigger handler when srcObject changes
        if (previousValue !== value) {
          monitor.handleAudioElement(audioElement);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Also set up a mutation observer for other attribute changes (like src)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log(`Audio element attribute changed: ${elementId} ${mutation.attributeName}`);
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          this.handleAudioElement(mutation.target);
        }
      });
    });

    observer.observe(audioElement, {
      attributes: true,
      attributeFilter: ['src']
    });

    this.audioElementObservers.set(elementId, observer);
    console.log(`Set up srcObject observer for audio element: ${audioElement.tagName} ${elementId} ${audioElement.srcObject}`);
  }

  checkForNewAudioElements(element) {
    if (element.tagName === 'AUDIO') {
      this.setupAudioElementObserver(element);
      if (element.srcObject) {
        this.handleAudioElement(element);
      }
    }

    const audioElements = element.querySelectorAll('audio');
    audioElements.forEach(audioEl => {
      this.setupAudioElementObserver(audioEl);
      if (audioEl.srcObject) {
        this.handleAudioElement(audioEl);
      }
    });
  }

  scanExistingAudioElements() {
    const existingAudio = document.querySelectorAll('audio');
    console.log(`Scanning ${existingAudio.length} existing audio elements`);
    existingAudio.forEach(audioEl => {
      this.setupAudioElementObserver(audioEl);
      if (audioEl.srcObject) {
        this.handleAudioElement(audioEl);
      }
    });
  }

  handleAudioElement(audioElement) {
    const elementId = this.getElementId(audioElement);

    if (this.monitoredElements.has(elementId)) {
      console.log(`Audio element ${elementId} already monitored`);
      return;
    }

    console.log(`New audio element with src detected: ${elementId} ${audioElement.srcObject}`);
    this.monitorAudioElement(audioElement, elementId);
  }

  getElementId(element) {
    return element.id || `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  monitorAudioElement(audioElement, elementId) {
    if (!this.audioContext) {
      console.warn("AudioContext not available, cannot monitor audio");
      return;
    }

    try {
      const source = this.audioContext.createMediaStreamSource(audioElement.srcObject);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(analyser);
      analyser.connect(this.audioContext.destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const monitorData = {
        element: audioElement,
        source: source,
        analyser: analyser,
        dataArray: dataArray,
        isPlaying: false,
        lastAudioTime: 0,
        silenceThreshold: 30,
        checkInterval: null
      };

      this.monitoredElements.set(elementId, monitorData);
      this.startAudioAnalysis(elementId, monitorData);
      this.setupAudioEventListeners(audioElement, elementId, monitorData);

      console.log(`Started monitoring audio element: ${elementId}`);
    } catch (error) {
      console.error(`Failed to monitor audio element ${elementId}:`, error);
    }
  }

  startAudioAnalysis(elementId, monitorData) {
    const { analyser, dataArray, silenceThreshold } = monitorData;

    monitorData.checkInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);

      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const hasAudio = average > silenceThreshold;

      if (i++ % 10 == 0) {
        console.log(`Average: ${average} hasAudio: ${hasAudio} elementId: ${elementId}`);
      }

      if (hasAudio && !monitorData.isPlaying) {
        monitorData.isPlaying = true;
        monitorData.lastAudioTime = Date.now();
        this.dispatchAudioEvent('audiostart', elementId, monitorData.element);
        console.log(`Audio started: ${elementId}`);
      } else if (!hasAudio && monitorData.isPlaying) {
        const silenceDuration = Date.now() - monitorData.lastAudioTime;
        if (silenceDuration > 1000) {
          monitorData.isPlaying = false;
          this.dispatchAudioEvent('audiostop', elementId, monitorData.element);
          console.log(`Audio stopped: ${elementId}`);
        }
      } else if (hasAudio) {
        monitorData.lastAudioTime = Date.now();
      }
    }, 100);
  }

  setupAudioEventListeners(audioElement, elementId, monitorData) {
    const events = ['play', 'pause', 'ended', 'loadstart', 'canplay'];

    events.forEach(eventType => {
      audioElement.addEventListener(eventType, (event) => {
        console.log(`Audio element ${elementId} event: ${eventType}`);
        this.dispatchAudioEvent(`element${eventType}`, elementId, audioElement, event);
      });
    });

    audioElement.addEventListener('ended', () => {
      if (monitorData.isPlaying) {
        monitorData.isPlaying = false;
        this.dispatchAudioEvent('audiostop', elementId, audioElement);
      }
    });
  }

  dispatchAudioEvent(eventType, elementId, audioElement, originalEvent = null) {
    const customEvent = new CustomEvent(`audio-monitor-${eventType}`, {
      detail: {
        elementId: elementId,
        audioElement: audioElement,
        timestamp: Date.now(),
        originalEvent: originalEvent
      }
    });

    document.dispatchEvent(customEvent);
    console.log(`Dispatched event: audio-monitor-${eventType} for ${elementId}`);
  }

  stopMonitoring(elementId) {
    const monitorData = this.monitoredElements.get(elementId);
    if (monitorData) {
      if (monitorData.checkInterval) {
        clearInterval(monitorData.checkInterval);
      }
      this.monitoredElements.delete(elementId);
      console.log(`Stopped monitoring audio element: ${elementId}`);
    }
  }

  destroy() {
    this.monitoredElements.forEach((monitorData, elementId) => {
      this.stopMonitoring(elementId);
    });

    if (this.bodyMutationObserver) {
      this.bodyMutationObserver.disconnect();
      this.bodyMutationObserver = null;
    }

    this.audioElementObservers.forEach((observer, elementId) => {
      observer.disconnect();
    });
    this.audioElementObservers.clear();

    if (this.audioContext) {
      this.audioContext.close();
    }

    console.log("AudioElementMonitor destroyed");
  }
}

const audioMonitor = new AudioElementMonitor();

document.addEventListener('audio-monitor-audiostart', (event) => {
  console.log('🔊 Audio playback started:', event.detail);
});

document.addEventListener('audio-monitor-audiostop', (event) => {
  console.log('🔇 Audio playback stopped:', event.detail);
});

window.audioMonitor = audioMonitor;

// Add a visible indicator that this script loaded
console.log("Audio output hooks initialization complete");