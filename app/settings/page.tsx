import Script from "next/script";
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
        <div className="section">
          <h2>Game setup</h2>
          <div className="settings-grid">
            <div className="field">
              <label htmlFor="title">Game title</label>
              <input type="text" id="title" />
            </div>
            <div className="field">
              <label htmlFor="numCats">Categories (columns)</label>
              <input type="number" id="numCats" min={1} max={12} />
            </div>
            <div className="field">
              <label htmlFor="numRows">Rows</label>
              <input type="number" id="numRows" min={1} max={10} />
            </div>
          </div>
          <p className="hint">
            Changes save automatically and update the board live. Players join
            with a name — they appear on the board automatically. Each row shares
            one dollar value (set in the strip below).
          </p>
        </div>

        <div className="section">
          <h2>Categories, questions &amp; answers</h2>
          <p className="hint">
            The &quot;question&quot; is what players see on the board. The
            &quot;answer&quot; is shown only on the host screen.
          </p>
          <div className="row-values-strip scroll-pan-x" id="rowValuesStrip" />
          <div className="categories-editor" id="categoriesEditor" />
        </div>
      </div>

      <Script src="/js/settings.js" strategy="afterInteractive" />
    </RoomGuard>
  );
}
