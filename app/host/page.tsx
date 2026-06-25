import Script from "next/script";
import { RoomGuard } from "@/components/RoomGuard";

export default function HostPage() {
  return (
    <RoomGuard role="host" redirect="/">
      <div className="topbar">
        <h1>
          HOST CONTROL{" "}
          <span className="room-badge" id="roomBadge" />
        </h1>
        <nav className="nav">
          <a href="/play">Board</a>
          <a href="/host" className="active">
            Host
          </a>
          <a href="/settings">Settings</a>
        </nav>
      </div>

      <div className="host-layout">
        <div className="panel">
          <h2>Board (click a tile to reveal)</h2>
          <div className="board compact" id="board" />
          <div className="host-actions">
            <button className="btn" id="closeBtn">
              Close current clue
            </button>
            <button className="btn gold" id="showQuestionBtn" style={{ display: "none" }} disabled>
              Show question to players
            </button>
            <button className="btn gold" id="showAnswerBtn" style={{ display: "none" }} disabled>
              Show answer to players
            </button>
            <button className="btn danger" id="resetGameBtn">
              Reset board
            </button>
          </div>
          <div className="share-box" id="shareBox">
            <p className="hint">Share this link so players can join:</p>
            <div className="share-row">
              <input type="text" id="shareLink" readOnly className="share-input" />
              <button className="btn small" id="copyLinkBtn">
                Copy
              </button>
            </div>
            <p className="hint">
              Or tell them room code:{" "}
              <strong id="shareCode" className="room-code-display" />
            </p>
          </div>
        </div>

        <div>
          <div className="panel">
            <h2>Current clue &amp; answer</h2>
            <div className="answer-box" id="answerBox">
              <div className="ab-empty">
                No clue selected. Click a tile on the board (here or on the
                main screen).
              </div>
            </div>
            <div className="buzz-panel" id="buzzPanel" style={{ display: "none" }} />
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h2>Players &amp; scores</h2>
            <div id="scores" />
            <div className="host-actions">
              <button className="btn danger" id="resetScoresBtn">
                Reset scores
              </button>
              <button className="btn danger" id="newGameBtn">
                New game (reset all)
              </button>
            </div>
          </div>
        </div>
      </div>

      <Script src="/js/host.js" strategy="afterInteractive" />
    </RoomGuard>
  );
}
