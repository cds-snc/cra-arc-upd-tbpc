import { Injectable, inject } from '@angular/core';
import { StorageMap } from '@ngx-pwa/local-storage';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storage = inject(StorageMap);

  set(key: string, value: string | unknown) {
    if (typeof value === 'string') {
      return this.storage.set(key, value);
    } else {
      return this.storage.set(key, JSON.stringify(value));
    }
  }

  get(key: string) {
    return this.storage.get(key).pipe(
      map((value) => {
        if (value && typeof value === 'string') {
          return JSON.parse(value);
        }
      })
    );
  }

  remove(key: string) {
    return this.storage.delete(key);
  }

  observe(key: string) {
    return this.storage.watch(key);
  }

  observeKeys() {
    return this.storage.keys();
  }

  clear() {
    return this.storage.clear();
  }
}
