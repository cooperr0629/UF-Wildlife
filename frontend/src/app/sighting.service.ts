import { Injectable, signal, computed } from '@angular/core';

export interface Sighting {
  id: string;
  userId: string;
  username: string;
  latitude: number;
  longitude: number;
  address: string;
  animalName: string;
  category: string;
  quantity: number;
  behavior: string;
  description: string;
  date: string;
  time: string;
  photoUrl: string | null;
  likeCount?: number;
  distanceMeters?: number;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Mammal: '#E53935',
  Bird: '#1E88E5',
  Reptile: '#43A047',
  Amphibian: '#8E24AA',
  Fish: '#00ACC1',
  Insect: '#FFB300',
  Other: '#757575',
};


export const SPECIES_BY_CATEGORY: Record<string, string[]> = {
  Mammal: ['Eastern Gray Squirrel', 'Armadillo', 'White-tailed Deer', 'Raccoon', 'Virginia Opossum', 'River Otter', 'Bobcat', 'Florida Black Bear'],
  Bird: ['Sandhill Crane', 'Anhinga', 'Great Blue Heron', 'Osprey', 'Red-shouldered Hawk', 'Barred Owl', 'Turkey Vulture', 'Wild Turkey', 'Wood Stork', 'Limpkin', 'Double-crested Cormorant'],
  Reptile: ['American Alligator', 'Gopher Tortoise', 'Green Anole', 'Brown Anole', 'Florida Softshell Turtle', 'Florida Cottonmouth', 'Eastern Diamondback Rattlesnake', 'Banded Water Snake'],
  Amphibian: ['Southern Toad', 'Green Tree Frog', 'Cuban Tree Frog', 'Pig Frog', 'Eastern Narrowmouth Toad'],
  Fish: ['Largemouth Bass', 'Bluegill', 'Florida Gar', 'Bowfin', 'Common Carp', 'Channel Catfish'],
  Insect: ['Monarch Butterfly', 'Zebra Longwing', 'Giant Swallowtail', 'Love Bug', 'Eastern Lubber Grasshopper', 'Eastern Lubber Grasshopper'],
  Other: [],
};

export interface SpeciesInfo {
  description: string;
  habitat: string;
  diet: string;
  activity: string;
  funFact: string;
}

export const SPECIES_INFO: Record<string, SpeciesInfo> = {
  // Mammals
  'Eastern Gray Squirrel': {
    description: 'One of UF\'s most recognizable residents, often seen darting across lawns and leaping between oak trees.',
    habitat: 'Forests, parks, and urban green spaces with mature trees',
    diet: 'Acorns, seeds, nuts, fungi, and occasionally bird eggs',
    activity: 'Diurnal — most active in early morning and late afternoon',
    funFact: 'They cache thousands of nuts each fall and use spatial memory to relocate them months later.',
  },
  'Armadillo': {
    description: 'The nine-banded armadillo is Florida\'s only armored mammal, commonly spotted rooting through leaf litter on campus.',
    habitat: 'Woodlands, scrublands, and suburban yards with loose soil',
    diet: 'Insects, grubs, worms, and small vertebrates',
    activity: 'Nocturnal to crepuscular; often active around dusk',
    funFact: 'Armadillos almost always give birth to identical quadruplets from a single fertilized egg.',
  },
  'White-tailed Deer': {
    description: 'Graceful browsers that occasionally wander onto campus from surrounding natural areas, especially at dawn and dusk.',
    habitat: 'Forest edges, wetland margins, and suburban greenbelts',
    diet: 'Grasses, leaves, acorns, fruits, and agricultural crops',
    activity: 'Crepuscular — most active at sunrise and sunset',
    funFact: 'Bucks shed and regrow their antlers every year; velvet-covered antlers are among the fastest-growing tissues in the animal kingdom.',
  },
  'Raccoon': {
    description: 'Highly intelligent and adaptable, raccoons thrive on the UF campus and are often spotted near water or rummaging through trash.',
    habitat: 'Forests, wetlands, and urban/suburban environments',
    diet: 'Omnivorous — fruits, nuts, insects, crayfish, small animals, and human food waste',
    activity: 'Nocturnal, though daytime sightings are common',
    funFact: 'Raccoons have highly dexterous front paws and can open latches, jars, and even doorknobs.',
  },
  'Virginia Opossum': {
    description: 'North America\'s only marsupial, the opossum is a nocturnal scavenger that plays a vital role cleaning up carrion and ticks.',
    habitat: 'Woodlands, forest edges, and suburban areas near water',
    diet: 'Carrion, insects, fruits, snails, and small vertebrates',
    activity: 'Strictly nocturnal',
    funFact: 'Playing dead ("playing possum") is an involuntary physiological response — the opossum actually faints from fear and can remain motionless for hours.',
  },
  'River Otter': {
    description: 'Sleek and playful, river otters can be spotted along Paynes Prairie and the waterways near UF, often sliding and wrestling.',
    habitat: 'Rivers, lakes, swamps, and coastal marshes',
    diet: 'Fish, crayfish, frogs, turtles, and aquatic invertebrates',
    activity: 'Active day and night, most visible at dawn and dusk',
    funFact: 'River otters can close their nostrils and ears while diving, and hold their breath for up to 8 minutes.',
  },
  'Bobcat': {
    description: 'Florida\'s only wild cat, the bobcat is an elusive predator occasionally seen at the forest edges surrounding UF.',
    habitat: 'Forests, swamps, scrublands, and suburban-rural interfaces',
    diet: 'Rabbits, squirrels, birds, deer fawns, and reptiles',
    activity: 'Crepuscular and nocturnal',
    funFact: 'Bobcats are solitary and territorial — a single cat\'s home range can span over 30 square miles.',
  },
  'Florida Black Bear': {
    description: 'Florida\'s largest land mammal and the state\'s only bear species. Rarely seen on campus but present in nearby natural areas.',
    habitat: 'Forests, swamps, and scrub habitats of North Central Florida',
    diet: 'Omnivorous — berries, acorns, insects, honey, and occasionally small animals',
    activity: 'Crepuscular to nocturnal; may be active during the day',
    funFact: 'Florida black bears can smell food from over a mile away and have been known to identify individual cars associated with food.',
  },

  // Birds
  'Sandhill Crane': {
    description: 'A iconic sight on UF campus — large, grey cranes that strut fearlessly across roads and plazas, often in family groups.',
    habitat: 'Open grasslands, wetland edges, and golf courses',
    diet: 'Seeds, tubers, insects, small vertebrates, and berries',
    activity: 'Diurnal',
    funFact: 'Sandhill cranes mate for life and perform elaborate dancing displays during courtship. Their calls can carry over 2 miles.',
  },
  'Anhinga': {
    description: 'Known as the "snakebird" for its long, sinuous neck. Commonly seen perched with wings spread wide to dry in the sun.',
    habitat: 'Freshwater lakes, swamps, and slow-moving rivers',
    diet: 'Fish, caught by spearing underwater with its pointed beak',
    activity: 'Diurnal',
    funFact: 'Unlike most water birds, anhingas lack waterproof feathers — they must dry their wings after every dive or they cannot fly.',
  },
  'Great Blue Heron': {
    description: 'The largest heron in North America, often seen standing motionless at water\'s edge waiting to ambush fish.',
    habitat: 'Wetlands, lake shores, rivers, and coastal areas',
    diet: 'Fish, frogs, small mammals, and reptiles',
    activity: 'Diurnal, occasionally active at dusk',
    funFact: 'Great blue herons have a specialized neck vertebra that acts like a spring, allowing them to strike prey at lightning speed.',
  },
  'Osprey': {
    description: 'A spectacular fishing raptor, the osprey dives feet-first into water to catch fish and is frequently seen near UF\'s ponds.',
    habitat: 'Lakeshores, rivers, estuaries, and coastal areas',
    diet: 'Almost exclusively live fish',
    activity: 'Diurnal',
    funFact: 'Ospreys reverse their outer toe to carry fish headfirst, reducing wind resistance during flight.',
  },
  'Red-shouldered Hawk': {
    description: 'A vocal and common raptor of UF\'s wooded areas, often heard before it is seen with its piercing "kee-aah" call.',
    habitat: 'Mature forests, especially near water',
    diet: 'Small mammals, frogs, lizards, snakes, and crayfish',
    activity: 'Diurnal',
    funFact: 'Blue jays frequently mimic the red-shouldered hawk\'s call, possibly to scare off other birds from food sources.',
  },
  'Barred Owl': {
    description: 'A stocky, dark-eyed owl whose haunting "Who cooks for you?" call echoes through campus forests at night.',
    habitat: 'Dense forests, especially near wetlands and streams',
    diet: 'Small mammals, frogs, crayfish, birds, and invertebrates',
    activity: 'Nocturnal, occasionally active at dawn and dusk',
    funFact: 'Barred owls swallow prey whole and later regurgitate compact pellets of fur and bones.',
  },
  'Turkey Vulture': {
    description: 'Large black scavengers that soar on thermals over campus with wings held in a characteristic "V" shape.',
    habitat: 'Open country, forests, roadsides, and suburban areas',
    diet: 'Carrion — almost exclusively dead animals',
    activity: 'Diurnal',
    funFact: 'Turkey vultures locate carrion primarily by smell, a rare trait among birds. Their stomach acid is so strong it destroys anthrax and botulism.',
  },
  'Wild Turkey': {
    description: 'Florida\'s largest ground bird, wild turkeys roam campus woodlands in small flocks, often surprising visitors.',
    habitat: 'Forests, forest edges, and open woodlands',
    diet: 'Seeds, nuts, berries, insects, and small vertebrates',
    activity: 'Diurnal',
    funFact: 'Male turkeys (toms) can run at 25 mph and fly at speeds up to 55 mph for short distances.',
  },
  'Wood Stork': {
    description: 'A large, bald-headed wading bird and Florida\'s only native stork species, listed as threatened due to habitat loss.',
    habitat: 'Wetlands, swamps, and flooded fields',
    diet: 'Fish and aquatic invertebrates, caught by tactile touch-sensing',
    activity: 'Diurnal',
    funFact: 'Wood storks feed by touch — they sweep their open bill through water and snap it shut in 25 milliseconds when prey is detected.',
  },
  'Limpkin': {
    description: 'A wading bird with a haunting wail, the limpkin is closely associated with apple snails in Florida\'s wetlands.',
    habitat: 'Freshwater marshes, swamps, and stream margins',
    diet: 'Primarily apple snails; also mussels, frogs, and insects',
    activity: 'Crepuscular and nocturnal',
    funFact: 'Limpkins have a specialized bill twisted to the right to extract apple snails from their shells without breaking them.',
  },
  'Double-crested Cormorant': {
    description: 'Dark, fish-eating waterbirds that roost in large groups near campus lakes, often seen drying their wings like anhingas.',
    habitat: 'Lakes, rivers, estuaries, and coastal waters',
    diet: 'Fish, caught by pursuit diving',
    activity: 'Diurnal',
    funFact: 'Cormorants can dive to 24 feet and swim underwater using both their feet and wings to chase fish.',
  },

  // Reptiles
  'American Alligator': {
    description: 'Florida\'s apex predator and a top attraction at UF. Gators are regularly spotted in campus ponds and retention areas.',
    habitat: 'Freshwater lakes, ponds, rivers, swamps, and wetlands',
    diet: 'Fish, turtles, birds, mammals, and occasionally carrion',
    activity: 'Ectothermic — basks during the day; hunts at dawn, dusk, and night',
    funFact: 'Alligators are living fossils — they have changed little in 37 million years and survived the extinction that killed the dinosaurs.',
  },
  'Gopher Tortoise': {
    description: 'A keystone species of Florida\'s sandhill ecosystems, the gopher tortoise digs burrows shared by over 350 other species.',
    habitat: 'Dry uplands, sandhills, scrub, and well-drained flatwoods',
    diet: 'Low-growing plants, grasses, fruits, and mushrooms',
    activity: 'Diurnal',
    funFact: 'Gopher tortoise burrows can be 40 feet long and 10 feet deep, and provide shelter for animals including indigo snakes, rabbits, and burrowing owls.',
  },
  'Green Anole': {
    description: 'Florida\'s only native anole, the green anole can change from bright green to brown and displays a pink throat fan (dewlap).',
    habitat: 'Shrubs, trees, and vegetation in gardens and forest edges',
    diet: 'Insects, spiders, and small invertebrates',
    activity: 'Diurnal',
    funFact: 'Male green anoles perform push-up displays and flash their pink dewlap to attract mates and warn rival males.',
  },
  'Brown Anole': {
    description: 'An invasive species from Cuba that has largely displaced the native green anole across much of Florida, very common on campus.',
    habitat: 'Ground level vegetation, fences, sidewalk edges, and low shrubs',
    diet: 'Insects, spiders, and small invertebrates',
    activity: 'Diurnal',
    funFact: 'Brown anoles have driven green anoles to adapt — green anoles now perch higher in trees to avoid competition, a visible example of rapid evolution.',
  },
  'Florida Softshell Turtle': {
    description: 'Distinguished by its flat, leathery shell and long snorkel-like nose, this turtle is common in UF\'s campus ponds.',
    habitat: 'Freshwater ponds, lakes, rivers, and canals with soft sandy bottoms',
    diet: 'Fish, frogs, crayfish, snails, and aquatic insects',
    activity: 'Diurnal',
    funFact: 'Softshell turtles can breathe partially through their skin while buried in sand, allowing them to stay submerged for extended periods.',
  },
  'Florida Cottonmouth': {
    description: 'Also called the water moccasin, the cottonmouth is Florida\'s only venomous water snake. Respect its space near water.',
    habitat: 'Swamps, marshes, lake edges, slow streams, and wet flatwoods',
    diet: 'Fish, frogs, small mammals, birds, and other snakes',
    activity: 'Active day and night; more nocturnal in summer',
    funFact: 'The cottonmouth gets its name from the white interior of its mouth, which it displays as a warning before striking.',
  },
  'Eastern Diamondback Rattlesnake': {
    description: 'The largest venomous snake in North America and a rare but present species in UF\'s surrounding natural habitats.',
    habitat: 'Dry pine flatwoods, sandhills, and palmetto scrub',
    diet: 'Rabbits, squirrels, rats, and birds',
    activity: 'Diurnal in spring and fall; crepuscular and nocturnal in summer',
    funFact: 'Diamondbacks can accurately sense body heat from prey up to 1.5 feet away using heat-sensitive pit organs between their eyes and nostrils.',
  },
  'Banded Water Snake': {
    description: 'A non-venomous, semi-aquatic snake common near UF\'s retention ponds. Often mistaken for the cottonmouth — look for a round pupil.',
    habitat: 'Freshwater wetlands, lakes, ponds, streams, and drainage ditches',
    diet: 'Fish, frogs, salamanders, and crayfish',
    activity: 'Active day and night',
    funFact: 'When threatened, banded water snakes flatten their body to appear larger, and release a foul musk — but they are completely harmless to humans.',
  },

  // Amphibians
  'Southern Toad': {
    description: 'Florida\'s most common toad, the southern toad is a familiar nighttime presence on UF campus, especially after rain.',
    habitat: 'Sandy uplands, suburban yards, forest edges, and disturbed areas',
    diet: 'Insects, spiders, worms, and small invertebrates',
    activity: 'Nocturnal',
    funFact: 'Southern toads produce a mild toxin from glands behind their eyes that makes them unpalatable to most predators.',
  },
  'Green Tree Frog': {
    description: 'Florida\'s state frog — a bright green, sticky-footed climber whose loud "quank" chorus signals summer rainstorms.',
    habitat: 'Vegetation near ponds, swamps, and streams; also suburban windows and walls',
    diet: 'Insects, especially moths, flies, and beetles attracted to lights',
    activity: 'Nocturnal',
    funFact: 'Green tree frogs are attracted to the insects that gather around artificial lights, making porches and outdoor walls prime hunting spots.',
  },
  'Cuban Tree Frog': {
    description: 'An invasive species from Cuba and the largest tree frog in North America. Highly adaptable and a threat to native frogs.',
    habitat: 'Urban and suburban areas, vegetation around buildings, and wooded areas',
    diet: 'Insects, small lizards, and even smaller native tree frogs',
    activity: 'Nocturnal',
    funFact: 'Cuban tree frogs secrete a skin mucus that causes intense eye irritation in humans — always wash your hands after handling.',
  },
  'Pig Frog': {
    description: 'Named for its oink-like grunt, the pig frog is a large aquatic frog common in Florida\'s wetlands.',
    habitat: 'Open water of lakes, marshes, and prairie ponds with floating vegetation',
    diet: 'Insects, crayfish, small frogs, and aquatic invertebrates',
    activity: 'Nocturnal',
    funFact: 'Pig frogs are often hunted for their legs, which are eaten in Southern cuisine. Their "grunt" call can be heard from over a mile away.',
  },
  'Eastern Narrowmouth Toad': {
    description: 'A tiny, secretive toad with a narrow, pointed head. Rarely seen but often heard after heavy summer rains.',
    habitat: 'Moist areas under logs, leaf litter, and rocks near water',
    diet: 'Ants and other small insects',
    activity: 'Nocturnal, emerging mainly after heavy rain',
    funFact: 'Eastern narrowmouth toads have a symbiotic relationship with American alligators — they eat the insects attracted to gator nests and may be protected from predation.',
  },

  // Fish
  'Largemouth Bass': {
    description: 'Florida\'s most prized game fish, the largemouth bass thrives in the warm, vegetation-rich waters of UF-area lakes.',
    habitat: 'Warm, slow-moving water with aquatic vegetation and structure',
    diet: 'Fish, crayfish, frogs, insects, and occasionally small birds',
    activity: 'Crepuscular; most actively feeds at dawn and dusk',
    funFact: 'Florida largemouth bass are a distinct subspecies and can grow larger than anywhere else in the world — the state record is 17.27 lbs.',
  },
  'Bluegill': {
    description: 'The most common sunfish in Florida, bluegill are abundant in campus ponds and are often the first fish children ever catch.',
    habitat: 'Ponds, lakes, and slow streams with aquatic vegetation',
    diet: 'Insects, worms, small crustaceans, and aquatic plants',
    activity: 'Diurnal',
    funFact: 'Male bluegill fan out circular nests in sandy lake bottoms and aggressively guard eggs for weeks, fanning them with their fins to provide oxygen.',
  },
  'Florida Gar': {
    description: 'An ancient, torpedo-shaped predator with a long, tooth-filled snout. A living fossil in Florida\'s waterways.',
    habitat: 'Lakes, rivers, swamps, and weedy backwaters',
    diet: 'Fish and crayfish, ambushed with a sideways snap',
    activity: 'Active day and night',
    funFact: 'Florida gars can breathe air using a modified swim bladder, allowing them to survive in oxygen-depleted, stagnant water.',
  },
  'Bowfin': {
    description: 'The last surviving member of an ancient fish lineage, the bowfin is a powerful predator found in Florida\'s sluggish waters.',
    habitat: 'Swamps, sluggish rivers, lakes, and vegetated backwaters',
    diet: 'Fish, crayfish, frogs, and aquatic insects',
    activity: 'Most active at night and in low light',
    funFact: 'Bowfins are air-breathers and one of the most ancient fish in North America, virtually unchanged for over 100 million years.',
  },
  'Common Carp': {
    description: 'An introduced species from Asia, carp are large, bottom-feeding fish that have become widespread in Florida\'s freshwaters.',
    habitat: 'Lakes, ponds, slow rivers, and muddy backwaters',
    diet: 'Aquatic plants, insects, worms, and organic sediment',
    activity: 'Diurnal and crepuscular',
    funFact: 'Carp can live for over 40 years and have been documented reaching over 100 lbs. They disrupt native aquatic ecosystems by stirring up sediment.',
  },
  'Channel Catfish': {
    description: 'A popular sport and food fish, channel catfish use sensitive barbels ("whiskers") to taste their way through muddy water.',
    habitat: 'Ponds, rivers, reservoirs, and canals with moderate current',
    diet: 'Invertebrates, fish, plant material, and carrion',
    activity: 'Nocturnal, though active during cloudy days',
    funFact: 'Channel catfish have over 25,000 taste buds distributed across their entire body — making their skin essentially one giant tongue.',
  },

  // Insects
  'Monarch Butterfly': {
    description: 'An iconic migratory butterfly that passes through Florida each fall, fueling on wildflowers before crossing to Mexico.',
    habitat: 'Open fields, meadows, roadsides, and gardens with milkweed',
    diet: 'Larvae eat milkweed exclusively; adults drink nectar from various flowers',
    activity: 'Diurnal',
    funFact: 'Monarch butterflies travel up to 3,000 miles to overwintering sites in Mexico, navigating using a combination of the sun\'s position and Earth\'s magnetic field.',
  },
  'Zebra Longwing': {
    description: 'Florida\'s state butterfly and a slow, graceful flier with striking black-and-yellow zebra stripes.',
    habitat: 'Hammocks, forest edges, and gardens with passionflower vines',
    diet: 'Larvae eat passionflower; adults collect pollen for protein — unusual among butterflies',
    activity: 'Diurnal',
    funFact: 'Zebra longwings are one of the only butterflies in the world that eat pollen, giving them a much longer lifespan (months vs. weeks) than most species.',
  },
  'Giant Swallowtail': {
    description: 'North America\'s largest butterfly, the giant swallowtail is a dramatic, slow-flapping visitor to UF\'s citrus trees and gardens.',
    habitat: 'Forest edges, citrus groves, gardens, and roadsides',
    diet: 'Larvae eat citrus leaves; adults drink nectar from large flowers',
    activity: 'Diurnal',
    funFact: 'Giant swallowtail caterpillars mimic bird droppings to avoid predation — brown, white, and mottled to perfection.',
  },
  'Love Bug': {
    description: 'Famous for appearing in massive swarms twice a year, love bugs are a quintessential Florida experience (and car-wash headache).',
    habitat: 'Roadsides, fields, and forest edges throughout Florida',
    diet: 'Adults barely eat; larvae feed on decomposing plant material',
    activity: 'Diurnal; active only during warm, sunny conditions',
    funFact: 'Love bugs spend most of their mated lives connected end-to-end. The female flies while dragging the male, who has already mated and is essentially dying.',
  },
  'Eastern Lubber Grasshopper': {
    description: 'The largest grasshopper in North America — bright yellow and black, nearly flightless, and very common in Florida yards and gardens.',
    habitat: 'Fields, roadsides, woodland edges, and suburban gardens',
    diet: 'Broad-leafed plants, grasses, and garden vegetation',
    activity: 'Diurnal',
    funFact: 'Eastern lubbers are toxic to many predators. When threatened, they hiss, spread their wings, and secrete a foul-smelling froth from their thorax.',
  },
};

const API_BASE = 'http://localhost:8080/api/sightings';

@Injectable({ providedIn: 'root' })
export class SightingService {
  private _sightings = signal<Sighting[]>([]);
  private _loaded = false;

  readonly sightings = this._sightings.asReadonly();

  constructor() {
    // Auto-load sightings from backend on service init
    this.loadAll();
  }

  readonly groupedByCategory = computed(() => {
    const map = new Map<string, Sighting[]>();
    for (const s of this._sightings()) {
      const cat = s.category || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return map;
  });

  async loadAll(category?: string): Promise<void> {
    try {
      const url = category ? `${API_BASE}?category=${encodeURIComponent(category)}` : API_BASE;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load sightings');
      const data: any[] = await res.json();
      this._loaded = true;
      const sightings: Sighting[] = data.map((row) => ({
        id: String(row.id),
        userId: String(row.user_id || ''),
        username: row.username || '',
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address || '',
        animalName: row.species,
        category: row.category || 'Other',
        quantity: row.quantity || 1,
        behavior: row.behavior || '',
        description: row.description || '',
        date: row.date || '',
        time: row.time || '',
        photoUrl: row.image_url || null,
        likeCount: row.like_count || 0,
      }));
      this._sightings.set(sightings);
    } catch (err) {
      console.error('Failed to load sightings:', err);
    }
  }

  async add(sighting: Sighting): Promise<void> {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: sighting.animalName,
          image_url: sighting.photoUrl || '',
          latitude: sighting.latitude,
          longitude: sighting.longitude,
          address: sighting.address,
          category: sighting.category,
          quantity: sighting.quantity,
          behavior: sighting.behavior,
          description: sighting.description,
          date: sighting.date,
          time: sighting.time,
          userId: sighting.userId,
          username: sighting.username,
        }),
      });
      if (!res.ok) throw new Error('Failed to create sighting');
      const data = await res.json();
      // Use the server-assigned ID
      this._sightings.update((list) => [
        ...list,
        { ...sighting, id: String(data.id) },
      ]);
    } catch (err) {
      console.error('Failed to add sighting:', err);
      // Fallback: add locally so the UI still updates
      this._sightings.update((list) => [...list, sighting]);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sighting');
    } catch (err) {
      console.error('Failed to remove sighting:', err);
    }
    this._sightings.update((list) => list.filter((s) => s.id !== id));
  }

  async update(id: string, data: Partial<Sighting>): Promise<void> {
    const current = this._sightings().find((s) => s.id === id);
    if (!current) return;

    const merged = { ...current, ...data };
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: merged.animalName,
          image_url: merged.photoUrl || '',
          latitude: merged.latitude,
          longitude: merged.longitude,
          address: merged.address,
          category: merged.category,
          quantity: merged.quantity,
          behavior: merged.behavior,
          description: merged.description,
          date: merged.date,
          time: merged.time,
        }),
      });
      if (!res.ok) throw new Error('Failed to update sighting');
    } catch (err) {
      console.error('Failed to update sighting:', err);
    }
    this._sightings.update((list) =>
      list.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  }

  sightingsByUser(userId: string): Sighting[] {
    return this._sightings().filter((s) => s.userId === userId);
  }

  async getLikes(sightingId: string, userId?: string): Promise<{ count: number; likedByMe: boolean }> {
    const url = userId
      ? `${API_BASE}/${sightingId}/likes?user_id=${encodeURIComponent(userId)}`
      : `${API_BASE}/${sightingId}/likes`;
    const res = await fetch(url);
    if (!res.ok) return { count: 0, likedByMe: false };
    const data = await res.json();
    return { count: data.count || 0, likedByMe: !!data.liked_by_me };
  }

  async toggleLike(sightingId: string, userId: string): Promise<{ liked: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/${sightingId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(userId, 10) }),
    });
    if (!res.ok) throw new Error('Failed to toggle like');
    const data = await res.json();
    // Sync local cached like_count so list views update immediately
    this._sightings.update((list) =>
      list.map((s) => (s.id === sightingId ? { ...s, likeCount: data.count } : s))
    );
    return { liked: !!data.liked, count: data.count || 0 };
  }

  async getStats(): Promise<{ totalSightings: number; totalUsers: number; byCategory: Record<string, number> }> {
    const res = await fetch('http://localhost:8080/api/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();
    return {
      totalSightings: data.total_sightings || 0,
      totalUsers: data.total_users || 0,
      byCategory: data.by_category || {},
    };
  }

  async getNearby(lat: number, lng: number, radius: number): Promise<Sighting[]> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(radius),
    });
    const res = await fetch(`${API_BASE}/nearby?${params}`);
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id || ''),
      username: row.username || '',
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address || '',
      animalName: row.species,
      category: row.category || 'Other',
      quantity: row.quantity || 1,
      behavior: row.behavior || '',
      description: row.description || '',
      date: row.date || '',
      time: row.time || '',
      photoUrl: row.image_url || null,
      likeCount: row.like_count || 0,
      distanceMeters: row.distance_meters || 0,
    }));
  }
}
