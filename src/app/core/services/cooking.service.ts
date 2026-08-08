import { Injectable } from '@angular/core';
import { RecordServiceBase } from './record.service';

@Injectable({ providedIn: 'root' })
export class CookingService extends RecordServiceBase {
  constructor() {
   super('cooking_records', 'Garbage');
  }
}
