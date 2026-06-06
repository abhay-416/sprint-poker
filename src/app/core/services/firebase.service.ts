import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Database, getDatabase } from 'firebase/database';
import { Firestore, getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  public app!: FirebaseApp;
  public auth!: Auth;
  public db!: Database;
  public firestore!: Firestore;
  public hasRealConfig = false;

  constructor() {
    const config = environment.firebase;
    this.hasRealConfig = !!(config && config.apiKey && !config.apiKey.includes('PLACEHOLDER'));
    
    if (this.hasRealConfig) {
      try {
        this.app = initializeApp(config);
        this.auth = getAuth(this.app);
        this.db = getDatabase(this.app);
        this.firestore = getFirestore(this.app);
      } catch (error) {
        console.error('Failed to initialize Firebase with provided credentials:', error);
      }
    } else {
      console.warn('Firebase initialized with placeholders. Live real-time features will be unavailable until a valid configuration is provided in environment.ts.');
    }
  }
}
