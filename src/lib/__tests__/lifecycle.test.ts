import { describe, it, expect, vi } from 'vitest';
import { atom } from 'nanostores';
import { onUnmount, bind } from '../lifecycle';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('lifecycle', () => {
  describe('onUnmount', () => {
    it('fires when node leaves the DOM', async () => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      const fn = vi.fn();
      onUnmount(node, fn);
      node.remove();
      await tick();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not fire while still mounted', async () => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      const fn = vi.fn();
      onUnmount(node, fn);
      const sibling = document.createElement('div');
      document.body.appendChild(sibling);
      await tick();
      expect(fn).not.toHaveBeenCalled();
      node.remove();
      sibling.remove();
    });

    it('only fires once even if remount/remove cycles happen', async () => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      const fn = vi.fn();
      onUnmount(node, fn);
      node.remove();
      await tick();
      document.body.appendChild(node);
      node.remove();
      await tick();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('bind', () => {
    it('subscribes immediately with current store value', () => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      const a = atom(7);
      const fn = vi.fn();
      bind(node, a, fn);
      expect(fn).toHaveBeenCalledWith(7);
      node.remove();
    });

    it('updates when store changes', () => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      const a = atom(0);
      const fn = vi.fn();
      bind(node, a, fn);
      a.set(42);
      // nanostores passes (newValue, oldValue, ?) on set — check the first arg.
      expect(fn.mock.lastCall?.[0]).toBe(42);
      node.remove();
    });

    it('unsubscribes when node leaves the DOM', async () => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      const a = atom(0);
      const fn = vi.fn();
      bind(node, a, fn);
      fn.mockClear();
      node.remove();
      await tick();
      a.set(99);
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
