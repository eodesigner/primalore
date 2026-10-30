export type Risk = 'low' | 'medium' | 'high' | 'critical';

export interface Category {
  slug: string;
  name: string;
  blurb: string;
  risk: Risk;
}

export const categories: Category[] = [
  { slug: 'water', name: 'Water', blurb: 'Sources, storage, treatment, and the limits of each method.', risk: 'high' },
  { slug: 'fire-heat', name: 'Fire and Heat', blurb: 'Fire preparation, fuels, safe use, cooking and staying warm.', risk: 'medium' },
  { slug: 'shelter', name: 'Shelter', blurb: 'Site choice, weather protection and temporary shelters.', risk: 'low' },
  { slug: 'food', name: 'Food', blurb: 'Provisioning, storage, spoilage signs and cooking.', risk: 'medium' },
  { slug: 'foraging', name: 'Foraging', blurb: 'Plants, fungi, seasonality, toxic look-alikes and the limits of identification.', risk: 'critical' },
  { slug: 'first-aid-hygiene', name: 'First Aid and Hygiene', blurb: 'Basic first aid, sanitation and reducing disease risk.', risk: 'high' },
  { slug: 'navigation-signalling', name: 'Navigation and Signalling', blurb: 'Maps, compass, communication plans and distress signals.', risk: 'low' },
  { slug: 'power-light', name: 'Power and Light', blurb: 'Batteries, low-draw lighting, portable energy and simple systems.', risk: 'medium' },
  { slug: 'tools-repair', name: 'Tools and Repair', blurb: 'Hand tools, knots, equipment care and simple repairs.', risk: 'low' },
  { slug: 'growing', name: 'Growing', blurb: 'Small-scale growing, seeds, compost and seasonal plans.', risk: 'low' },
  { slug: 'urban-resilience', name: 'Urban Resilience', blurb: 'Outages, evacuation preparation, home and family plans.', risk: 'high' },
  { slug: 'mind-community', name: 'Mind and Community', blurb: 'Coping with stress, dividing work, living and deciding together.', risk: 'medium' },
];

export const contentTypes = [
  'quick-tip', 'core-guide', 'project', 'checklist', 'news',
  'species-card', 'decision-tree', 'learning-path', 'calendar', 'glossary',
] as const;

export const reviewStatuses = ['draft', 'auto-checked', 'expert-approved', 'published', 'retired'] as const;
