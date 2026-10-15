import { AfterViewInit, Component } from '@angular/core';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  template: '<div id="app"></div>',
})
export class App implements AfterViewInit {
  async ngAfterViewInit(): Promise<void> {
    const hostname = window.location.hostname;
    globalThis.__GESTOURANT_CONFIG__ = {
      development: hostname === 'localhost' || hostname === '127.0.0.1',
      production: hostname !== 'localhost' && hostname !== '127.0.0.1',
      apiBase: '',
    };
    await import('../../../src/main.js');
  }
}
