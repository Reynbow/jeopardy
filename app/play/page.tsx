import Script from "next/script";
import { RoomGuard } from "@/components/RoomGuard";

export default function PlayPage() {
  return (
    <RoomGuard role="player" redirect="/" allowHostView>
      <div className="play-layout">
        <div className="board-wrap">
          <div className="board" id="board" />
        </div>
        <div className="play-bottom" id="playBottom">
          <div className="audio-player-bar" id="audioPlayerBar" style={{ display: "none" }}>
            <label className="audio-volume-label" htmlFor="audioVolume">
              Volume
            </label>
            <input
              type="range"
              id="audioVolume"
              className="audio-volume-slider"
              min={0}
              max={100}
              defaultValue={100}
            />
          </div>
          <div className="contestants" id="contestants" />
          <div className="buzzer-dock" id="buzzerDock" />
        </div>
      </div>
      <div className="overlay" id="overlay">
        <div className="overlay-clue-stack">
          <div className="audio-countdown-block" id="audioCountdownBlock">
            <p className="audio-countdown-label">Audio starts in</p>
            <div className="audio-countdown" id="audioCountdown" aria-live="polite" />
          </div>
          <div className="clue-card" id="clueCard">
            <div className="clue-meta" id="clueMeta" />
            <div className="clue-text" id="clueText" />
            <div className="clue-answer" id="clueAnswer" style={{ display: "none" }} />
          </div>
        </div>
      </div>
      <Script src="/js/board.js" strategy="afterInteractive" />
    </RoomGuard>
  );
}
