// MediaRecorder Stream Buffer Logic for Canvas + Web Audio Stream Capture
// Generates seamless 60 FPS WebM video buffers for Puppeteer headless runner.

export class StreamRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.videoBlob = null;
    this.base64Result = null;
  }

  start(canvas, audioTrack = null) {
    this.recordedChunks = [];
    this.videoBlob = null;
    this.base64Result = null;

    // Capture 60 FPS canvas stream
    const videoStream = canvas.captureStream(60);

    // Merge audio track if available
    const tracks = [...videoStream.getVideoTracks()];
    if (audioTrack) {
      tracks.push(audioTrack);
    }

    this.stream = new MediaStream(tracks);

    // Select optimal mime type
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm'
    ];

    let selectedMime = '';
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    const options = {
      mimeType: selectedMime || undefined,
      videoBitsPerSecond: 1800000, // 1.8 Mbps crisp 720p 60fps (~14 MB, guaranteed fast Telegram dispatch)
      audioBitsPerSecond: 128000   // 128 kbps audio
    };

    console.log('[StreamRecorder] Audio tracks:', tracks.filter(t => t.kind === 'audio').length, '| Video tracks:', tracks.filter(t => t.kind === 'video').length);

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      console.warn('Fallback to default MediaRecorder options:', e);
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.videoBlob = new Blob(this.recordedChunks, { type: selectedMime || 'video/webm' });
      this._convertBlobToBase64(this.videoBlob);
    };

    this.mediaRecorder.start(200); // 200ms slice interval
    this.isRecording = true;
    console.log('[StreamRecorder] Recording started with MIME:', selectedMime);
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.addEventListener('stop', () => {
        this.isRecording = false;
        // Wait for base64 conversion if needed
        const checkBase64 = () => {
          if (this.base64Result) {
            resolve({ blob: this.videoBlob, base64: this.base64Result });
          } else {
            setTimeout(checkBase64, 50);
          }
        };
        checkBase64();
      }, { once: true });

      this.mediaRecorder.stop();
    });
  }

  _convertBlobToBase64(blob) {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.base64Result = reader.result;
      window.RECORDING_COMPLETED = true;
      window.RECORDING_BASE64 = this.base64Result;
      console.log('[StreamRecorder] Recording finalized, size:', blob.size, 'bytes');
    };
    reader.readAsDataURL(blob);
  }
}

export const recorder = new StreamRecorder();
