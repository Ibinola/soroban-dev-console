// frontend/stores/settings.store.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type LayoutDensity = 'compact' | 'comfortable';

export const useSettingsStore = defineStore('settings', () => {
  const density = ref<LayoutDensity>(
    (localStorage.getItem('workspace_density') as LayoutDensity) || 'comfortable'
  );

  function setDensity(newDensity: LayoutDensity) {
    density.value = newDensity;
    localStorage.setItem('workspace_density', newDensity);
  }

  return {
    density,
    setDensity,
  };
});