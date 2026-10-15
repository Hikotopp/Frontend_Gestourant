# Aplicación Angular de Gestourant

Este workspace continúa la migración gradual del frontend de Gestourant a Angular 22. La página pública y su demostración interactiva ya son componentes Angular. El acceso, el registro, OAuth, la sesión y el espacio autenticado siguen usando el cliente Vite mientras se migran. La migración debe conservar la apariencia, la lógica de negocio y las capacidades existentes; no se reemplaza una vista hasta verificar su paridad con Vite.

## Estado actual

La página pública Angular reutiliza los estilos originales de Vite. Sus acciones de acceso y registro abren los flujos existentes a través del puente temporal; el cliente Vite permanece disponible para esos flujos y para el espacio autenticado. La migración completa queda pendiente hasta trasladar esos flujos y verificar su paridad.

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
