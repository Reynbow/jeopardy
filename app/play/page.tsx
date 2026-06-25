import Script from "next/script";
import { RoomGuard } from "@/components/RoomGuard";

export default function PlayPage() {
  return (
    <RoomGuard role="player" redirect="/" allowHostView>
      <div className="board-wrap">
        <div className="board" id="board" />
      </div>
      <div className="play-bottom" id="playBottom">
        <div className="contestants" id="contestants" />
        <div className="buzzer-dock" id="buzzerDock" />
      </div>
      <div className="overlay" id="overlay">
        <div className="clue-card" id="clueCard">
          <div className="clue-meta" id="clueMeta" />
          <div className="clue-text" id="clueText" />
          <div className="clue-answer" id="clueAnswer" style={{ display: "none" }} />
          <div className="audio-countdown" id="audioCountdown" aria-live="polite" />
        </div>
      </div>
      <Script src="/js/board.js" strategy="afterInteractive" />
    </RoomGuard>
  );
}
