/**
 * Audio Service for ChronoFlip
 *
 * Handles all audio playback for the timer application.
 * Uses Web Audio API for synthesized sounds by default.
 * Designed to easily support custom audio files in the future.
 */

export type SoundType = 'tick' | 'alert' | 'warning' | 'finish' | 'start' | 'pause';

export interface AudioServiceConfig {
  volume: number; // 0 to 1
  enabled: boolean;
  vibrationEnabled: boolean;
}

// Vibration patterns (in milliseconds) for different sound types
const VIBRATION_PATTERNS: Record<SoundType, number[]> = {
  tick: [10],                         // Short pulse
  alert: [100, 50, 100],              // Double pulse
  warning: [150, 75, 150, 75, 150],   // Triple urgent pulse
  finish: [300, 100, 300, 100, 500],  // Long completion pattern
  start: [50, 30, 80],                // Rising pattern
  pause: [80, 30, 50],                // Descending pattern
};

class AudioService {
  private context: AudioContext | null = null;
  private volume: number = 0.5;
  private enabled: boolean = true;
  private vibrationEnabled: boolean = true;
  private customAudioCache: Map<string, AudioBuffer> = new Map();
  private currentAudio: HTMLAudioElement | null = null;
  private tickAudio: HTMLAudioElement | null = null;
  private alarmAudio: HTMLAudioElement | null = null;

  constructor() {
    // AudioContext is created lazily on first use (browser autoplay policy)
    // Preload alarm sound so it plays instantly
    this.preloadAlarm();
  }

  /**
   * Preload the alarm audio element for instant playback
   */
  private preloadAlarm(): void {
    try {
      this.alarmAudio = new Audio('/sounds/my-alarm.mp3');
      this.alarmAudio.preload = 'auto';
      // Force the browser to start loading
      this.alarmAudio.load();
    } catch (e) {
      console.warn('Alarm preload failed:', e);
    }
  }

  /**
   * Stop any currently playing custom audio
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      // Don't null alarmAudio — we reuse it
      if (this.currentAudio !== this.alarmAudio) {
        this.currentAudio = null;
      } else {
        this.currentAudio = null;
      }
    }
    if (this.tickAudio) {
      this.tickAudio.pause();
      this.tickAudio.currentTime = 0;
    }
    // Also stop vibration
    if (this.isVibrationSupported()) {
      navigator.vibrate(0);
    }
  }

  /**
   * Check if vibration API is supported
   */
  isVibrationSupported(): boolean {
    return 'vibrate' in navigator;
  }

  /**
   * Enable or disable vibration
   */
  setVibrationEnabled(enabled: boolean): void {
    this.vibrationEnabled = enabled;
  }

  /**
   * Check if vibration is enabled
   */
  isVibrationEnabled(): boolean {
    return this.vibrationEnabled && this.isVibrationSupported();
  }

  /**
   * Trigger vibration pattern for a sound type
   */
  vibrate(type: SoundType): void {
    if (!this.vibrationEnabled || !this.isVibrationSupported()) return;

    try {
      const pattern = VIBRATION_PATTERNS[type];
      navigator.vibrate(pattern);
    } catch (e) {
      // Vibration may fail silently on some devices
    }
  }

  /**
   * Initialize or resume the audio context
   * Must be called from a user interaction (click, etc.)
   */
  private async getContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context;
  }

  /**
   * Set the master volume (0 to 1)
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Enable or disable all sounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if audio is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Play a sound by type (with optional vibration)
   */
  async play(type: SoundType, includeVibration: boolean = true): Promise<void> {
    // Trigger vibration (works even if audio is disabled)
    if (includeVibration) {
      this.vibrate(type);
    }

    if (!this.enabled || this.volume === 0) return;

    try {
      const ctx = await this.getContext();

      switch (type) {
        case 'tick':
          await this.playTick(ctx);
          break;
        case 'alert':
          await this.playAlert(ctx);
          break;
        case 'warning':
          await this.playWarning(ctx);
          break;
        case 'finish':
          await this.playFinish(ctx);
          break;
        case 'start':
          await this.playStart(ctx);
          break;
        case 'pause':
          await this.playPause(ctx);
          break;
      }
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }

  /**
   * Tick sound - plays custom tick.mp3 (first 200ms only)
   */
  private async playTick(ctx: AudioContext): Promise<void> {
    try {
      // Create the tick audio element once and reuse it
      if (!this.tickAudio) {
        this.tickAudio = new Audio('/sounds/tick.mp3');
      }

      this.tickAudio.currentTime = 0;
      this.tickAudio.volume = this.volume;
      await this.tickAudio.play();

      // Stop after 200ms (extract just the first tick from the file)
      setTimeout(() => {
        if (this.tickAudio) {
          this.tickAudio.pause();
          this.tickAudio.currentTime = 0;
        }
      }, 200);
    } catch (e) {
      // Fallback to synthesized tick sound
      console.warn('Custom tick sound failed, using synthesized sound:', e);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 800;

      gain.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  }

  /**
   * Alert sound - attention-getting beep
   */
  private async playAlert(ctx: AudioContext): Promise<void> {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 880; // A5

    gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  /**
   * Warning sound - urgent double beep
   */
  private async playWarning(ctx: AudioContext): Promise<void> {
    const playBeep = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + 0.1);

      gain.gain.setValueAtTime(this.volume * 0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    };

    playBeep(ctx.currentTime, 880);
    playBeep(ctx.currentTime + 0.15, 880);
  }

  /**
   * Finish sound - triumphant completion chime
   * This is the main "alarm" sound when timer completes
   */
  private async playFinish(ctx: AudioContext): Promise<void> {
    // Musical progression: C5 -> E5 -> G5 -> C6 (major chord arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = 0.2;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime + (i * noteDuration);

      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.3);
    });
  }

  /**
   * Start sound - subtle confirmation
   */
  private async playStart(ctx: AudioContext): Promise<void> {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  /**
   * Pause sound - descending tone
   */
  private async playPause(ctx: AudioContext): Promise<void> {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  /**
   * Play a custom audio file
   * @param url URL to the audio file
   */
  async playCustom(url: string): Promise<void> {
    if (!this.enabled || this.volume === 0) return;

    // Stop any currently playing custom audio first
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Reuse preloaded alarm element if it matches the URL
    if (this.alarmAudio && url === '/sounds/my-alarm.mp3') {
      try {
        this.alarmAudio.currentTime = 0;
        this.alarmAudio.volume = this.volume;
        this.currentAudio = this.alarmAudio;
        await this.alarmAudio.play();
        return;
      } catch (e) {
        console.warn('Preloaded alarm playback failed, trying fresh element:', e);
      }
    }

    // Fallback: create a new Audio element
    try {
      const audio = new Audio(url);
      audio.volume = this.volume;
      this.currentAudio = audio;

      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };

      await audio.play();
    } catch (e) {
      console.warn('Custom audio playback failed:', e);
      throw e; // Let caller's .catch() handle fallback
    }
  }

  /**
   * Preload a custom audio file for faster playback
   */
  async preload(url: string): Promise<void> {
    try {
      const ctx = await this.getContext();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.customAudioCache.set(url, buffer);
    } catch (e) {
      console.warn('Audio preload failed:', e);
    }
  }

  /**
   * Clear the audio cache
   */
  clearCache(): void {
    this.customAudioCache.clear();
  }
}

// Export singleton instance
export const audioService = new AudioService();

// Also export the class for testing or multiple instances
export { AudioService };
