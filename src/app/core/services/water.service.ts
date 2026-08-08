import { Injectable } from '@angular/core';
import { RecordServiceBase } from './record.service';

@Injectable({ providedIn: 'root' })
export class WaterService extends RecordServiceBase {
  constructor() {
    super('water_records', 'Water');
  }
}
