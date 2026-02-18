import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { SightingService, Sighting, CATEGORY_COLORS } from '../sighting.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private sightingService = inject(SightingService);

  readonly user = this.authService.currentUser;
  readonly isLoggedIn = this.authService.isLoggedIn;

  editMode = signal(false);
  editForm = signal({ username: '', email: '', role: '' });

  editSightingId = signal<string | null>(null);
  editSightingForm = signal<Partial<Sighting>>({});
  confirmDeleteId = signal<string | null>(null);

  avatarPreview = signal<string | null>(null);

  categories = ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Insect', 'Other'];
  behaviors = ['Resting', 'Feeding', 'Moving', 'Nesting', 'Swimming', 'Flying', 'Unknown'];
  roles = ['Student', 'Faculty', 'Staff'];

  readonly mySightings = computed(() => {
    const u = this.user();
    if (!u) return [];
    return this.sightingService.sightingsByUser(u.id);
  });

  readonly stats = computed(() => {
    const sightings = this.mySightings();
    const species = new Set(sightings.map((s) => s.animalName));
    const locations = new Set(sightings.map((s) => s.address));
    const categoryCounts = new Map<string, number>();
    for (const s of sightings) {
      categoryCounts.set(s.category, (categoryCounts.get(s.category) || 0) + 1);
    }
    let topCategory = 'N/A';
    let topCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > topCount) {
        topCategory = cat;
        topCount = count;
      }
    }
    return {
      total: sightings.length,
      uniqueSpecies: species.size,
      uniqueLocations: locations.size,
      topCategory,
    };
  });

  categoryColor(cat: string): string {
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];
  }

  startEditProfile() {
    const u = this.user();
    if (!u) return;
    this.editForm.set({ username: u.username, email: u.email, role: u.role });
    this.avatarPreview.set(u.avatarUrl);
    this.editMode.set(true);
  }

  cancelEditProfile() {
    this.editMode.set(false);
    this.avatarPreview.set(null);
  }

  saveProfile() {
    const form = this.editForm();
    this.authService.updateProfile({
      username: form.username,
      email: form.email,
      role: form.role,
      avatarUrl: this.avatarPreview(),
    });
    this.editMode.set(false);
  }

  onAvatarSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.readFile(input.files[0]);
    }
  }

  onAvatarDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.readFile(file);
      }
    }
  }

  onAvatarDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  private readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  updateEditForm(field: string, value: string) {
    this.editForm.set({ ...this.editForm(), [field]: value });
  }

  // Sighting editing
  startEditSighting(s: Sighting) {
    this.editSightingId.set(s.id);
    this.editSightingForm.set({
      animalName: s.animalName,
      category: s.category,
      quantity: s.quantity,
      behavior: s.behavior,
      description: s.description,
    });
  }

  cancelEditSighting() {
    this.editSightingId.set(null);
  }

  saveEditSighting() {
    const id = this.editSightingId();
    if (!id) return;
    this.sightingService.update(id, this.editSightingForm());
    this.editSightingId.set(null);
  }

  updateSightingField(field: string, value: string | number) {
    this.editSightingForm.set({ ...this.editSightingForm(), [field]: value });
  }

  // Delete with confirmation
  requestDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  cancelDelete() {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(id: string) {
    this.sightingService.remove(id);
    this.confirmDeleteId.set(null);
  }

  logout() {
    this.authService.logout();
  }
}
