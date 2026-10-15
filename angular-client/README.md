# Aplicación Angular de Gestourant

Este workspace continúa la migración gradual del frontend de Gestourant a Angular 22. La página pública, su demostración interactiva, el acceso, el registro y el consentimiento de registro OAuth ya son componentes Angular. La sesión y el espacio autenticado siguen usando el cliente Vite mediante un puente temporal. La migración debe conservar la apariencia, la lógica de negocio y las capacidades existentes; no se reemplaza una vista hasta verificar su paridad con Vite.

## Estado actual

La página pública y las pantallas de autenticación Angular reutilizan los estilos originales de Vite. Los servicios de acceso, registro y OAuth permanecen en el cliente existente y se consumen a través del puente temporal; después de autenticar, el espacio de trabajo Vite recibe la sesión. El retorno a la página Angular también está conectado al cierre de sesión. La migración completa queda pendiente hasta trasladar el espacio autenticado y verificar su paridad.

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
