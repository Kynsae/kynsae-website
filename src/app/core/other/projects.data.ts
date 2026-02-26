import { Project } from "../../shared/models/project.model";

export const PROJECTS_DATA: readonly Project[] = [
  {
    id: 'iris_engine',
    title: 'IRIS_Engine',
    description: 'Interactive Resonance Imaging System — A web application that transforms 2D image slices (especially MRI scans) into an interactive 3D point cloud visualization.',
    services: ['Web Design', 'UI-UX', 'Development', '3D Visualization', 'WebGL', 'Motion Design'],
    client: 'IRIS',
    websiteUrl: 'https://irisengine.app/',
    tags: ['3D', 'DESIGN', 'WEBAPP'],
    thumbnail: 'projects/iris-engine/cover.webp',
    medias: [
      { type: 'video', url: 'projects/iris-engine/1.mp4'},
      { type: 'video', url: 'projects/iris-engine/2.mp4'},
      { type: 'image', url: 'projects/iris-engine/3.webp'},
      { type: 'image', url: 'projects/iris-engine/4.webp'},
      { type: 'image', url: 'projects/iris-engine/5.webp'},
    ],
    year: '2026'
  },
  {
    id: 'super_k',
    title: 'SUPER_K',
    description: 'SUPER-K is an original fictional narrative. All characters were generated with AI assistance and then refined by humans to achieve a more natural and realistic look, in line with the storyline.',
    services: ['Web Design', 'UI/UX', 'Development', 'AI', '3D', 'Photoshop'],
    client: 'SuperK',
    websiteUrl: 'https://superk.vercel.app/',
    tags: ['DESIGN', 'WEBSITE'],
    thumbnail: 'projects/superk/1.webp',
    medias: [
      { type: 'video', url: 'projects/superk/6.mkv'},
      { type: 'image', url: 'projects/superk/2.webp'},
      { type: 'image', url: 'projects/superk/3.webp'},
      { type: 'image', url: 'projects/superk/4.webp'},
      { type: 'image', url: 'projects/superk/5.webp'},
    ],
    year: '2024'
  },
  {
    id: 'tech_posters',
    title: 'TECH_posters',
    description: 'A collection of vibrant and dynamic posters designed for an event at L\'Usine. The visuals reflect the raw energy and underground spirit of the event, combining bold typography and electrifying graphics.',
    services: ['Graphic Design', 'Poster', 'Visual Identity', 'Print Media'],
    client: 'L\'usine',
    tags: ['DESIGN', 'EVENT', 'POSTER'],
    thumbnail: 'projects/techno-posters/1.webp',
    medias: [
      { type: 'image', url: 'projects/techno-posters/2.webp'},
      { type: 'image', url: 'projects/techno-posters/3.webp'},
      { type: 'image', url: 'projects/techno-posters/4.webp'},
      { type: 'image', url: 'projects/techno-posters/5.webp'},
      { type: 'image', url: 'projects/techno-posters/6.webp'},
    ],
    year: '2025'
  },
  {
    id: 'aeris',
    title: 'AERIS',
    description: 'Presentation website for Aeris Dynamics, showcasing their cutting-edge human-sized VTOL drone. The drone structure has been designed in 3D for more immersive presentation.',
    services: ['Web Design', 'UI/UX', 'Development', 'Branding', '3D', 'Motion Design'],
    client: 'Aeris Dynamics',
    websiteUrl: 'https://aeris-dynamics.netlify.app/',
    tags: ['3D', 'DESIGN', 'WEBSITE'],
    thumbnail: 'projects/aeris/cover.webp',
    medias: [
      { type: 'video', url: 'projects/aeris/2.mp4'},
      { type: 'video', url: 'projects/aeris/3.mp4'},
      { type: 'video', url: 'projects/aeris/4.mp4'}
    ],
    year: '2023'
  },
  {
    id: 'halte_geneva',
    title: 'HALTE_Geneva',
    description: 'A captivating theatrical design and brochure creation for HALTE Geneva, reflecting the essence of their artistic performances and cultural events.',
    services: ['Theatrical Design', 'Brochure Design', 'Print Media'],
    client: 'Comédie de Genève',
    tags: ['DESIGN', 'EVENT'],
    thumbnail: 'projects/halte/cover.webp',
    medias: [
      { type: 'image', url: 'projects/halte/1.webp'},
      { type: 'image', url: 'projects/halte/2.webp'},
      { type: 'image', url: 'projects/halte/3.webp'},
      { type: 'image', url: 'projects/halte/4.webp'},
      { type: 'image', url: 'projects/halte/5.webp'}
    ],
    year: '2023'
  },
];