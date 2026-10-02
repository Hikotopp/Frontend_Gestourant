import { assertGestourantGateway } from './ports/gestourantGateway.js';

export function createGestourantServices(gateway) {
  return assertGestourantGateway(gateway);
}
