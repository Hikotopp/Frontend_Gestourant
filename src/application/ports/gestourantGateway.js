const requiredOperations = {
  auth: ['getConfig', 'exchangeOAuthCode', 'registerOAuthAccount', 'login', 'register', 'logout', 'sessionStatus', 'recordActivity', 'unlock'],
  tables: ['list', 'create', 'update', 'remove', 'join', 'unjoin', 'updatePosition', 'openOrder', 'getOpenOrder'],
  products: ['list', 'save', 'remove'],
  orders: ['addProduct', 'removeItem', 'updateItem', 'close'],
  guest: ['getTable', 'listRequests', 'createRequest', 'listStaffRequests', 'approveStaffRequest', 'rejectStaffRequest'],
  kitchen: ['listRequests', 'advanceRequest'],
  backups: ['list', 'create', 'download', 'restore'],
  audit: ['list'],
  reports: ['getCashClose']
};

export function assertGestourantGateway(gateway) {
  for (const [group, operations] of Object.entries(requiredOperations)) {
    if (!gateway?.[group] || operations.some(operation => typeof gateway[group][operation] !== 'function')) {
      throw new TypeError(`The Gestourant gateway is missing required operations in "${group}".`);
    }
  }
  return gateway;
}
