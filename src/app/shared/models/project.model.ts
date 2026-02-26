export interface Project {
    id: string;
    title: string;
    description: string;
    services: string[];
    client: string;
    websiteUrl?: string;
    thumbnail?: string;
    medias: { type: 'video' | 'image', url: string; }[];
    tags: string[];
    year: string;
}