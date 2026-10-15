# Aplicación Angular de Gestourant

Este workspace inicia la migración gradual del frontend de Gestourant a Angular 22. El cliente Vite original permanece disponible mientras se trasladan vistas y flujos. La migración debe conservar la apariencia, la lógica de negocio y las capacidades existentes; no se reemplaza una vista hasta verificar su paridad con Vite.

## Estado actual

Angular monta la aplicación Vite existente como puente temporal. Por eso, la interfaz y los flujos actuales siguen siendo los de Vite; todavía no se han migrado vistas a componentes Angular ni se considera completa la migración.

Los recursos públicos necesarios para Angular se encuentran dentro de `public/` y corresponden a los originales de `Frontend_Gestourant/public/`.

## Requisitos y comandos

Se requiere Node.js 24.15.0 o posterior, compatible con Angular 22.

Desde la raíz de `Frontend_Gestourant`:

```bash
npm run dev:angular
npm run build:angular
npm run test:angular
```

Angular inicia en `http://localhost:4200` y usa `proxy.conf.json` para reenviar las solicitudes de API y OAuth al backend local en `http://localhost:8081`.

El cliente Vite original se ejecuta y valida por separado con `npm run dev`, `npm test` y `npm run build`.
