import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';

import { routes } from './app.routes';
import { cocktailDbTimeoutInterceptor } from './featured/products/services/cocktaildb-timeout.interceptor';
import {
  GENERAL_CONFIG_DATA,
  GeneralConfig,
} from './core/config/general.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(),
      withInterceptors([cocktailDbTimeoutInterceptor])
    ),
    provideRouter(routes),
    provideClientHydration(),
    provideAnimations(),
    {
      provide: GENERAL_CONFIG_DATA,
      useValue: GeneralConfig,
    },
  ],
};
