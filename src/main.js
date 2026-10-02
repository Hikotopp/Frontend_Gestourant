import { createGestourantServices } from './application/createGestourantServices';
import { createHttpApiAdapter } from './infrastructure/httpApiAdapter';
import { createHttpGestourantGateway } from './infrastructure/httpGestourantGateway';
import { logger } from './infrastructure/logger';
import { startGestourantApp } from './presentation/gestourantApp';
import { initializePwa } from './presentation/pwa';

if (initializePwa(logger)) {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const apiPort = createHttpApiAdapter(apiBase);
  const gateway = createHttpGestourantGateway(apiPort);
  const services = createGestourantServices(gateway);
  startGestourantApp(services, logger);
}
