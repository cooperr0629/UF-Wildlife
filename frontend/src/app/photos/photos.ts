import { Component, inject, computed } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { SightingService, CATEGORY_COLORS } from '../sighting.service';

@Component({
  selector: 'app-photos',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './photos.html',
  styleUrl: './photos.css',
})
export class PhotosComponent {
  private sightingService = inject(SightingService);

  readonly grouped = this.sightingService.groupedByCategory;
  readonly isEmpty = computed(() => this.sightingService.sightings().length === 0);

  color(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  }
}
