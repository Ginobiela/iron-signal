import './gameplay-tuner.css';
import { GameplayConfigStore, parseTuningPreset, DEFAULT_GAMEPLAY_CONFIG, settingValue } from '../config/gameplay';
import type { TuningPreset } from '../config/gameplay';
import { BUILTIN_PRESETS, CUSTOM_PRESETS_KEY, readCustomPresets, restoreTuningSession, saveTuningSession } from './gameplayPresets';
import { TuningControls } from './TuningControls';

export class GameplayTuner {
  private store = new GameplayConfigStore();
  private readonly controls: TuningControls;
  private readonly unsubscribe: () => void;
  private presets: TuningPreset[] = [...BUILTIN_PRESETS];
  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `<header><h1>GAMEPLAY TUNER</h1><a href="./">BACK TO GAME</a></header>
      <p>DEVELOPER MODE · Los defaults permanecen intactos. LIVE: próximo update/evento. RESPAWN: nueva instancia. RESTART: reiniciar nivel.</p>
      <nav><button id="reset-all">RESET ALL</button><button id="export">EXPORT TUNING JSON</button>
      <label class="file-label">IMPORT JSON <input id="import" type="file" accept=".json,application/json"></label>
      <button id="playtest">PLAYTEST LEVEL 1</button><button id="boss-test">PLAYTEST BOSS</button><button id="level2-test">PLAYTEST LEVEL 2</button></nav>
      <p id="dirty" role="status"></p><p id="tuner-error" role="alert"></p>
      <nav><label>Preset <select id="presets"></select></label><button id="load-preset">LOAD PRESET</button>
      <label>Nombre <input id="preset-name" maxlength="80" placeholder="Mi experimento"></label><button id="save-preset">SAVE CUSTOM PRESET</button></nav>
      <nav><label>Search settings <input id="search" type="search" placeholder="gravity, runner, damage…"></label>
      <label><input id="advanced" type="checkbox"> ADVANCED</label><button id="show-changes">SHOW CHANGES</button>
      <button id="copy-config">COPY CONFIG JSON</button></nav>
      <p>GOD MODE modifica el máximo pero no cura instancias existentes. Use HEAL PLAYER o reinicie. SLOW MOTION TEST reduce parámetros; conserva el timestep del motor.</p>
      <pre id="changes" hidden></pre><textarea id="config-output" hidden readonly aria-label="Config JSON para revisar y copiar"></textarea>
      <div id="settings"></div>`;
    try { this.store = restoreTuningSession(); } catch (error) { this.report(`Se ignoró la sesión inválida: ${String(error)}`); }
    try { this.presets.push(...readCustomPresets()); } catch (error) { this.report(`Presets locales inválidos: ${String(error)}`); }
    this.renderPresets();
    this.controls = new TuningControls(this.get('#settings'), this.store, this.report);
    this.unsubscribe = this.store.subscribe(() => { this.refresh(); try { saveTuningSession(this.store); } catch (error) { this.report(String(error)); } });
    this.get('#reset-all').onclick = () => this.attempt(() => this.store.resetAll());
    this.get('#export').onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(this.store.preset(this.name()), null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'gameplay-preset.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    this.get<HTMLInputElement>('#import').onchange = async event => {
      try {
        const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
        if (file.size > 100_000) throw new Error('Preset demasiado grande.');
        const preset = parseTuningPreset(JSON.parse(await file.text())); this.store.replace(preset.overrides);
        this.get<HTMLInputElement>('#preset-name').value = preset.name; this.report('');
      } catch (error) { this.report(String(error)); }
      this.get<HTMLInputElement>('#import').value = '';
    };
    this.get('#load-preset').onclick = () => this.attempt(() => {
      const preset = this.presets[Number(this.get<HTMLSelectElement>('#presets').value)];
      if (preset) this.store.replace(preset.overrides);
    });
    this.get('#save-preset').onclick = () => this.attempt(() => {
      const preset = this.store.preset(this.name());
      const custom = this.presets.slice(BUILTIN_PRESETS.length).filter(item => item.name !== preset.name);
      if (custom.length >= 100) throw new Error('Máximo 100 presets.');
      custom.push(preset); localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(custom));
      this.presets = [...BUILTIN_PRESETS, ...custom]; this.renderPresets();
    });
    const filter = () => this.controls.filter(this.get<HTMLInputElement>('#search').value, this.get<HTMLInputElement>('#advanced').checked);
    this.get('#search').oninput = filter; this.get('#advanced').onchange = filter;
    this.get('#show-changes').onclick = () => { const changes = this.get('#changes'); changes.hidden = !changes.hidden; };
    this.get('#copy-config').onclick = () => {
      const output = this.get<HTMLTextAreaElement>('#config-output'); output.value = JSON.stringify(this.store.get(), null, 2);
      output.hidden = false; output.focus(); output.select();
      void navigator.clipboard?.writeText(output.value).catch(() => this.report('Seleccione y copie el JSON mostrado.'));
    };
    const play = (boss: boolean) => this.attempt(() => {
      saveTuningSession(this.store); location.href = `./?tuning=1${boss ? '&mode=boss' : ''}`;
    });
    this.get('#playtest').onclick = () => play(false); this.get('#boss-test').onclick = () => play(true);
    this.get('#level2-test').onclick = () => this.attempt(() => { saveTuningSession(this.store); location.href = './?tuning=1&level=levels/level-02.json'; });
    this.refresh();
  }
  dispose(): void { this.unsubscribe(); this.controls.dispose(); }
  private get<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }
  private name(): string { return this.get<HTMLInputElement>('#preset-name').value.trim() || 'Custom tuning'; }
  private readonly report = (message: string): void => { this.get('#tuner-error').textContent = message; };
  private attempt(action: () => void): void { try { action(); this.report(''); } catch (error) { this.report(String(error)); } }
  private renderPresets(): void {
    this.get<HTMLSelectElement>('#presets').replaceChildren(...this.presets.map((preset, index) => new Option(preset.name, String(index))));
  }
  private refresh(): void {
    const entries = Object.entries(this.store.getOverrides());
    this.get('#dirty').textContent = `GAMEPLAY CONFIG — ${entries.length ? `${entries.length} OVERRIDES ACTIVE · MODIFIED` : 'DEFAULT'}`;
    this.get('#changes').textContent = entries.map(([path, value]) => `${path}\n${JSON.stringify(settingValue(DEFAULT_GAMEPLAY_CONFIG, path))} → ${JSON.stringify(value)}`).join('\n\n') || 'DEFAULT — sin cambios.';
  }
}
