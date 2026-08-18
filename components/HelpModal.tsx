import React, { useEffect } from 'react';

interface HelpModalProps {
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="px-4 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
      {title}
    </h3>
    <div className="bg-bg-secondary border border-border-soft rounded-2xl overflow-hidden shadow-hard-sm">
      {children}
    </div>
  </div>
);

const InfoRow = ({ title, description, border = true }: { title: string; description: string; border?: boolean }) => (
  <div className={`p-4 ${border ? 'border-b border-border-soft' : ''}`}>
    <div className="text-[15px] font-medium text-text-primary">{title}</div>
    <div className="text-[13px] text-text-secondary mt-0.5">{description}</div>
  </div>
);

const ShortcutRow = ({ shortcut, action, border = true }: { shortcut: string; action: string; border?: boolean }) => (
  <div className={`p-4 flex items-center justify-between ${border ? 'border-b border-border-soft' : ''}`}>
    <kbd className="px-2.5 py-1 rounded-lg bg-bg-secondary text-[13px] font-mono font-semibold text-text-primary border border-border-soft shadow-hard-sm min-w-[3rem] text-center">
      {shortcut}
    </kbd>
    <span className="text-[14px] text-text-secondary ml-4 text-right flex-1">{action}</span>
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-text-primary/30"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh]
                   bg-bg-primary
                   border-t sm:border border-border-soft
                   rounded-t-[2.5rem] sm:rounded-[2.5rem]
                   shadow-hard-lg overflow-hidden flex flex-col
                   animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-border-soft bg-bg-primary z-20">
          <div className="w-16" />
          <span className="text-text-primary font-semibold text-[17px]">Help</span>
          <button
            type="button"
            onClick={onClose}
            className="text-accent-blue font-bold text-[17px] hover:opacity-70 transition-opacity w-16 text-right"
          >
            Done
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 no-scrollbar">

          {/* ===== ENGLISH ===== */}

          <Section title="Speech Timer">
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
              description="Flashes the screen when a timer or segment finishes. Enable per-segment in segment settings."
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
            <ShortcutRow shortcut="R" action="Restart from segment 1 (hold 1.5s)" />
            <ShortcutRow shortcut="E" action="Exit to edit screen (hold 3s)" />
            <ShortcutRow shortcut="[ / P" action="Previous group (group mode)" />
            <ShortcutRow shortcut="] / N" action="Next group (group mode)" />
            <ShortcutRow shortcut="F" action="Toggle fullscreen" />
            <ShortcutRow shortcut="B" action="Blackout mode (when running)" />
            <ShortcutRow shortcut="Esc" action="Dismiss flash / Exit blackout / Exit fullscreen" border={false} />
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
              title="Scheduled Start"
              description="Schedule the timer to start at a specific date and time. Configure in event settings."
            />
            <InfoRow
              title="Install as App"
              description="Install ChronoFlip as a standalone app from your browser's menu for quick access."
              border={false}
            />
          </Section>

          {/* ===== LANGUAGE DIVIDER ===== */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-border-soft" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">
              日本語 / Japanese
            </span>
            <div className="flex-1 h-px bg-border-soft" />
          </div>

          {/* ===== JAPANESE ===== */}

          <Section title="スピーチタイマー">
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
              description="タイマーまたはセグメント終了時に画面がフラッシュします。セグメント設定でセグメントごとに有効化できます。"
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
            <ShortcutRow shortcut="R" action="最初のセグメントに戻る（1.5秒長押し）" />
            <ShortcutRow shortcut="E" action="編集画面に戻る（3秒長押し）" />
            <ShortcutRow shortcut="[ / P" action="前のグループ（グループモード）" />
            <ShortcutRow shortcut="] / N" action="次のグループ（グループモード）" />
            <ShortcutRow shortcut="F" action="フルスクリーン切り替え" />
            <ShortcutRow shortcut="B" action="ブラックアウトモード（実行中のみ）" />
            <ShortcutRow shortcut="Esc" action="フラッシュ解除 / ブラックアウト解除 / フルスクリーン解除" border={false} />
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
              title="予約開始"
              description="特定の日時にタイマーを開始するようスケジュールできます。イベント設定画面で構成してください。"
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
