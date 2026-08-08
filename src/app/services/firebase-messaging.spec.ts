import { TestBed } from '@angular/core/testing';

import { FirebaseMessaging } from './firebase-messaging';

describe('FirebaseMessaging', () => {
  let service: FirebaseMessaging;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FirebaseMessaging);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
