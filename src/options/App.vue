<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getAll, set, update } from '@/shared/storage';
import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';
import type { Category, Collection, Word, DictApiType } from '@/shared/types';

const categories = ref<Category[]>([]);
const words = ref<Word[]>([]);
const collections = ref<Collection[]>([]);
const tab = ref<'words' | 'categories' | 'collections' | 'settings'>('words');

const newCatName = ref('');
const newCatColor = ref('#90caf9');

const newWordText = ref('');
const newWordCat = ref('default');

// 设置相关
const dictApi = ref<DictApiType>('auto');
const cacheCount = ref(0);

onMounted(() => void reload());

async function reload() {
  const all = await getAll();
  categories.value = all.categories;
  words.value = all.words;
  collections.value = all.collections;
  dictApi.value = all.dictApi || 'auto';
  cacheCount.value = Object.keys(all.dictCache || {}).length;
  if (categories.value[0]) newWordCat.value = categories.value[0].id;
}

const wordsByCategory = computed(() => {
  const map = new Map<string, Word[]>();
  for (const w of words.value) {
    const arr = map.get(w.categoryId) ?? [];
    arr.push(w);
    map.set(w.categoryId, arr);
  }
  return map;
});

function categoryName(id?: string): string {
  if (!id) return '—';
  return categories.value.find((c) => c.id === id)?.name ?? id;
}

async function addCategory() {
  const name = newCatName.value.trim();
  if (!name) return;
  const id = crypto.randomUUID();
  await update('categories', (cur) => [...cur, { id, name, color: newCatColor.value }]);
  newCatName.value = '';
  await reload();
  await send({ type: 'wordsUpdated' });
}

async function updateCategoryColor(id: string, color: string) {
  await update('categories', (cur) =>
    cur.map((c) => (c.id === id ? { ...c, color } : c)),
  );
  await reload();
  await send({ type: 'wordsUpdated' });
}

async function deleteCategory(id: string) {
  if (id === 'default') return;
  await update('categories', (cur) => cur.filter((c) => c.id !== id));
  // Reassign orphaned words to default
  await update('words', (cur) =>
    cur.map((w) => (w.categoryId === id ? { ...w, categoryId: 'default' } : w)),
  );
  await reload();
  await send({ type: 'wordsUpdated' });
}

async function addWord() {
  const text = newWordText.value.trim();
  if (!text) return;
  await update('words', (cur) => [
    { text, categoryId: newWordCat.value, addedAt: Date.now() },
    ...cur.filter((w) => w.text.toLowerCase() !== text.toLowerCase()),
  ]);
  newWordText.value = '';
  await reload();
  await send({ type: 'wordsUpdated' });
}

async function deleteWord(text: string) {
  await update('words', (cur) =>
    cur.filter((w) => w.text.toLowerCase() !== text.toLowerCase()),
  );
  await reload();
  await send({ type: 'wordsUpdated' });
}

async function moveWord(text: string, categoryId: string) {
  await update('words', (cur) =>
    cur.map((w) =>
      w.text.toLowerCase() === text.toLowerCase() ? { ...w, categoryId } : w,
    ),
  );
  await reload();
  await send({ type: 'wordsUpdated' });
}

async function deleteCollection(id: string) {
  await update('collections', (cur) => cur.filter((c) => c.id !== id));
  await reload();
}

async function promoteCollection(c: Collection) {
  const text = c.text.trim();
  if (!text) return;
  await update('words', (cur) => [
    { text, categoryId: c.categoryId ?? 'default', addedAt: Date.now() },
    ...cur.filter((w) => w.text.toLowerCase() !== text.toLowerCase()),
  ]);
  await reload();
  await send({ type: 'wordsUpdated' });
}

async function exportJson() {
  const all = await getAll();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `word-learn-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJson(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  if (Array.isArray(data.categories)) await set('categories', data.categories);
  if (Array.isArray(data.words)) await set('words', data.words);
  if (Array.isArray(data.collections)) await set('collections', data.collections);
  await reload();
  await send({ type: 'wordsUpdated' });
}

// 设置相关函数
async function saveDictApi() {
  await set('dictApi', dictApi.value);
}

async function clearDictCache() {
  await set('dictCache', {});
  cacheCount.value = 0;
}
</script>

<template>
  <div class="page">
    <header>
      <h1>{{ t('options_title') }}</h1>
      <nav>
        <button :class="{ active: tab === 'words' }" @click="tab = 'words'">{{ t('options_tabWords') }} ({{ words.length }})</button>
        <button :class="{ active: tab === 'categories' }" @click="tab = 'categories'">{{ t('options_tabCategories') }} ({{ categories.length }})</button>
        <button :class="{ active: tab === 'collections' }" @click="tab = 'collections'">{{ t('options_tabCollections') }} ({{ collections.length }})</button>
        <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">{{ t('options_tabSettings') }}</button>
      </nav>
      <div class="actions">
        <button @click="exportJson">{{ t('options_export') }}</button>
        <label class="import-btn">
          {{ t('options_import') }}
          <input type="file" accept="application/json" @change="importJson" />
        </label>
      </div>
    </header>

    <main v-if="tab === 'words'">
      <form class="add" @submit.prevent="addWord">
        <input v-model="newWordText" :placeholder="t('options_wordPlaceholder')" />
        <select v-model="newWordCat">
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button type="submit">{{ t('options_addWord') }}</button>
      </form>

      <section v-for="cat in categories" :key="cat.id" class="cat-section">
        <h3>
          <span class="swatch" :style="{ background: cat.color }"></span>
          {{ cat.name }}
          <span class="count">({{ wordsByCategory.get(cat.id)?.length ?? 0 }})</span>
        </h3>
        <ul class="word-list">
          <li v-for="w in wordsByCategory.get(cat.id) ?? []" :key="w.text">
            <span class="word">{{ w.text }}</span>
            <select :value="w.categoryId" @change="moveWord(w.text, ($event.target as HTMLSelectElement).value)">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <button class="del" @click="deleteWord(w.text)">×</button>
          </li>
        </ul>
      </section>
    </main>

    <main v-else-if="tab === 'categories'">
      <form class="add" @submit.prevent="addCategory">
        <input v-model="newCatName" :placeholder="t('options_categoryNamePlaceholder')" />
        <input v-model="newCatColor" type="color" />
        <button type="submit">{{ t('options_addWord') }}</button>
      </form>
      <ul class="cat-list">
        <li v-for="c in categories" :key="c.id">
          <input
            type="color"
            :value="c.color"
            @change="updateCategoryColor(c.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="name">{{ c.name }}</span>
          <button v-if="c.id !== 'default'" class="del" @click="deleteCategory(c.id)">{{ t('options_delete') }}</button>
        </li>
      </ul>
    </main>

    <main v-else-if="tab === 'collections'">
      <ul class="collection-list">
        <li v-for="c in collections" :key="c.id">
          <div class="text">{{ c.text }}</div>
          <div v-if="c.context" class="context">{{ c.context }}</div>
          <div class="meta">
            <a :href="c.sourceUrl" target="_blank" rel="noopener">{{ c.sourceTitle || c.sourceUrl }}</a>
            <span>· {{ new Date(c.collectedAt).toLocaleString() }}</span>
            <span>· {{ categoryName(c.categoryId) }}</span>
          </div>
          <div class="row">
            <button @click="promoteCollection(c)">{{ t('options_promote') }}</button>
            <button class="del" @click="deleteCollection(c.id)">{{ t('options_delete') }}</button>
          </div>
        </li>
        <li v-if="!collections.length" class="empty">{{ t('options_noCollections') }}</li>
      </ul>
    </main>

    <main v-else-if="tab === 'settings'">
      <section class="settings-section">
        <h2>{{ t('settings_dictApi') }}</h2>
        <p class="desc">{{ t('settings_dictApiDesc') }}</p>
        <div class="setting-row">
          <select v-model="dictApi" @change="saveDictApi">
            <option value="auto">{{ t('settings_apiAuto') }}</option>
            <option value="youdao">{{ t('settings_apiYoudao') }}</option>
            <option value="iciba">{{ t('settings_apiIciba') }}</option>
            <option value="freedict">{{ t('settings_apiFreeDictionary') }}</option>
          </select>
        </div>
      </section>

      <section class="settings-section">
        <h2>{{ t('settings_cache') }}</h2>
        <p class="desc">{{ t('settings_cacheDesc', String(cacheCount)) }}</p>
        <div class="setting-row">
          <button @click="clearDictCache">{{ t('settings_clearCache') }}</button>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
:root { color-scheme: light dark; }
body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: #fafafa; }
.page { max-width: 900px; margin: 0 auto; padding: 24px; }
header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
header h1 { margin: 0; font-size: 20px; }
nav { display: flex; gap: 4px; }
nav button { background: none; border: 1px solid #ccc; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
nav button.active { background: #1565c0; color: #fff; border-color: #1565c0; }
.actions { margin-left: auto; display: flex; gap: 8px; }
.actions button, .import-btn { background: #fff; border: 1px solid #ccc; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
.import-btn input { display: none; }
.add { display: flex; gap: 6px; margin-bottom: 16px; }
.add input[type=text], .add input:not([type]) { flex: 1; padding: 4px 8px; }
.cat-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
.cat-section h3 { margin: 0 0 8px; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.15); }
.count { opacity: 0.6; font-weight: normal; }
.word-list, .cat-list, .collection-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.word-list li { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 4px; }
.word-list li:hover { background: #f0f0f0; }
.word-list .word { flex: 1; }
.cat-list li { display: flex; align-items: center; gap: 12px; padding: 8px; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; }
.cat-list .name { flex: 1; font-weight: 600; }
.collection-list li { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.collection-list .text { font-weight: 600; font-size: 15px; }
.collection-list .context { color: #555; font-style: italic; margin: 4px 0; font-size: 13px; }
.collection-list .meta { font-size: 12px; opacity: 0.7; display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.collection-list .meta a { color: #1565c0; word-break: break-all; }
.collection-list .row { display: flex; gap: 6px; }
.collection-list .row button { padding: 2px 8px; cursor: pointer; }
.collection-list .empty { text-align: center; opacity: 0.6; padding: 32px; }
.del { background: #fff; border: 1px solid #c62828; color: #c62828; border-radius: 3px; cursor: pointer; padding: 0 6px; }
.settings-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
.settings-section h2 { margin: 0 0 8px; font-size: 16px; }
.settings-section .desc { margin: 0 0 12px; font-size: 13px; color: #666; }
.setting-row { display: flex; gap: 8px; align-items: center; }
.setting-row select { padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; min-width: 200px; }
.setting-row button { padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
.setting-row button:hover { background: #f5f5f5; }
</style>
