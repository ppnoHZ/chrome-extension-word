<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getAll, set, update } from '@/shared/storage';
import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';
import PopupHero from './components/PopupHero.vue';
import PopupQuickAdd from './components/PopupQuickAdd.vue';
import PopupRecentCollections from './components/PopupRecentCollections.vue';
import type { Category, Collection, Word } from '@/shared/types';

const enabled = ref(true);
const categories = ref<Category[]>([]);
const words = ref<Word[]>([]);
const collections = ref<Collection[]>([]);
const newWord = ref('');
const selectedCategory = ref('default');

// 登录状态
const isLoggedIn = ref(false);
const userName = ref<string>();
const userAvatar = ref<string>();
const pendingSyncCount = ref(0);

onMounted(async () => {
  const all = await getAll();
  enabled.value = all.enabled;
  categories.value = all.categories;
  words.value = all.words;
  collections.value = all.collections.slice(0, 5);
  if (categories.value[0]) selectedCategory.value = categories.value[0].id;
  
  // 获取登录状态
  try {
    const authStatus = await send({ type: 'getAuthStatus' });
    isLoggedIn.value = authStatus.isLoggedIn;
    userName.value = authStatus.user?.name;
    userAvatar.value = authStatus.user?.avatar;
    pendingSyncCount.value = authStatus.pendingSyncCount;
  } catch (err) {
    console.error('[Word Learn] Failed to get auth status:', err);
  }
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
  <div class="popup-shell">
    <PopupHero
      :enabled="enabled"
      :words-count="words.length"
      :collections-count="recent.length"
      :is-logged-in="isLoggedIn"
      :user-name="userName"
      :user-avatar="userAvatar"
      :pending-sync-count="pendingSyncCount"
      @toggle="toggle"
      @open-options="openOptions"
    />

    <PopupQuickAdd
      :value="newWord"
      :selected-category="selectedCategory"
      :categories="categories"
      :words-count="words.length"
      :placeholder="t('popup_addWordPlaceholder')"
      :submit-text="t('popup_addButton')"
      @update:value="newWord = $event"
      @update:selected-category="selectedCategory = $event"
      @submit="addWord"
    />

    <PopupRecentCollections :recent="recent" :empty-text="t('popup_emptyHint')" />
  </div>
</template>

<style>
:root {
  color-scheme: light;
  --popup-accent: #1677ff;
  --popup-text: #1f2937;
  --popup-muted: #667085;
  --popup-bg: radial-gradient(circle at top right, rgba(22, 119, 255, 0.12), transparent 36%), linear-gradient(180deg, #f6f8fc 0%, #eef2f7 100%);
}

body {
  margin: 0;
  font: 13px/1.5 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--popup-bg);
}

#app {
  min-width: 360px;
}

.popup-shell {
  width: 360px;
  box-sizing: border-box;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
