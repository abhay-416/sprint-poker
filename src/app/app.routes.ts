import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'room/:roomId',
    loadComponent: () => import('./features/room/room.component').then(m => m.RoomComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
