import { Routes } from '@angular/router';

export const routes: Routes = [
    { 
        path: "", 
        loadComponent: () => import('./features/home/home').then(m => m.Home)
    },
    { 
        path: "contact", 
        loadComponent: () => import('./features/contact/contact').then(m => m.Contact)
    },
    { 
        path: "work", 
        loadComponent: () => import('./features/work/work').then(m => m.Work)
    },
    { 
        path: "work/:id", 
        loadComponent: () => import('./features/project-info/project-info').then(m => m.ProjectInfo)
    },
    { 
        path: "about", 
        loadComponent: () => import('./features/about/about').then(m => m.About)
    },
    { 
        path: "lab", 
        loadComponent: () => import('./features/lab/lab').then(m => m.Lab)
    },
    { path: '**', redirectTo: '' }
];