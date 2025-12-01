// Simple sound manager using Web Audio API
// Generates sounds programmatically - no audio files needed!

type MusicTrack = 'world' | 'home' | null;

class SoundManagerClass {
  private audioContext: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  private currentTrack: MusicTrack = null;
  private musicInterval: number | null = null;
  private nextNoteTime: number = 0;
  private currentNoteIndex: number = 0;

  init(): void {
    if (this.audioContext) return;

    try {
      this.audioContext = new AudioContext();

      // Master gain nodes
      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.audioContext.destination);

      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.audioContext.destination);
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  // Resume audio context (needed after user interaction)
  private resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Play a success sound (catching a pet)
  playSuccess(): void {
    if (!this.audioContext || !this.sfxGain || !this.sfxEnabled) return;
    this.resume();

    try {
      const now = this.audioContext.currentTime;

      // Happy arpeggio
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.audioContext!.createOscillator();
        const gain = this.audioContext!.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + i * 0.1;
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch (e) {
      console.warn('Error playing success sound:', e);
    }
  }

  // Play a failure sound
  playFailure(): void {
    if (!this.audioContext || !this.sfxGain || !this.sfxEnabled) return;
    this.resume();

    try {
      const now = this.audioContext.currentTime;

      // Sad descending notes
      [400, 350, 300].forEach((freq, i) => {
        const osc = this.audioContext!.createOscillator();
        const gain = this.audioContext!.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + i * 0.15;
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch (e) {
      console.warn('Error playing failure sound:', e);
    }
  }

  // Play a splash sound
  playSplash(): void {
    if (!this.audioContext || !this.sfxGain || !this.sfxEnabled) return;
    this.resume();

    try {
      const now = this.audioContext.currentTime;

      // White noise burst for splash - longer duration
      const duration = 0.4;
      const bufferSize = Math.floor(this.audioContext.sampleRate * duration);
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      // Create noise with slower decay for more "watery" sound
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
      }

      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter for more "splashy" character
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      // Second filter for high frequency splash detail
      const highFilter = this.audioContext.createBiquadFilter();
      highFilter.type = 'highpass';
      highFilter.frequency.value = 200;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(highFilter);
      highFilter.connect(gain);
      gain.connect(this.sfxGain!);

      noise.start(now);
    } catch (e) {
      console.warn('Error playing splash sound:', e);
    }
  }

  // Play a pet/feed sound
  playPet(): void {
    if (!this.audioContext || !this.sfxGain || !this.sfxEnabled) return;
    this.resume();

    try {
      const now = this.audioContext.currentTime;

      // Cute little chirp
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn('Error playing pet sound:', e);
    }
  }

  // Play footstep sound
  playFootstep(): void {
    if (!this.audioContext || !this.sfxGain || !this.sfxEnabled) return;
    this.resume();

    try {
      const now = this.audioContext.currentTime;

      // Soft thud
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(100 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn('Error playing footstep sound:', e);
    }
  }

  // Play UI click sound
  playClick(): void {
    if (!this.audioContext || !this.sfxGain || !this.sfxEnabled) return;
    this.resume();

    try {
      const now = this.audioContext.currentTime;

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'square';
      osc.frequency.value = 800;

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn('Error playing click sound:', e);
    }
  }

  // Music note frequencies (pentatonic scale for pleasant sound)
  private readonly WORLD_MELODY = [
    // Adventurous, exploring melody in C major pentatonic
    { note: 392.00, duration: 0.4 },  // G4
    { note: 440.00, duration: 0.4 },  // A4
    { note: 523.25, duration: 0.6 },  // C5
    { note: 440.00, duration: 0.3 },  // A4
    { note: 392.00, duration: 0.5 },  // G4
    { note: 329.63, duration: 0.4 },  // E4
    { note: 392.00, duration: 0.6 },  // G4
    { note: 0, duration: 0.4 },       // Rest
    { note: 523.25, duration: 0.3 },  // C5
    { note: 587.33, duration: 0.4 },  // D5
    { note: 523.25, duration: 0.5 },  // C5
    { note: 440.00, duration: 0.4 },  // A4
    { note: 392.00, duration: 0.6 },  // G4
    { note: 329.63, duration: 0.5 },  // E4
    { note: 293.66, duration: 0.6 },  // D4
    { note: 0, duration: 0.6 },       // Rest
  ];

  private readonly HOME_MELODY = [
    // Cozy, peaceful melody
    { note: 261.63, duration: 0.6 },  // C4
    { note: 329.63, duration: 0.5 },  // E4
    { note: 392.00, duration: 0.7 },  // G4
    { note: 329.63, duration: 0.4 },  // E4
    { note: 0, duration: 0.3 },       // Rest
    { note: 293.66, duration: 0.5 },  // D4
    { note: 349.23, duration: 0.6 },  // F4
    { note: 440.00, duration: 0.7 },  // A4
    { note: 392.00, duration: 0.5 },  // G4
    { note: 0, duration: 0.4 },       // Rest
    { note: 329.63, duration: 0.5 },  // E4
    { note: 293.66, duration: 0.5 },  // D4
    { note: 261.63, duration: 0.8 },  // C4
    { note: 0, duration: 0.6 },       // Rest
  ];

  // Start playing background music
  playMusic(track: 'world' | 'home'): void {
    if (!this.audioContext || !this.musicGain) return;

    // Stop current music if playing different track
    if (this.currentTrack === track) return;
    this.stopMusic();

    if (!this.musicEnabled) {
      this.currentTrack = track;
      return;
    }

    this.resume();
    this.currentTrack = track;
    this.currentNoteIndex = 0;
    this.nextNoteTime = this.audioContext.currentTime + 0.1;

    // Schedule notes ahead using an interval
    this.musicInterval = window.setInterval(() => {
      this.scheduleNotes();
    }, 100);
  }

  private scheduleNotes(): void {
    if (!this.audioContext || !this.musicGain || !this.currentTrack) return;

    const melody = this.currentTrack === 'world' ? this.WORLD_MELODY : this.HOME_MELODY;

    // Schedule notes up to 0.3 seconds ahead
    while (this.nextNoteTime < this.audioContext.currentTime + 0.3) {
      const noteData = melody[this.currentNoteIndex];

      if (noteData.note > 0) {
        this.playMusicNote(noteData.note, this.nextNoteTime, noteData.duration * 0.9);
      }

      this.nextNoteTime += noteData.duration;
      this.currentNoteIndex = (this.currentNoteIndex + 1) % melody.length;
    }
  }

  private playMusicNote(frequency: number, startTime: number, duration: number): void {
    if (!this.audioContext || !this.musicGain) return;

    try {
      // Main tone
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = frequency;

      // Soft attack and release
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.setValueAtTime(0.15, startTime + duration - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(startTime);
      osc.stop(startTime + duration);

      // Add a subtle harmony (fifth above, quieter)
      const harmOsc = this.audioContext.createOscillator();
      const harmGain = this.audioContext.createGain();

      harmOsc.type = 'sine';
      harmOsc.frequency.value = frequency * 1.5; // Perfect fifth

      harmGain.gain.setValueAtTime(0.001, startTime);
      harmGain.gain.exponentialRampToValueAtTime(0.05, startTime + 0.05);
      harmGain.gain.setValueAtTime(0.05, startTime + duration - 0.1);
      harmGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      harmOsc.connect(harmGain);
      harmGain.connect(this.musicGain);

      harmOsc.start(startTime);
      harmOsc.stop(startTime + duration);
    } catch (e) {
      // Ignore scheduling errors
    }
  }

  // Stop background music
  stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.currentTrack = null;
    this.currentNoteIndex = 0;
  }

  // Toggle sound effects
  toggleSfx(): boolean {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  // Toggle music
  toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicEnabled ? 0.3 : 0;
    }
    // Restart music if we have a track set and music was just enabled
    if (this.musicEnabled && this.currentTrack && !this.musicInterval) {
      const track = this.currentTrack;
      this.currentTrack = null; // Reset so playMusic will start
      this.playMusic(track);
    }
    return this.musicEnabled;
  }

  isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }
}

export const SoundManager = new SoundManagerClass();
