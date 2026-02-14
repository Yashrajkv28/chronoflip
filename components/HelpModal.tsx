import React, { useEffect } from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="px-4 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
      {title}
    </h3>
    <div className="bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
      {children}
    </div>
  </div>
);

const InfoRow = ({ title, description, border = true }: { title: string; description: string; border?: boolean }) => (
  <div className={`p-4 ${border ? 'border-b border-zinc-200/50 dark:border-white/5' : ''}`}>
    <div className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
    <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</div>
  </div>
);

const ShortcutRow = ({ shortcut, action, border = true }: { shortcut: string; action: string; border?: boolean }) => (
  <div className={`p-4 flex items-center justify-between ${border ? 'border-b border-zinc-200/50 dark:border-white/5' : ''}`}>
    <kbd className="px-2.5 py-1 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 text-[13px] font-mono font-semibold text-zinc-700 dark:text-zinc-200 border border-zinc-300/50 dark:border-zinc-600/50 shadow-sm min-w-[3rem] text-center">
      {shortcut}
    </kbd>
    <span className="text-[14px] text-zinc-600 dark:text-zinc-300 ml-4 text-right flex-1">{action}</span>
  </div>
);

const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh]
                   bg-white/90 dark:bg-[#121212]/90
                   backdrop-blur-2xl
                   border-t sm:border border-white/20 dark:border-white/10
                   rounded-t-[2.5rem] sm:rounded-[2.5rem]
                   shadow-2xl overflow-hidden flex flex-col
                   animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-zinc-200/50 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-xl z-20">
          <div className="w-16" />
          <span className="text-zinc-900 dark:text-white font-semibold text-[17px]">Help</span>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-500 font-bold text-[17px] hover:opacity-70 transition-opacity w-16 text-right"
          >
            Done
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-hide">

          {/* ===== ENGLISH ===== */}

          <Section title="Timer Modes">
            <InfoRow
              title="Countdown"
              description="Counts down from a set duration to zero."
            />
            <InfoRow
              title="Count Up"
              description="Counts up from zero. Optionally set a target time in Settings to complete with an alarm."
            />
            <InfoRow
              title="Hybrid"
              description="Counts down to zero, then automatically switches to counting up. Optionally set a fixed Q&A duration in Settings."
            />
            <InfoRow
              title="Speech Timer"
              description="Create multiple timed segments for presentations. Each segment has its own duration, count mode, color alerts, tick sound, alarm, and flash settings. Segments auto-advance when complete."
              border={false}
            />
          </Section>

          <Section title="Color Alerts">
            <InfoRow
              title="Background"
              description="Persistently changes the screen background color when a time threshold is reached. Stays active until the next alert or timer end."
            />
            <InfoRow
              title="Flash"
              description="Rapidly blinks the screen 3 times in the alert color when triggered. Useful for getting the speaker's attention without looking at the screen."
            />
            <InfoRow
              title="Sound"
              description="Plays an audio beep at the threshold. Alerts at 10 seconds or below play an urgent warning sound."
            />
            <InfoRow
              title="Flash on Completion"
              description="Flashes the screen when a timer or segment finishes. Enable per-segment in Speech Timer settings."
              border={false}
            />
          </Section>

          <Section title="Audio & Haptics">
            <InfoRow
              title="Tick Sound"
              description="Optional mechanical tick that plays each second while the timer runs."
            />
            <InfoRow
              title="Alert Sounds"
              description="Beeps at alert thresholds and a chime on timer completion. Custom alarm sound supported."
            />
            <InfoRow
              title="Vibration"
              description="Haptic feedback on start, pause, alerts, and completion. Works on supported mobile devices."
              border={false}
            />
          </Section>

          <Section title="Keyboard Shortcuts">
            <ShortcutRow shortcut="Space" action="Start / Pause / Resume" />
            <ShortcutRow shortcut="R" action="Reset (hold 1.5s when running)" />
            <ShortcutRow shortcut="S" action="Toggle settings" />
            <ShortcutRow shortcut="F" action="Toggle fullscreen" />
            <ShortcutRow shortcut="B" action="Blackout mode (when running)" />
            <ShortcutRow shortcut="C" action="Cycle modes: Clock → Count Up → Count Down → Hybrid → Speech" />
            <ShortcutRow shortcut="D" action="Toggle dark mode" />
            <ShortcutRow shortcut="W" action="Keep screen on (clock mode)" />
            <ShortcutRow shortcut="Esc" action="Close / Exit fullscreen / Exit blackout" border={false} />
          </Section>

          <Section title="Special Features">
            <InfoRow
              title="Fullscreen"
              description="Distraction-free display. Toggle with F key or the fullscreen button."
            />
            <InfoRow
              title="Blackout Mode"
              description="Screen goes black while the timer runs. Tap or press any key to restore. Saves battery during presentations."
            />
            <InfoRow
              title="Mode Cycling"
              description="Cycle through 5 modes with the top-left button or C key: Clock → Count Up → Count Down → Hybrid → Speech Timer."
            />
            <InfoRow
              title="Delayed Start"
              description="Set a countdown delay before the main timer begins. Configure in Settings."
            />
            <InfoRow
              title="Scheduled Start"
              description="Schedule the timer to start at a specific date and time. Configure in Settings."
            />
            <InfoRow
              title="Keep Screen On"
              description="Prevents the screen from sleeping while the timer runs. Can also be toggled manually with the sun/moon button or W key."
            />
            <InfoRow
              title="Install as App"
              description="Install ChronoFlip as a standalone app from your browser's menu for quick access."
              border={false}
            />
          </Section>

          {/* ===== LANGUAGE DIVIDER ===== */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-zinc-300/50 dark:bg-white/10" />
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              日本語 / Japanese
            </span>
            <div className="flex-1 h-px bg-zinc-300/50 dark:bg-white/10" />
          </div>

          {/* ===== JAPANESE ===== */}

          <Section title="タイマーモード">
            <InfoRow
              title="カウントダウン"
              description="設定した時間からゼロまでカウントダウンします。"
            />
            <InfoRow
              title="カウントアップ"
              description="ゼロからカウントアップします。設定画面で目標時間を設定すると、アラームで完了します。"
            />
            <InfoRow
              title="ハイブリッド"
              description="ゼロまでカウントダウンした後、自動的にカウントアップに切り替わります。設定画面でQ&A時間を固定することもできます。"
            />
            <InfoRow
              title="スピーチタイマー"
              description="プレゼンテーション用に複数のタイムセグメントを作成できます。各セグメントには独自の時間、カウントモード、カラーアラート、チック音、アラーム、フラッシュ設定があります。セグメントは完了時に自動的に次へ進みます。"
              border={false}
            />
          </Section>

          <Section title="カラーアラート">
            <InfoRow
              title="背景色"
              description="時間しきい値に達すると画面の背景色が変わります。次のアラートまたはタイマー終了まで維持されます。"
            />
            <InfoRow
              title="フラッシュ"
              description="アラート発動時に画面がアラート色で3回点滅します。画面を見ずに発表者の注意を引くのに便利です。"
            />
            <InfoRow
              title="サウンド"
              description="しきい値でビープ音を再生します。残り10秒以下のアラートでは緊急警告音が鳴ります。"
            />
            <InfoRow
              title="完了時フラッシュ"
              description="タイマーまたはセグメント終了時に画面がフラッシュします。スピーチタイマーの設定でセグメントごとに有効化できます。"
              border={false}
            />
          </Section>

          <Section title="オーディオ・触覚フィードバック">
            <InfoRow
              title="チック音"
              description="タイマー動作中に毎秒鳴るオプションの機械的なチック音。"
            />
            <InfoRow
              title="アラート音"
              description="アラートしきい値でのビープ音とタイマー完了時のチャイム。カスタムアラーム音にも対応。"
            />
            <InfoRow
              title="バイブレーション"
              description="開始、一時停止、アラート、完了時の触覚フィードバック。対応モバイルデバイスで動作します。"
              border={false}
            />
          </Section>

          <Section title="キーボードショートカット">
            <ShortcutRow shortcut="Space" action="開始 / 一時停止 / 再開" />
            <ShortcutRow shortcut="R" action="リセット（実行中は1.5秒長押し）" />
            <ShortcutRow shortcut="S" action="設定の切り替え" />
            <ShortcutRow shortcut="F" action="フルスクリーン切り替え" />
            <ShortcutRow shortcut="B" action="ブラックアウトモード（実行中のみ）" />
            <ShortcutRow shortcut="C" action="モード切替: 時計 → カウントアップ → カウントダウン → ハイブリッド → スピーチ" />
            <ShortcutRow shortcut="D" action="ダークモード切り替え" />
            <ShortcutRow shortcut="W" action="画面オン維持（時計モード）" />
            <ShortcutRow shortcut="Esc" action="閉じる / フルスクリーン解除 / ブラックアウト解除" border={false} />
          </Section>

          <Section title="特別な機能">
            <InfoRow
              title="フルスクリーン"
              description="集中できるディスプレイ。Fキーまたはボタンで切り替えます。"
            />
            <InfoRow
              title="ブラックアウトモード"
              description="タイマー動作中に画面が黒くなります。タップまたは任意のキーで復元。プレゼンテーション中のバッテリー節約に便利です。"
            />
            <InfoRow
              title="モード切替"
              description="左上のボタンまたはCキーで5つのモードを切り替えます: 時計 → カウントアップ → カウントダウン → ハイブリッド → スピーチタイマー"
            />
            <InfoRow
              title="遅延開始"
              description="メインタイマー開始前のカウントダウン遅延を設定できます。設定画面で構成してください。"
            />
            <InfoRow
              title="予約開始"
              description="特定の日時にタイマーを開始するようスケジュールできます。設定画面で構成してください。"
            />
            <InfoRow
              title="画面オン維持"
              description="タイマー動作中に画面がスリープしないようにします。太陽/月ボタンまたはWキーで手動切り替えも可能です。"
            />
            <InfoRow
              title="アプリとしてインストール"
              description="ブラウザのメニューからChronoFlipをスタンドアロンアプリとしてインストールできます。"
              border={false}
            />
          </Section>

        </div>
      </div>
    </div>
  );
};

export default HelpModal;
