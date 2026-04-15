// Walkthrough interview templates used by the AI Site Walk feature.
// Extracted from mock.ts so the walkthrough has no dependency on mock data.

export const WALKTHROUGH_TEMPLATES: Record<string, { question: string; type: 'choice'|'text'|'number'; options?: string[] }[]> = {
  bathroom: [
    { question: 'Is this a full gut remodel or a cosmetic refresh?', type: 'choice', options: ['Full gut remodel', 'Cosmetic refresh', 'Partial (fixtures only)', 'Not sure yet'] },
    { question: 'What are the approximate dimensions of the bathroom?', type: 'choice', options: ['Under 50 sqft', '50–80 sqft', '80–120 sqft', 'Over 120 sqft'] },
    { question: 'What type of shower does the client want?', type: 'choice', options: ['Walk-in tile shower', 'Tub/shower combo', 'Freestanding tub + separate shower', 'Keep existing layout'] },
    { question: 'What is the tile scope?', type: 'choice', options: ['Floor only', 'Shower only', 'Full floor + shower', 'Floor, shower, and accent wall'] },
    { question: 'What is the vanity plan?', type: 'choice', options: ['New double vanity', 'New single vanity', 'Keep existing vanity', 'Custom built-in'] },
    { question: 'Any plumbing relocations needed?', type: 'choice', options: ['None – keep existing locations', 'Minor (add fixture)', 'Full relocation'] },
    { question: 'Additional notes or special requests?', type: 'text' },
  ],
  kitchen: [
    { question: 'Is this a full gut or keeping the existing layout?', type: 'choice', options: ['Full gut – new layout', 'Same layout, new everything', 'Partial – cabinets only', 'Cosmetic only'] },
    { question: 'Approximate kitchen size?', type: 'choice', options: ['Under 150 sqft', '150–250 sqft', '250–400 sqft', 'Over 400 sqft'] },
    { question: 'What is the cabinet plan?', type: 'choice', options: ['Full custom cabinetry', 'Semi-custom (RTA)', 'Reface existing', 'Keep existing'] },
    { question: 'Countertop material?', type: 'choice', options: ['Quartz', 'Granite', 'Marble', 'Butcher block', 'TBD'] },
    { question: 'Is an island being added or modified?', type: 'choice', options: ['New island', 'Expand existing island', 'No island'] },
    { question: 'Appliance scope?', type: 'choice', options: ['Client supplying all appliances', 'We source and install', 'Keep existing appliances'] },
    { question: 'Additional notes?', type: 'text' },
  ],
  basement: [
    { question: 'What is the main use of the finished basement?', type: 'choice', options: ['Family/rec room', 'Home theater', 'In-law suite', 'Home office', 'Multiple spaces'] },
    { question: 'Approximate basement square footage?', type: 'choice', options: ['Under 600 sqft', '600–900 sqft', '900–1200 sqft', 'Over 1200 sqft'] },
    { question: 'Bathroom being added?', type: 'choice', options: ['Full bath', 'Half bath', 'Wet bar only', 'No bathroom'] },
    { question: 'Ceiling height after finishing?', type: 'choice', options: ['Standard drywall (7–8 ft)', 'Drop ceiling', 'Exposed/industrial', 'Depends on ductwork'] },
    { question: 'Egress windows needed?', type: 'choice', options: ['Yes – need egress', 'Already have egress', 'No bedroom planned'] },
    { question: 'Additional notes?', type: 'text' },
  ],
  addition: [
    { question: 'What type of addition?', type: 'choice', options: ['Room addition', 'Garage addition', 'Sunroom/four-season', 'Second story', 'Bump-out'] },
    { question: 'Approximate square footage?', type: 'choice', options: ['Under 200 sqft', '200–400 sqft', '400–700 sqft', 'Over 700 sqft'] },
    { question: 'Foundation type?', type: 'choice', options: ['Slab on grade', 'Full basement', 'Crawl space', 'Cantilevered/engineered'] },
    { question: 'Will this have HVAC?', type: 'choice', options: ['Extend existing system', 'Mini-split', 'Radiant heat', 'No HVAC needed'] },
    { question: 'Exterior finish to match existing?', type: 'choice', options: ['Yes – match exactly', 'Similar but updated', 'Different accent material'] },
    { question: 'Additional notes?', type: 'text' },
  ],
}
