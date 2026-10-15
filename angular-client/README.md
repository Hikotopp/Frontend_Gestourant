# Aplicación Angular de Gestourant

Este workspace continúa la migración gradual del frontend de Gestourant a Angular 22. La página pública, su demostración interactiva, el acceso, el registro, el consentimiento de registro OAuth, el resumen y el mapa de mesas del panel autenticado ya son componentes Angular. Pedidos, cocina, menú, reportes y copias de seguridad siguen usando el cliente Vite mediante un puente temporal. La migración debe conservar la apariencia, la lógica de negocio y las capacidades existentes; no se reemplaza una vista hasta verificar su paridad con Vite.

## Estado actual

La página pública, las pantallas de autenticación Angular, el resumen y el mapa de mesas reutilizan los estilos originales de Vite. Los servicios de acceso, registro, OAuth, resumen y operaciones del mapa permanecen en el cliente existente y se consumen a través del puente temporal. El detalle y la edición de cuentas de mesa siguen en Vite para conservar el flujo completo de pedidos. Las demás secciones se abren en Vite hasta completar su migración; su menú permite volver al resumen Angular. El cierre de sesión y los controles de sesión siguen gestionados por el cliente existente.

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
