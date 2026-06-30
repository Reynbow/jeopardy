import Script from "next/script";
import { BlobUpload } from "@/components/BlobUpload";
import { RoomGuard } from "@/components/RoomGuard";

export default function SettingsPage() {
  return (
    <RoomGuard role="host" redirect="/">
      <div className="topbar">
        <h1>SETTINGS</h1>
        <nav className="nav">
          <a href="/play">Board</a>
          <a href="/host">Host</a>
          <a href="/settings" className="active">
            Settings
          </a>
          <span className="save-indicator" id="saveIndicator">
            Saved ✓
          </span>
        </nav>
      </div>

      <div className="settings-wrap">
        <div className="section settings-setup">
          <h2>Game setup</h2>
          <div className="settings-setup-top">
            <div className="settings-setup-fields">
              <div className="field field-title">
                <label htmlFor="title">Game title</label>
                <input type="text" id="title" />
              </div>
              <div className="field field-compact">
                <label htmlFor="numCats">Categories</label>
                <input type="number" id="numCats" min={1} max={12} />
              </div>
              <div className="field field-compact">
                <label htmlFor="numRows">Rows</label>
                <input type="number" id="numRows" min={1} max={10} />
              </div>
              <div className="field field-checkbox">
                <label className="checkbox-label" htmlFor="goldenBuzzer">
                  <input type="checkbox" id="goldenBuzzer" />
                  Golden buzzer
                </label>
                <span className="field-hint">
                  One per player — 2× on the clue they golden-buzz
                </span>
              </div>
            </div>
            <div className="row-values-strip" id="rowValuesStrip" />
            <div className="settings-setup-actions">
              <button className="btn danger" id="clearAllCluesBtn" type="button">
                Clear all clues
              </button>
            </div>
          </div>
          <p className="hint">
            Changes save automatically. Click a tile to edit its clue — switch
            between text, image, or audio for each question. Audio clues accept uploaded files or YouTube links (audio only during play). Answers are host-only.
          </p>
        </div>

        <div className="section settings-board-section">
          <h2>Board editor</h2>
          <div className="settings-board-scroll">
            <div className="settings-board" id="categoriesEditor" />
          </div>
        </div>
      </div>

      <BlobUpload />
      <Script src="/js/settings.js" strategy="afterInteractive" />
    </RoomGuard>
  );
}
