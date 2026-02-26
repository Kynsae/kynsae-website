import { Injectable } from '@angular/core';
import { Project } from '../../shared/models/project.model';
import { PROJECTS_DATA } from '../other/projects.data';

/**
 * Provides read-only access to the portfolio projects collection.
 */
@Injectable({
  providedIn: 'root'
})
export class ProjectsManager {
  private readonly projects: readonly Project[] = PROJECTS_DATA;

  /** 
   * Returns all projects in the portfolio. 
   */
  public getAll(): readonly Project[] {
    return this.projects;
  }

  /** 
   * Returns the total number of projects. 
   */
  public getCount(): number {
    return this.projects.length;
  }

  /** 
   * Returns an array of all project IDs. 
   */
  public getIds(): string[] {
    return this.projects.map(project => project.id);
  }

  /**
   * Finds a project by its unique identifier.
   * @param id Project ID to search for
   * @returns The matching project or null if not found
   */
  public getById(id: string): Project | null {
    return this.projects.find(project => project.id === id) ?? null;
  }
}