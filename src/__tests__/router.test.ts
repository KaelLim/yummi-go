import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { defRoute, navigate, startRouter, $route, _resetRoutes } from '../router';

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('router', () => {
  beforeEach(() => {
    _resetRoutes();
    document.body.innerHTML = '<div id="app"></div>';
    location.hash = '';
    $route.set({ path: '/', params: {} });
  });

  afterEach(() => {
    location.hash = '';
  });

  it('registers a route and renders into #app on resolve', async () => {
    defRoute('/home', async () => ({
      default: () => {
        const el = document.createElement('section');
        el.id = 'home-screen';
        el.textContent = 'home';
        return el;
      },
    }));
    location.hash = '#/home';
    startRouter();
    await flush();
    await flush();
    const app = document.getElementById('app')!;
    expect(app.querySelector('#home-screen')).not.toBeNull();
    expect($route.get().path).toBe('/home');
  });

  it('navigate updates hash and triggers render', async () => {
    defRoute('/map', async () => ({
      default: () => {
        const el = document.createElement('div');
        el.id = 'map-screen';
        return el;
      },
    }));
    startRouter();
    navigate('/map');
    await flush();
    await flush();
    expect(location.hash).toBe('#/map');
    expect(document.getElementById('map-screen')).not.toBeNull();
  });

  it('extracts named params from the pattern', async () => {
    let captured: Record<string, string> | null = null;
    defRoute('/map/restaurant/:id', async () => ({
      default: (params) => {
        captured = params;
        const el = document.createElement('div');
        el.id = 'restaurant-' + params.id;
        return el;
      },
    }));
    location.hash = '#/map/restaurant/42';
    startRouter();
    await flush();
    await flush();
    expect(captured).toEqual({ id: '42' });
    expect(document.getElementById('restaurant-42')).not.toBeNull();
    expect($route.get().params).toEqual({ id: '42' });
  });

  it('warns and skips unknown routes', async () => {
    location.hash = '#/nope';
    startRouter();
    await flush();
    expect(document.getElementById('app')!.innerHTML).toBe('');
  });
});
