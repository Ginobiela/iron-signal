import { DEFAULT_GAMEPLAY_CONFIG, GAMEPLAY_SETTINGS, settingValue } from '../config/gameplay';
import type { GameplayConfigStore, Setting } from '../config/gameplay';

export class TuningControls {
  private readonly rows: { setting: Setting; row: HTMLElement; input: HTMLInputElement; current: HTMLElement }[] = [];
  private readonly unsubscribe: () => void;
  private search = '';
  private advanced = false;
  constructor(private readonly root: HTMLElement, private readonly store: GameplayConfigStore,
    private readonly report: (message: string) => void, paths?: readonly string[]) {
    const available = GAMEPLAY_SETTINGS.filter(setting => !paths || paths.includes(setting.path));
    for (const category of new Set(available.map(setting => setting.category))) {
      const section = document.createElement('section'), heading = document.createElement('h2');
      heading.textContent = category;
      const reset = document.createElement('button'); reset.textContent = 'RESET SECTION';
      reset.addEventListener('click', () => this.attempt(() => store.resetSection(category)));
      heading.append(' ', reset); section.append(heading); root.append(section);
      for (const setting of available.filter(item => item.category === category)) {
        const row = document.createElement('div'); row.className = 'tuning-row'; row.dataset.path = setting.path;
        const label = document.createElement('label'), input = document.createElement('input');
        const info = document.createElement('small'), current = document.createElement('span');
        input.id = `tuning-${setting.path}`; label.htmlFor = input.id;
        label.textContent = setting.label; label.title = setting.description;
        input.type = setting.array ? 'text' : 'number';
        if (!setting.array) { input.min = String(setting.min); input.max = String(setting.max); input.step = String(setting.step); }
        input.title = `${setting.description} (${setting.min}…${setting.max})`;
        input.addEventListener('change', () => this.attempt(() => {
          if (!input.value.trim()) throw new Error(`${setting.path}: ingrese un valor.`);
          const value = setting.array ? input.value.split(',').map(part => {
            if (!part.trim()) throw new Error('Ángulo vacío.'); return Number(part);
          }) : Number(input.value);
          store.setOverride(setting.path, value);
        }));
        const resetProperty = document.createElement('button'); resetProperty.textContent = 'RESET';
        resetProperty.addEventListener('click', () => this.attempt(() => store.resetOverride(setting.path)));
        info.textContent = `DEFAULT ${JSON.stringify(settingValue(DEFAULT_GAMEPLAY_CONFIG, setting.path))} · ${setting.applyMode}`;
        info.title = setting.description;
        row.append(label, input, resetProperty, info, current); section.append(row);
        this.rows.push({ setting, row, input, current });
      }
    }
    this.unsubscribe = store.subscribe(() => this.refresh()); this.refresh();
  }
  filter(search: string, advanced: boolean): void { this.search = search.toLowerCase(); this.advanced = advanced; this.refresh(); }
  dispose(): void { this.unsubscribe(); this.root.replaceChildren(); }
  private attempt(action: () => void): void {
    try { action(); this.report(''); } catch (error) { this.report(String(error)); }
    this.refresh();
  }
  private refresh(): void {
    for (const { setting, row, input, current } of this.rows) {
      const value = settingValue(this.store.get(), setting.path);
      input.value = Array.isArray(value) ? value.join(', ') : String(value);
      const modified = Object.hasOwn(this.store.getOverrides(), setting.path);
      row.classList.toggle('modified', modified);
      current.textContent = `CURRENT ${JSON.stringify(value)}${modified ? ' · MODIFIED' : ''}`;
      row.hidden = (!this.advanced && setting.advanced && !this.search) || !`${setting.path} ${setting.label} ${setting.description}`.toLowerCase().includes(this.search);
    }
    for (const section of this.root.querySelectorAll('section')) section.hidden = ![...section.querySelectorAll<HTMLElement>('.tuning-row')].some(row => !row.hidden);
  }
}
