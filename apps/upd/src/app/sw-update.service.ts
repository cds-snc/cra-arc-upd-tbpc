import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { first } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  private appRef = inject(ApplicationRef);
  private updates = inject(SwUpdate);

  constructor() {
    if (!environment.production) {
      return;
    }
    
    const appIsStable$ = this.appRef.isStable.pipe(
      first((isStable) => isStable === true),
    );

    appIsStable$.subscribe(async () => {
      try {
        console.log('Service worker checking for updates...');

        const updateFound = await this.updates.checkForUpdate();

        console.log(
          updateFound
            ? 'A new version is available.'
            : 'Already on the latest version.',
        );
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    });

    this.updates.versionUpdates.subscribe((evt) => {
      switch (evt.type) {
        case 'VERSION_DETECTED':
          console.log(`Downloading new app version: ${evt.version.hash}`);
          break;
        case 'VERSION_READY':
          console.log(`Current app version: ${evt.currentVersion.hash}`);
          console.log(
            `New app version ready for use: ${evt.latestVersion.hash}`,
          );

          // Clear session storage to prevent issues with old data
          sessionStorage.clear();

          // Reload the page to update to the latest version.
          document.location.reload();
          break;
        case 'VERSION_INSTALLATION_FAILED':
          console.log(
            `Failed to install app version '${evt.version.hash}': ${evt.error}`,
          );
          break;
      }
    });
  }
}
