import { describe, expect, it } from 'vitest';
import { InputManager } from '../src/core/InputManager';

function setup() {
  const pad = { id: 'Xbox test', connected: true, mapping: 'standard', axes: [0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) };
  let pads = [null, pad] as unknown as (Gamepad | null)[];
  const document = { hidden: false };
  const target = Object.assign(new EventTarget(), { navigator: { getGamepads: () => pads }, document });
  const input = new InputManager(target as unknown as Window);
  return { input, pad, target, document, setPads: (next: (Gamepad | null)[]) => { pads = next; } };
}

describe('standard gamepad input', () => {
  it('maps K and LT to held aim lock, independently of RT fire, and releases on blur/disconnect', () => {
    const {input,pad,target,setPads}=setup();
    const key = new Event('keydown',{cancelable:true}); Object.assign(key,{code:'KeyK',repeat:false});
    target.dispatchEvent(key); expect(input.isDown('aimLock')).toBe(true); expect(input.isDown('shoot')).toBe(false);
    const up = new Event('keyup',{cancelable:true}); Object.assign(up,{code:'KeyK'}); target.dispatchEvent(up);
    expect(input.isDown('aimLock')).toBe(false);
    pad.buttons[6]!.value=.4; input.pollGamepads(); expect(input.isDown('aimLock')).toBe(false);
    pad.buttons[6]!.value=.8; input.pollGamepads(); expect(input.isDown('aimLock')).toBe(true);
    expect(input.isDown('shoot')).toBe(false);
    pad.buttons[7]!.value=.8; input.pollGamepads(); expect(input.isDown('shoot')).toBe(true);
    setPads([]); input.pollGamepads(); expect(input.isDown('aimLock')).toBe(false);
    setPads([pad as unknown as Gamepad]); input.pollGamepads(); target.dispatchEvent(new Event('blur'));
    expect(input.isDown('aimLock')).toBe(false); input.dispose();
  });
  it('maps stick diagonals and D-pad to existing aim/movement actions with a deadzone', () => {
    const { input, pad } = setup();
    pad.axes = [0.2, -0.2]; input.pollGamepads();
    expect(input.isDown('right')).toBe(false); expect(input.isDown('up')).toBe(false);
    pad.axes = [0.8, -0.8]; input.pollGamepads();
    expect(input.isDown('right')).toBe(true); expect(input.isDown('up')).toBe(true);
    pad.axes = [-0.8, 0.8]; input.pollGamepads();
    expect(input.isDown('left')).toBe(true); expect(input.isDown('down')).toBe(true);
    expect(input.isDown('right')).toBe(false); expect(input.isDown('up')).toBe(false);
    pad.axes = [0, 0]; pad.buttons[12]!.pressed = true; pad.buttons[15]!.pressed = true; input.pollGamepads();
    expect(input.isDown('right')).toBe(true); expect(input.isDown('up')).toBe(true);
    input.dispose();
  });

  it('maps A, X, RT and Menu and consumes jump/pause edges only once per physical press', () => {
    const { input, pad } = setup();
    for (const index of [0, 2, 9]) pad.buttons[index]!.pressed = true;
    input.pollGamepads();
    for (const action of ['jump','shoot','pause'] as const) expect(input.wasPressed(action)).toBe(true);
    input.endStep(); input.pollGamepads();
    expect(input.wasPressed('jump')).toBe(false); expect(input.wasPressed('pause')).toBe(false);
    input.clear(); input.pollGamepads();
    expect(input.isDown('jump')).toBe(true); expect(input.wasPressed('jump')).toBe(false);
    expect(input.wasPressed('pause')).toBe(false);
    pad.buttons[0]!.pressed = false; pad.buttons[9]!.pressed = false; pad.buttons[2]!.pressed = false;
    pad.buttons[7]!.value = 0.4; input.pollGamepads(); expect(input.isDown('shoot')).toBe(false);
    pad.buttons[7]!.value = 0.8; input.pollGamepads(); expect(input.isDown('shoot')).toBe(true);
    pad.buttons[0]!.pressed = true; input.pollGamepads(); expect(input.wasPressed('jump')).toBe(true);
    input.dispose();
  });

  it('releases disconnected controls without releasing keyboard or touch actions', () => {
    const { input, pad, target, setPads } = setup();
    const key = new Event('keydown', { cancelable: true }); Object.assign(key, { code: 'KeyD', repeat: false });
    target.dispatchEvent(key); input.setTouchAction('up', true);
    pad.buttons[15]!.pressed = true; pad.buttons[2]!.pressed = true; input.pollGamepads();
    input.endStep(); setPads([]); input.pollGamepads();
    expect(input.isDown('shoot')).toBe(false); expect(input.isDown('right')).toBe(true); expect(input.isDown('up')).toBe(true);
    expect(input.gamepadWasPressed('right')).toBe(false);
    input.dispose();
  });

  it('ignores inputs while blurred or hidden and does not repeat held pause on refocus', () => {
    const { input, pad, target, document } = setup();
    pad.buttons[9]!.pressed = true; input.pollGamepads(); input.endStep();
    target.dispatchEvent(new Event('blur')); input.pollGamepads(); expect(input.isDown('pause')).toBe(false);
    target.dispatchEvent(new Event('focus')); input.pollGamepads();
    expect(input.isDown('pause')).toBe(true); expect(input.wasPressed('pause')).toBe(false);
    document.hidden = true; input.clear(); pad.buttons[0]!.pressed = true; input.pollGamepads();
    expect(input.isDown('jump')).toBe(false); expect(input.wasPressed('jump')).toBe(false);
    document.hidden = false; input.pollGamepads(); expect(input.wasPressed('jump')).toBe(false);
    target.dispatchEvent(new Event('blur'));
    pad.buttons[2]!.pressed = true; // No polling while a hidden tab's game loop is stopped.
    target.dispatchEvent(new Event('focus')); input.pollGamepads();
    expect(input.wasPressed('shoot')).toBe(false);
    input.dispose();
  });

  it('skips unsupported mappings and disconnected entries, including sparse gamepad lists', () => {
    const { input, pad, setPads } = setup();
    const unsupported = { ...pad, mapping: '', id: 'Raw joystick' } as unknown as Gamepad;
    pad.buttons[0]!.pressed = true;
    setPads([unsupported]); input.pollGamepads();
    expect(input.isDown('jump')).toBe(false); expect(input.gamepadStatus).toContain('XInput');
    setPads([unsupported, null, pad as unknown as Gamepad]); input.pollGamepads();
    expect(input.isDown('jump')).toBe(true); expect(input.gamepadStatus).toContain('Xbox test');
    pad.connected = false; input.pollGamepads(); expect(input.isDown('jump')).toBe(false);
    input.dispose();
  });

  it('keeps keyboard/touch usable when the API is absent or blocked', () => {
    for (const navigator of [undefined, { getGamepads: () => { throw new Error('blocked'); } }]) {
      const target = Object.assign(new EventTarget(), { navigator });
      const input = new InputManager(target as unknown as Window);
      input.setTouchAction('shoot', true);
      expect(() => input.pollGamepads()).not.toThrow(); expect(input.isDown('shoot')).toBe(true);
      input.dispose();
    }
  });
});
