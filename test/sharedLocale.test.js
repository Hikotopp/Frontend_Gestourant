import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from '../angular-client/node_modules/typescript/lib/typescript.js';
import { getLocale, languagePicker, localeOptions, setLocale, translate, translateBackendMessage } from '../src/shared/locale.js';
import { translations } from '../src/shared/locale-translations.js';

test('shares the six supported locales and translations across clients', () => {
  assert.deepEqual(localeOptions.map(option => option.id), ['en', 'fr', 'de', 'es-ES', 'es-419', 'zh-CN']);
  assert.equal(translate('Pedido #{id}', { id: 42 }, 'en'), 'Order #42');
  assert.equal(translate('Cerrar', {}, 'fr'), 'Fermer');
  assert.equal(translate('No se pudo generar el código QR: {detail}', { detail: 'invalid' }, 'de'), 'Der QR-Code konnte nicht erstellt werden: invalid');
  assert.equal(translate('Error desconocido del servidor.', {}, 'zh-CN'), 'Error desconocido del servidor.');
  assert.equal(Object.keys(translations).length > 0, true);
});

test('localizes every seeded menu item and description in all supported languages', () => {
  const products = [
    ['Hamburguesa de la casa', 'Carne artesanal, queso, vegetales y papas.'],
    ['Pollo a la plancha', 'Pechuga a la plancha con arroz y ensalada.'],
    ['Pasta al pesto', 'Pasta con salsa pesto, tomate cherry y parmesano.'],
    ['Limonada natural', 'Limonada preparada al momento.'],
    ['Jugo de mango', 'Jugo natural de mango.'],
    ['Cafe americano', 'Cafe caliente de la casa.'],
    ['risoto a la girasol', 'arroz con huevo frito'],
  ];
  for (const [name, description] of products) {
    for (const locale of localeOptions.map(option => option.id)) {
      assert.equal(typeof translations[name]?.[locale], 'string', `${name} missing ${locale}`);
      assert.equal(typeof translations[description]?.[locale], 'string', `${description} missing ${locale}`);
      assert.equal(translate(name, {}, locale), translations[name][locale]);
      assert.equal(translate(description, {}, locale), translations[description][locale]);
    }
  }
  assert.equal(translate('Restaurante especial', {}, 'en'), 'Restaurante especial');
});

test('uses menu translations in public, staff, Angular, kitchen, and export views', () => {
  const sources = [
    ['../src/presentation/guestOrdering.js', 'translate(product.name)', 'translate(product.description)'],
    ['../src/presentation/gestourantApp.js', 'translate(product.name)', 'translate(item.name)'],
    ['../src/presentation/menuDownload.js', 'translate(product.name)', 'translate(product.description)'],
    ['../src/presentation/cashCloseXlsx.js', 'translate(product.name)', 'translate(product.description)'],
    ['../angular-client/src/app/products-page.html', 'product.name | tr', 'product.description | tr'],
    ['../angular-client/src/app/requests-page.html', 'item.name | tr'],
  ];
  for (const [file, ...expected] of sources) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const expression of expected) assert.ok(source.includes(expression), `${file} must use ${expression}`);
  }
});

test('renders the Vite language selector as a labeled themed control', () => {
  const picker = languagePicker();
  assert.match(picker, /class="locale-picker"/);
  assert.match(picker, /class="locale-picker-icon"/);
  assert.match(picker, /class="locale-picker-value" aria-hidden="true">ES</);
  assert.match(picker, /data-gestourant-locale aria-label="Idioma"/);
  assert.match(picker, /value="zh-CN"/);
});

test('localizes both demo privacy notices in all six supported languages', () => {
  const policyPaths = [
    '../public/politica-tratamiento.html',
    '../angular-client/public/politica-tratamiento.html',
  ];
  const policyPages = policyPaths.map(file => readFileSync(new URL(file, import.meta.url), 'utf8'));
  const keysForPage = policyPages.map(source => [...source.matchAll(/data-i18n="([^"]+)"/g)].map(match => match[1]).sort());
  assert.deepEqual(keysForPage[0], keysForPage[1]);
  assert.match(policyPages[0], /src="\/policy-locale\.js"/);

  const scripts = [
    readFileSync(new URL('../public/policy-locale.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../angular-client/public/policy-locale.js', import.meta.url), 'utf8'),
  ];
  assert.equal(scripts[0], scripts[1]);
  const script = scripts[0];
  const spanishSource = policyPages[0];
  for (const locale of ['en', 'fr', 'de', 'es-ES', 'es-419', 'zh-CN']) {
    const elements = new Map(keysForPage[0].map(key => [key, { dataset: { i18n: key }, textContent: `original:${key}` }]));
    const selector = {
      value: '',
      setAttribute() {},
      addEventListener() {},
    };
    const document = {
      documentElement: {},
      title: '',
      querySelector: selectorOrMeta => selectorOrMeta === '#policy-language'
        ? selector
        : { content: '' },
      querySelectorAll: () => [...elements.values()],
    };
    vm.runInNewContext(script, {
      document,
      localStorage: { getItem: () => locale, setItem() {} },
      window: { addEventListener() {}, dispatchEvent() {} },
      CustomEvent: class {},
    });
    assert.equal(selector.value, locale);
    assert.equal(document.documentElement.lang, locale);
    assert.match(document.title, /Gestourant$/);
    if (locale === 'es-ES' || locale === 'es-419') {
      assert.equal(elements.get('title').textContent, 'original:title');
    } else {
      assert.notEqual(elements.get('title').textContent, 'original:title');
      assert.notEqual(elements.get('rightsText').textContent, 'original:rightsText');
      assert.notEqual(elements.get('footer').textContent, 'original:footer');
      for (const [key, element] of elements) {
        assert.notEqual(element.textContent, `original:${key}`, `${locale} missing policy translation: ${key}`);
      }
    }
  }

  assert.match(spanishSource, /Aviso informativo/);
  assert.match(spanishSource, /data-i18n="authorizationText"/);
});

test('provides complete translations for the QR, table, ordering, and kitchen flows', () => {
  const keys = [
    'Ver QR de Mesa {table}',
    'Revisa cada solicitud; solo al confirmarla pasa a la cuenta y se descuenta del inventario.',
    'Confirmar y enviar a cocina',
    'PREPARAR SIN: {ingredients} · CONFIRMAR CON COCINA',
    'Elige una mesa; puedes moverla en el croquis y abrir su cuenta.',
    '¿Eliminar la Mesa {table}?',
  ];
  for (const key of keys) {
    for (const locale of ['en', 'fr', 'de', 'es-ES', 'zh-CN']) {
      assert.equal(typeof translations[key]?.[locale], 'string', `${key} missing ${locale}`);
    }
  }
  assert.equal(translate('Ver QR de Mesa {table}', { table: 8 }, 'fr'), 'Voir le QR de la table 8');
  assert.equal(translate('¿Eliminar la Mesa {table}?', { table: 8 }, 'zh-CN'), '确定删除餐桌 8 吗？');
});

test('translates known backend errors and preserves unknown server details', () => {
  assert.equal(
    translateBackendMessage('No encontramos esta mesa. Pide ayuda a un empleado.', 'en'),
    'We could not find this table. Please ask a staff member for help.'
  );
  assert.equal(
    translateBackendMessage('La mesa ya está ocupada', 'fr'),
    'Cette table est déjà occupée.'
  );
  assert.equal(
    translateBackendMessage('Limonada no está disponible en la cantidad solicitada', 'de'),
    'Limonade ist nicht in der angeforderten Menge verfügbar.'
  );
  assert.equal(
    translateBackendMessage('Pollo a la plancha no está disponible en la cantidad solicitada', 'en'),
    'Grilled chicken breast is not available in the requested quantity.'
  );
  assert.equal(
    translateBackendMessage('Inventario insuficiente para Limonada', 'zh-CN'),
    '柠檬水 的库存不足。'
  );
  assert.equal(
    translateBackendMessage('Mesa no encontrada', 'es-ES'),
    'Mesa no encontrada'
  );
  assert.equal(
    translateBackendMessage('No encontramos esta mesa. Pide ayuda a un empleado.', 'es-419'),
    'No encontramos esta mesa. Pide ayuda a un empleado.'
  );
  assert.equal(translateBackendMessage('Error de servidor inesperado'), 'Error de servidor inesperado');
});

test('uses singular labels for one menu choice and one cart item', () => {
  assert.equal(translate('{count} opción', { count: 1 }, 'en'), '1 option');
  assert.equal(translate('{count} producto seleccionado', { count: 1 }, 'fr'), '1 produit sélectionné');
});

test('provides translations for every explicit Vite UI key in all supported languages', () => {
  const locales = ['en', 'fr', 'de', 'es-ES', 'zh-CN'];
  const files = [
    '../src/presentation/gestourantApp.js',
    '../src/presentation/guestOrdering.js',
    '../src/presentation/cashCloseXlsx.js',
    '../src/presentation/menuDownload.js',
    '../src/presentation/pwa.js',
  ];
  const keys = new Set();
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\btranslate\(\s*'((?:\\.|[^'\\])*)'/g)) keys.add(match[1]);
  }
  const angularFiles = [
    '../angular-client/src/app/app.ts',
    '../angular-client/src/app/auth-page.html',
    '../angular-client/src/app/auth-page.ts',
    '../angular-client/src/app/audit-logs-page.html',
    '../angular-client/src/app/audit-logs-page.ts',
    '../angular-client/src/app/backups-page.html',
    '../angular-client/src/app/backups-page.ts',
    '../angular-client/src/app/dashboard-page.html',
    '../angular-client/src/app/dashboard-page.ts',
    '../angular-client/src/app/language-picker.ts',
    '../angular-client/src/app/products-page.html',
    '../angular-client/src/app/products-page.ts',
    '../angular-client/src/app/public-home.html',
    '../angular-client/src/app/public-home.ts',
    '../angular-client/src/app/reports-page.html',
    '../angular-client/src/app/reports-page.ts',
    '../angular-client/src/app/requests-page.html',
    '../angular-client/src/app/requests-page.ts',
    '../angular-client/src/app/tables-page.html',
    '../angular-client/src/app/tables-page.ts',
  ];
  for (const file of angularFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\btranslate\(\s*'((?:\\.|[^'\\])*)'/g)) keys.add(match[1]);
    for (const match of source.matchAll(/'((?:\\.|[^'\\])*)'\s*\|\s*tr/g)) keys.add(match[1]);
    if (file.endsWith('.ts')) {
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const collectMessages = (node) => {
        if (ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text === 'set'
          && ts.isPropertyAccessExpression(node.expression.expression)
          && ['error', 'notice', 'message'].includes(node.expression.expression.name.text)
          && node.arguments[0]) {
          const collectStrings = (argument) => {
            if (ts.isStringLiteralLike(argument) && argument.text) keys.add(argument.text);
            ts.forEachChild(argument, collectStrings);
          };
          collectStrings(node.arguments[0]);
        }
        if (file.endsWith('auth-page.ts')
          && ts.isMethodDeclaration(node)
          && node.name.getText(sourceFile) === 'messageForError') {
          const collectReturnedMessages = (child) => {
            if (ts.isReturnStatement(child) && child.expression && ts.isStringLiteralLike(child.expression)) {
              keys.add(child.expression.text);
            }
            ts.forEachChild(child, collectReturnedMessages);
          };
          collectReturnedMessages(node);
        }
        ts.forEachChild(node, collectMessages);
      };
      collectMessages(sourceFile);
    }
  }
  [
    'Consulta y descarga el historial de facturas del restaurante. El empleado mostrado es quien abrió cada pedido.',
    'Consulta las facturas de los pedidos que abriste en la fecha seleccionada.',
    'Fecha del turno',
    'Consultar historial',
    'Consultar fecha',
    'Crear copia ahora',
    'Esta acción reemplazará la base de datos actual. Se recomienda descargar un respaldo reciente antes de continuar.',
    'Escribe RESTAURAR para confirmar:',
    'La sesión se cerrará en {countdown} si no la desbloqueas.',
    'Claro',
    'Oscuro',
    'Bistró',
    'Autorizo el tratamiento de mis datos para crear mi cuenta.',
    'He leído y autorizo el tratamiento de mis datos personales para crear mi cuenta de Gestourant.',
    'Administrador',
    'Empleado',
    'Pide la cuenta',
    'disponible',
    'pidió la cuenta',
    'Pendiente de confirmar',
    'Confirmada · en cocina',
    'En preparación',
    'Lista para servir',
    'No aceptada',
    'PLATO',
    'BEBIDA',
    'OTRO',
    'Platos',
    'Bebidas',
    'Otros',
    'Factura',
    'Fecha y hora',
    'Mesa',
    'Método de pago',
    'Total (COP)',
    'Efectivo',
    'Digital',
    'Sin conexión. La app y el contenido público guardado están disponibles; los datos y pedidos requieren internet.',
    'Gestourant | Servicio de restaurante en un solo lugar',
    'Coordina mesas, pedidos y menú de tu restaurante con Gestourant. Explora la demo interactiva.',
    'No se pudo consultar la configuración de acceso. Revisa la conexión con el servidor.',
    'Disponible',
    'En servicio',
    'Salón unido',
    'Limonada natural',
    'Postre de la casa',
    'Hamburguesa de la casa',
    'Pasta al pesto',
    'Todo',
    'Esta sesión se cerró porque la cuenta se abrió en otro navegador.',
    'La sesión se cerró por 5 minutos de inactividad.',
    'La sesión expiró o fue cerrada.',
  ].forEach(key => keys.add(key));
  const dictionarySource = readFileSync(new URL('../src/shared/locale-translations.js', import.meta.url), 'utf8');
  const dictionaryKeys = [...dictionarySource.matchAll(/^  '((?:\\.|[^'\\])*)': \{/gm)].map(match => match[1]);
  assert.equal(new Set(dictionaryKeys).size, dictionaryKeys.length, 'translation keys must be unique');
  for (const [key, values] of Object.entries(translations)) {
    for (const locale of locales) assert.equal(typeof values[locale], 'string', `${key} missing ${locale}`);
  }
  const missing = [...keys].flatMap(key => locales.filter(locale => typeof translations[key]?.[locale] !== 'string').map(locale => `${key} (${locale})`));
  assert.deepEqual(missing, []);
  assert.equal(translate('La sesión se cerrará en {countdown} si no la desbloqueas.', { countdown: '02:30' }, 'fr'), 'Votre session sera fermée dans 02:30 si vous ne la déverrouillez pas.');
  assert.equal(translate('Copia creada: {fileName}', { fileName: 'backup.sql' }, 'zh-CN'), '已创建备份：backup.sql');
  assert.equal(translate('Escribe RESTAURAR para confirmar:', {}, 'en'), 'Type RESTAURAR to confirm:');
});

test('falls back to Spanish Latin America when stored locale is unsupported', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'unsupported' },
  });
  try {
    assert.equal(getLocale(), 'es-419');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('persists the locale, updates the document language and emits a change event', () => {
  const names = ['localStorage', 'document', 'window', 'CustomEvent'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const stored = new Map();
  let event;
  class TestCustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  Object.defineProperties(globalThis, {
    localStorage: { configurable: true, value: { setItem: (key, value) => stored.set(key, value) } },
    document: { configurable: true, value: { documentElement: { lang: '' } } },
    window: { configurable: true, value: { dispatchEvent: value => { event = value; } } },
    CustomEvent: { configurable: true, value: TestCustomEvent },
  });
  try {
    setLocale('fr');
    assert.equal(stored.get('gestourant_locale'), 'fr');
    assert.equal(globalThis.document.documentElement.lang, 'fr');
    assert.equal(event.type, 'gestourant:locale-change');
    assert.equal(event.detail, 'fr');
    assert.throws(() => setLocale('invalid'), RangeError);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
