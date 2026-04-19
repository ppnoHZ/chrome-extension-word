<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getAll, set, update } from '@/shared/storage';
import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';
import type { Category, Collection, Word } from '@/shared/types';

const enabled = ref(true);
const categories = ref<Category[]>([]);
const words = ref<Word[]>([]);
const collections = ref<Collection[]>([]);
const newWord = ref('');
const selectedCategory = ref('default');

onMounted(async () => {
  const all = await getAll();
  enabled.value = all.enabled;
  categories.value = all.categories;
  words.value = all.words;
  collections.value = all.collections.slice(0, 5);
  if (categories.value[0]) selectedCategory.value = categories.value[0].id;
});

const recent = computed(() => collections.value.slice(0, 5));

async function toggle() {
  enabled.value = !enabled.value;
  await set('enabled', enabled.value);
  await send({ type: 'toggleEnabled', enabled: enabled.value });
  await send({ type: 'wordsUpdated' });
}

async function addWord() {
  const text = newWord.value.trim();
  if (!text) return;
  await update('words', (cur) => [
    { text, categoryId: selectedCategory.value, addedAt: Date.now() },
    ...cur.filter((w) => w.text.toLowerCase() !== text.toLowerCase()),
  ]);
  newWord.value = '';
  const all = await getAll();
  words.value = all.words;
  await send({ type: 'wordsUpdated' });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}
</script>

<template>
  <div class="popup">
    <header>
      <h1>{{ t('actionTitle') }}</h1>
      <button class="toggle" :class="{ on: enabled }" @click="toggle">
        {{ enabled ? t('popup_on') : t('popup_off') }}
      </button>
    </header>

    <section>
      <div class="row">
        <input
          v-model="newWord"
          :placeholder="t('popup_addWordPlaceholder')"
          @keydown.enter="addWord"
        />
        <select v-model="selectedCategory">
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
        <button @click="addWord">{{ t('popup_addButton') }}</button>
      </div>
      <p class="meta">{{ t('popup_wordsTracked', String(words.length)) }}</p>
    </section>

    <section>
      <h2>{{ t('popup_recentCollections') }}</h2>
      <ul v-if="recent.length" class="recent">
        <li v-for="c in recent" :key="c.id">
          <div class="text">{{ c.text }}</div>
          <a class="src" :href="c.sourceUrl" target="_blank" rel="noopener">
            {{ c.sourceTitle || c.sourceUrl }}
          </a>
        </li>
      </ul>
      <p v-else class="meta">{{ t('popup_emptyHint') }}</p>
    </section>

    <footer>
      <button class="link" @click="openOptions">{{ t('popup_manageLink') }}</button>
    </footer>
  </div>
</template>

<style>
:root { color-scheme: light dark; }
body { margin: 0; font: 13px/1.4 system-ui, sans-serif; }
.popup { width: 320px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
header { display: flex; justify-content: space-between; align-items: center; }
h1 { margin: 0; font-size: 14px; }
h2 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; opacity: 0.7; }
.toggle { border: 1px solid #888; background: #eee; padding: 2px 8px; border-radius: 10px; cursor: pointer; font-weight: 600; }
.toggle.on { background: #2e7d32; color: #fff; border-color: #2e7d32; }
.row { display: flex; gap: 4px; }
.row input { flex: 1; padding: 4px 6px; }
.row select { padding: 4px; }
.row button { padding: 2px 8px; cursor: pointer; }
.meta { margin: 4px 0 0; font-size: 11px; opacity: 0.7; }
.recent { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
.recent li { padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; }
.recent .text { font-weight: 600; }
.recent .src { font-size: 11px; opacity: 0.7; word-break: break-all; }
.link { background: none; border: none; color: #1565c0; cursor: pointer; padding: 0; font: inherit; }
kbd { background: #eee; border: 1px solid #ccc; border-radius: 3px; padding: 0 4px; font-size: 11px; }
</style>
