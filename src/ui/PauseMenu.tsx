/** Pause menu — settings (audio, quality, accessibility, controls) + quit. */
import { useGameStore, useSaveStore, type Quality } from '../state/store';
import { audio } from '../audio/audio';

export default function PauseMenu({ onQuitToTitle }: { onQuitToTitle: () => void }) {
  const settings = useSaveStore((s) => s.settings);
  const updateSettings = useSaveStore((s) => s.updateSettings);

  const resume = () => {
    useGameStore.getState().setMode('riding');
    useGameStore.getState().setPhysicsPaused(false);
  };

  return (
    <div className="overlay">
      <div className="sheet pause">
        <header className="sheet-head">
          <h2>Paused</h2>
          <p className="dim">The desert waits. It has nothing but time.</p>
        </header>
        <div className="pause-actions">
          <button className="btn primary" onClick={resume}>Resume <kbd>Esc</kbd></button>
          <button className="btn" onClick={onQuitToTitle}>Quit to title</button>
        </div>
        <section className="settings">
          <h3>Settings</h3>
          <label className="setting">
            <span>Volume</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={settings.volume}
              onChange={(e) => { const v = Number(e.target.value); updateSettings({ volume: v, muted: v === 0 ? settings.muted : false }); audio.setVolume(v); }}
            />
          </label>
          <label className="setting">
            <span>Mute</span>
            <input type="checkbox" checked={settings.muted} onChange={(e) => updateSettings({ muted: e.target.checked })} />
          </label>
          <label className="setting">
            <span>Quality</span>
            <select value={settings.quality} onChange={(e) => updateSettings({ quality: e.target.value as Quality })}>
              <option value="low">Low — battery saver</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="setting">
            <span>Reduced camera shake</span>
            <input type="checkbox" checked={settings.reducedShake} onChange={(e) => updateSettings({ reducedShake: e.target.checked })} />
          </label>
          <label className="setting">
            <span>Invert flight pitch</span>
            <input type="checkbox" checked={settings.invertY} onChange={(e) => updateSettings({ invertY: e.target.checked })} />
          </label>
          <p className="dim settings-note">Subtitles are always on. Waypoint markers use shape + colour, never colour alone.</p>
        </section>
        <section className="settings">
          <h3>Controls</h3>
          <ul className="controls-list">
            <li><kbd>W A S D</kbd> / arrows — ride</li>
            <li><kbd>Shift</kbd> — boost</li>
            <li><kbd>Space</kbd> — hop</li>
            <li><kbd>S</kbd> + steer — drift (release for boost)</li>
            <li><kbd>E</kbd> — interact / advance dialogue</li>
            <li><kbd>Esc</kbd> — pause · gamepad supported</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
