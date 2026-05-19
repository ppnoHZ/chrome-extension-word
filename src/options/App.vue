<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getAll, set, update } from '@/shared/storage';
import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';
import { authenticateWithGitHub, authenticateWithOAuth2, getAuthProviders, logout as logoutOAuth } from '@/shared/oauth';
import { CURRENT_BUILD_LABEL, DEFAULT_API_URL, resolveApiUrl, normalizeApiUrl } from '@/shared/runtime-config';
import type { AuthProvider } from '@/shared/oauth';
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

// 登录相关
const authProvider = ref<'none' | 'github' | 'custom'>('none');
const userInfo = ref<{ id: string; name?: string; email?: string; avatar?: string } | undefined>();
const isLoggingIn = ref(false);
const loginError = ref('');

// 后端地址覆盖
const apiUrl = ref('');

// 自动同步
const autoSync = ref(false);

// 可用的认证方式列表
const authProviders = ref<AuthProvider[]>([]);

const activeApiUrl = computed(() => resolveApiUrl(apiUrl.value));
const hasApiOverride = computed(() => Boolean(normalizeApiUrl(apiUrl.value)));

const settingsOverview = computed(() => [
  {
    key: 'words',
    label: '已收录单词',
    value: words.value.length,
    accent: '#1677ff',
  },
  {
    key: 'collections',
    label: '待整理收藏',
    value: collections.value.length,
    accent: '#13c2c2',
  },
  {
    key: 'cache',
    label: '词典缓存',
    value: cacheCount.value,
    accent: '#fa8c16',
  },
  {
    key: 'auth',
    label: '登录状态',
    value: userInfo.value ? '已连接' : '未登录',
    accent: '#52c41a',
  },
]);

onMounted(() => void reload());

async function reload() {
  const all = await getAll();
  categories.value = all.categories;
  words.value = all.words;
  collections.value = all.collections;
  dictApi.value = all.dictApi || 'auto';
  cacheCount.value = Object.keys(all.dictCache || {}).length;
  authProvider.value = (all.authProvider === 'github' || all.authProvider === 'custom') ? all.authProvider : 'none';
  userInfo.value = all.userInfo;
  apiUrl.value = all.apiUrl || '';
  autoSync.value = all.autoSync || false;
  if (categories.value[0]) newWordCat.value = categories.value[0].id;
  
  // 自动加载可用的认证方式
  authProviders.value = activeApiUrl.value ? await getAuthProviders(activeApiUrl.value) : [];
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

async function importJson(file: File) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (Array.isArray(data.categories)) await set('categories', data.categories);
    if (Array.isArray(data.words)) await set('words', data.words);
    if (Array.isArray(data.collections)) await set('collections', data.collections);
    await reload();
    await send({ type: 'wordsUpdated' });
    // returning false prevents default upload behavior
  } catch (err) {
    console.error('Import failed', err);
  }
  return false;
}

// 设置相关函数
async function saveDictApi() {
  await set('dictApi', dictApi.value);
}

async function clearDictCache() {
  await set('dictCache', {});
  cacheCount.value = 0;
}

async function resetApiUrlToDefault() {
  apiUrl.value = '';
  await saveBackendSettings();
}

// 保存后端设置
async function saveBackendSettings() {
  await set('apiUrl', normalizeApiUrl(apiUrl.value));
  await set('autoSync', autoSync.value);
  
  // 重新加载可用的认证方式
  await refreshAuthProviders();
}

// 刷新认证方式列表
async function refreshAuthProviders() {
  if (activeApiUrl.value) {
    authProviders.value = await getAuthProviders(activeApiUrl.value);
  } else {
    authProviders.value = [];
  }
}

// 登录相关函数
async function loginWithProvider(provider: AuthProvider) {
  if (!activeApiUrl.value.trim()) {
    loginError.value = '当前环境未配置后端 API 地址，请检查 .env 或设置页覆盖地址';
    return;
  }
  isLoggingIn.value = true;
  loginError.value = '';
  try {
    let result;
    if (provider.id === 'github') {
      result = await authenticateWithGitHub(activeApiUrl.value.trim());
    } else {
      result = await authenticateWithOAuth2(activeApiUrl.value.trim());
    }
    userInfo.value = result.user;
    authProvider.value = provider.id;
  } catch (err: any) {
    loginError.value = err.message || '登录失败';
  } finally {
    isLoggingIn.value = false;
  }
}

async function logout() {
  await logoutOAuth();
  authProvider.value = 'none';
  userInfo.value = undefined;
}
</script>

<template>
  <a-layout class="page-layout">
    <a-layout-header class="header">
      <div class="header-content">
        <h1>{{ t('options_title') }}</h1>
        <div class="actions">
          <a-button type="primary" @click="exportJson">{{ t('options_export') }}</a-button>
          <a-upload :show-upload-list="false" :before-upload="importJson" accept="application/json">
            <a-button>{{ t('options_import') }}</a-button>
          </a-upload>
        </div>
      </div>
    </a-layout-header>

    <a-layout-content class="main-content">
      <a-tabs v-model:activeKey="tab" class="main-tabs">
        <!-- Words Tab -->
        <a-tab-pane key="words" :tab="`${t('options_tabWords')} (${words.length})`">
          <section class="content-page">
            <a-card :bordered="false" class="section-hero section-hero--blue shadow-sm">
              <div class="section-hero__content">
                <div>
                  <p class="section-eyebrow">Vocabulary</p>
                  <h2 class="section-title">高频词库集中管理</h2>
                  <p class="section-desc">先快速录入，再按分类分发和调整颜色。每个分类卡片都保留就地迁移和删除操作，减少来回切换。</p>
                </div>
                <div class="section-badge-grid">
                  <div class="section-badge">
                    <span>总词数</span>
                    <strong>{{ words.length }}</strong>
                  </div>
                  <div class="section-badge">
                    <span>分类数</span>
                    <strong>{{ categories.length }}</strong>
                  </div>
                </div>
              </div>

              <a-form class="quick-form" @finish="addWord">
                <a-input v-model:value="newWordText" :placeholder="t('options_wordPlaceholder')" class="quick-form__input" />
                <a-select v-model:value="newWordCat" class="quick-form__select">
                  <a-select-option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</a-select-option>
                </a-select>
                <a-button type="primary" html-type="submit" :disabled="!newWordText.trim()" class="quick-form__button">{{ t('options_addWord') }}</a-button>
              </a-form>
            </a-card>

            <a-row :gutter="[16, 16]">
            <a-col :xs="24" :md="12" :lg="8" v-for="cat in categories" :key="cat.id">
              <a-card size="small" class="cat-card shadow-sm content-panel">
                <template #title>
                  <div class="cat-card__header">
                    <span class="swatch" :style="{ backgroundColor: cat.color }"></span>
                    <span>{{ cat.name }} ({{ wordsByCategory.get(cat.id)?.length ?? 0 }})</span>
                  </div>
                </template>
                <a-list size="small" :dataSource="wordsByCategory.get(cat.id) ?? []">
                  <template #renderItem="{ item }">
                    <a-list-item>
                      <span class="word-item__text">{{ item.text }}</span>
                      <a-select :value="item.categoryId" @change="moveWord(item.text, $event as string)" size="small" class="word-item__select">
                        <a-select-option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</a-select-option>
                      </a-select>
                      <a-button danger size="small" type="text" @click="deleteWord(item.text)">×</a-button>
                    </a-list-item>
                  </template>
                </a-list>
              </a-card>
            </a-col>
            </a-row>
          </section>
        </a-tab-pane>

        <!-- Categories Tab -->
        <a-tab-pane key="categories" :tab="`${t('options_tabCategories')} (${categories.length})`">
          <section class="content-page">
            <a-card :bordered="false" class="section-hero section-hero--sand shadow-sm">
              <div class="section-hero__content">
                <div>
                  <p class="section-eyebrow">Categories</p>
                  <h2 class="section-title">分类结构与颜色一屏管理</h2>
                  <p class="section-desc">分类名、色彩和清理操作放在同一区域，适合持续扩充词表时快速维护视觉规则。</p>
                </div>
              </div>

              <a-form class="quick-form quick-form--category" @finish="addCategory">
                <a-input v-model:value="newCatName" :placeholder="t('options_categoryNamePlaceholder')" class="quick-form__input" />
                <input v-model="newCatColor" type="color" class="color-picker" />
                <a-button type="primary" html-type="submit" :disabled="!newCatName.trim()" class="quick-form__button">新增分类</a-button>
              </a-form>
            </a-card>

            <a-list bordered :dataSource="categories" class="bg-white shadow-sm category-list">
            <template #renderItem="{ item }">
              <a-list-item>
                <div class="category-row">
                  <input type="color" :value="item.color" @change="updateCategoryColor(item.id, ($event.target as HTMLInputElement).value)" class="color-picker" />
                  <div class="category-row__main">
                    <span class="category-row__name">{{ item.name }}</span>
                    <span class="category-row__meta">{{ (wordsByCategory.get(item.id) ?? []).length }} 个单词</span>
                  </div>
                  <a-button v-if="item.id !== 'default'" danger @click="deleteCategory(item.id)">{{ t('options_delete') }}</a-button>
                </div>
              </a-list-item>
            </template>
            </a-list>
          </section>
        </a-tab-pane>

        <!-- Collections Tab -->
        <a-tab-pane key="collections" :tab="`${t('options_tabCollections')} (${collections.length})`">
          <section class="content-page">
            <a-card :bordered="false" class="section-hero section-hero--mint shadow-sm">
              <div class="section-hero__content">
                <div>
                  <p class="section-eyebrow">Collection</p>
                  <h2 class="section-title">从网页收集到词库整理的过渡区</h2>
                  <p class="section-desc">这里保留原始来源、采集时间和上下文片段，便于你判断哪些内容应该正式进入词库。</p>
                </div>
                <div class="section-badge-grid section-badge-grid--single">
                  <div class="section-badge">
                    <span>待整理条目</span>
                    <strong>{{ collections.length }}</strong>
                  </div>
                </div>
              </div>
            </a-card>

            <a-list v-if="collections.length" item-layout="vertical" :dataSource="collections" class="collection-list">
            <template #renderItem="{ item }">
              <a-list-item class="bg-white shadow-sm mb-4 collection-card">
                <template #actions>
                  <a-button type="primary" size="small" @click="promoteCollection(item)">{{ t('options_promote') }}</a-button>
                  <a-button danger size="small" @click="deleteCollection(item.id)">{{ t('options_delete') }}</a-button>
                </template>
                <a-list-item-meta>
                  <template #title>
                    <span class="collection-card__title">{{ item.text }}</span>
                  </template>
                  <template #description>
                    <div class="collection-card__meta">
                      <a :href="item.sourceUrl" target="_blank" rel="noopener">{{ item.sourceTitle || item.sourceUrl }}</a>
                      <span>· {{ new Date(item.collectedAt).toLocaleString() }}</span>
                      <span>· {{ categoryName(item.categoryId) }}</span>
                    </div>
                  </template>
                </a-list-item-meta>
                <div v-if="item.context" class="collection-card__context">
                  "{{ item.context }}"
                </div>
              </a-list-item>
            </template>
            </a-list>
            <a-card v-else :bordered="false" class="shadow-sm empty-panel">
              <a-empty :description="t('options_noCollections')" />
            </a-card>
          </section>
        </a-tab-pane>

        <!-- Settings Tab -->
        <a-tab-pane key="settings" :tab="t('options_tabSettings')">
          <section class="settings-page">
            <a-card :bordered="false" class="settings-hero shadow-sm">
              <div class="settings-hero__intro">
                <div>
                  <p class="section-eyebrow">Workspace</p>
                  <h2 class="settings-hero__title">集中管理同步、词典与账户状态</h2>
                  <p class="settings-hero__desc">
                    先配置后端与登录，再决定词典来源和缓存策略。页面按“连接能力”与“本地体验”分区，避免设置项分散。
                  </p>
                </div>
                <a-button @click="refreshAuthProviders">刷新连接状态</a-button>
              </div>

              <div class="settings-overview-grid">
                <div
                  v-for="item in settingsOverview"
                  :key="item.key"
                  class="settings-stat"
                  :style="{ '--accent': item.accent }"
                >
                  <span class="settings-stat__label">{{ item.label }}</span>
                  <strong class="settings-stat__value">{{ item.value }}</strong>
                </div>
              </div>
            </a-card>

            <div class="settings-grid">
              <div class="settings-column">
                <a-card title="连接与同步" class="settings-panel shadow-sm" :bordered="false">
                  <a-form layout="vertical" class="settings-form">
                    <a-form-item label="构建环境">
                      <div class="build-mode-card">
                        <div>
                          <div class="build-mode-card__title">{{ CURRENT_BUILD_LABEL }}</div>
                          <div class="build-mode-card__desc">默认后端地址由 Vite env 注入，开发和生产在构建时自动区分。</div>
                        </div>
                        <a-tag color="blue">{{ CURRENT_BUILD_LABEL }}</a-tag>
                      </div>
                      <p class="field-hint">
                        当前 env 默认地址：{{ DEFAULT_API_URL || '未配置' }}。
                        开发环境建议在 <code>.env.development</code> 中使用 <code>http://localhost:8000</code>。
                      </p>
                    </a-form-item>
                    <a-form-item label="后端 API 地址覆盖">
                      <div class="settings-inline-field">
                        <a-input
                          v-model:value="apiUrl"
                          :placeholder="DEFAULT_API_URL || 'https://example.com'"
                          @blur="saveBackendSettings"
                          @pressEnter="saveBackendSettings"
                        />
                        <a-button type="primary" @click="saveBackendSettings">保存</a-button>
                      </div>
                      <p class="field-hint">
                        <template v-if="hasApiOverride">当前使用手动覆盖地址：{{ activeApiUrl }}。</template>
                        <template v-else>当前未覆盖，运行时会直接使用 env 默认地址。</template>
                      </p>
                      <a-button type="link" class="settings-reset-link" @click="resetApiUrlToDefault">恢复 env 默认值</a-button>
                    </a-form-item>
                    <a-form-item class="settings-form__compact">
                      <div class="toggle-row">
                        <div>
                          <div class="toggle-row__title">自动同步数据</div>
                          <div class="field-hint">开启后会将本地单词、分类与收藏同步到后端。</div>
                        </div>
                        <a-checkbox v-model:checked="autoSync" @change="saveBackendSettings" />
                      </div>
                    </a-form-item>
                  </a-form>
                </a-card>

                <a-card title="账户登录" class="settings-panel shadow-sm" :bordered="false">
                  <template v-if="userInfo">
                    <div class="account-card">
                      <div class="account-card__profile">
                        <a-avatar v-if="userInfo.avatar" :src="userInfo.avatar" :size="56" />
                        <a-avatar v-else :size="56">{{ userInfo.name?.[0] || 'U' }}</a-avatar>
                        <div>
                          <div class="account-card__name">{{ userInfo.name || userInfo.id }}</div>
                          <div class="account-card__meta">{{ userInfo.email || `已通过 ${authProvider} 登录` }}</div>
                        </div>
                      </div>
                      <a-tag color="green">已连接</a-tag>
                    </div>
                    <a-button danger @click="logout">退出登录</a-button>
                  </template>
                  <template v-else>
                    <a-alert
                      v-if="loginError"
                      type="error"
                      :message="loginError"
                      class="settings-alert"
                      closable
                      @close="loginError = ''"
                    />

                    <div v-if="authProviders.length === 0" class="settings-empty-state">
                      <p>暂未读取到可用认证方式，请确认后端地址可访问。</p>
                      <a-button size="small" @click="refreshAuthProviders">重新加载</a-button>
                    </div>
                    <div v-else class="provider-list">
                      <button
                        v-for="provider in authProviders"
                        :key="provider.id"
                        type="button"
                        class="provider-card"
                        :disabled="isLoggingIn"
                        @click="loginWithProvider(provider)"
                      >
                        <span class="provider-card__icon">{{ provider.icon }}</span>
                        <span class="provider-card__body">
                          <strong>使用 {{ provider.name }} 登录</strong>
                          <span>授权后将自动绑定并启用云端同步。</span>
                        </span>
                      </button>
                    </div>
                  </template>
                </a-card>
              </div>

              <div class="settings-column">
                <a-card :title="t('settings_dictApi')" class="settings-panel shadow-sm" :bordered="false">
                  <div class="settings-section-copy">
                    <p>{{ t('settings_dictApiDesc') }}</p>
                  </div>
                  <a-select v-model:value="dictApi" class="settings-select" @change="saveDictApi">
                    <a-select-option value="auto">{{ t('settings_apiAuto') }}</a-select-option>
                    <a-select-option value="youdao">{{ t('settings_apiYoudao') }}</a-select-option>
                    <a-select-option value="iciba">{{ t('settings_apiIciba') }}</a-select-option>
                    <a-select-option value="freedict">{{ t('settings_apiFreeDictionary') }}</a-select-option>
                  </a-select>
                </a-card>

                <a-card :title="t('settings_cache')" class="settings-panel shadow-sm" :bordered="false">
                  <div class="cache-card">
                    <div>
                      <p class="cache-card__count">{{ cacheCount }}</p>
                      <p class="settings-section-copy">{{ t('settings_cacheDesc', String(cacheCount)) }}</p>
                    </div>
                    <a-button @click="clearDictCache">{{ t('settings_clearCache') }}</a-button>
                  </div>
                </a-card>
              </div>
            </div>
          </section>
        </a-tab-pane>
      </a-tabs>
    </a-layout-content>
  </a-layout>
</template>

<style>
body { background: #f0f2f5; margin: 0; }
.page-layout { min-height: 100vh; background: transparent; }
.header { background: #fff; padding: 0 24px; border-bottom: 1px solid #f0f0f0; }
.header-content { max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; height: 100%; }
.header-content h1 { margin: 0; font-size: 20px; font-weight: 600; color: #1f1f1f; }
.actions { display: flex; gap: 12px; }
.main-content { max-width: 1000px; margin: 0 auto; width: 100%; padding: 24px; }
.main-tabs .ant-tabs-nav { margin-bottom: 24px; }
.main-tabs .ant-tabs-nav::before { border-bottom: none; }
.main-tabs .ant-tabs-nav-wrap { padding: 6px; background: rgba(255, 255, 255, 0.88); border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); }
.main-tabs .ant-tabs-tab { margin: 0 4px 0 0; padding: 10px 16px; border-radius: 12px; transition: background-color 0.2s ease, color 0.2s ease; }
.main-tabs .ant-tabs-tab-active { background: #f4f8ff; }
.main-tabs .ant-tabs-ink-bar { display: none; }
.mb-4 { margin-bottom: 16px; }
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03); border-radius: 8px; }
.bg-white { background: #fff; }
.swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.15); }
.content-page { display: flex; flex-direction: column; gap: 20px; }
.section-hero { border-radius: 20px; overflow: hidden; }
.section-hero--blue { background: linear-gradient(135deg, #eef6ff 0%, #ffffff 52%, #eefbf7 100%); }
.section-hero--sand { background: linear-gradient(135deg, #fff7e8 0%, #ffffff 60%, #fffaf3 100%); }
.section-hero--mint { background: linear-gradient(135deg, #eefbf7 0%, #ffffff 52%, #f4f8ff 100%); }
.section-hero__content { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 20px; }
.section-title { margin: 0; font-size: 28px; line-height: 1.25; color: #1f1f1f; letter-spacing: 0.01em; }
.section-desc { margin: 12px 0 0; max-width: 680px; color: #5f6b7a; line-height: 1.7; }
.section-badge-grid { display: grid; grid-template-columns: repeat(2, minmax(120px, 1fr)); gap: 12px; min-width: 240px; }
.section-badge-grid--single { grid-template-columns: minmax(160px, 1fr); }
.section-badge { padding: 16px; border-radius: 14px; background: rgba(255, 255, 255, 0.88); border: 1px solid rgba(15, 23, 42, 0.06); }
.section-badge span { display: block; margin-bottom: 8px; font-size: 13px; color: #667085; }
.section-badge strong { font-size: 24px; line-height: 1; color: #1f1f1f; }
.quick-form { display: grid; grid-template-columns: minmax(0, 1.4fr) 180px 120px; gap: 12px; align-items: center; }
.quick-form--category { grid-template-columns: minmax(0, 1fr) 72px 120px; }
.quick-form__input,
.quick-form__select,
.quick-form__button { width: 100%; }
.content-panel { border-radius: 14px; }
.cat-card__header { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.word-item__text { flex: 1; font-weight: 500; color: #223046; }
.word-item__select { width: 112px; margin-right: 8px; }
.color-picker { width: 100%; height: 40px; border: 1px solid #d9d9d9; padding: 0 4px; border-radius: 10px; background: #fff; }
.category-list { border-radius: 14px; overflow: hidden; }
.category-row { display: flex; align-items: center; gap: 16px; width: 100%; }
.category-row__main { display: flex; flex: 1; flex-direction: column; gap: 4px; }
.category-row__name { font-weight: 700; color: #1f1f1f; }
.category-row__meta { color: #8c8c8c; font-size: 13px; }
.collection-card { border-radius: 14px; padding: 16px; }
.collection-card__title { font-size: 17px; font-weight: 700; color: #1f1f1f; }
.collection-card__meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; color: #8c8c8c; }
.collection-card__meta a { color: #1677ff; }
.collection-card__context { color: #555; font-style: italic; background: #f9fafb; padding: 12px; border-radius: 10px; border-left: 3px solid #cbd5e1; line-height: 1.7; }
.empty-panel { padding: 24px 0; border-radius: 14px; }
.cat-card .ant-card-head { min-height: 40px; padding: 0 12px; }
.cat-card .ant-card-body { padding: 0; }
.cat-card .ant-list-item { padding: 8px 12px; }
.collection-list .ant-list-item-meta-title { margin-bottom: 4px; }
.settings-page { display: flex; flex-direction: column; gap: 20px; }
.settings-hero { overflow: hidden; background: linear-gradient(135deg, #f7fbff 0%, #ffffff 45%, #fff8ef 100%); }
.settings-hero__intro { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
.section-eyebrow { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1677ff; }
.settings-hero__title { margin: 0; font-size: 28px; line-height: 1.2; color: #1f1f1f; }
.settings-hero__desc { margin: 12px 0 0; max-width: 640px; color: #5f6b7a; line-height: 1.6; }
.settings-overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.settings-stat { padding: 16px; border-radius: 16px; background: rgba(255, 255, 255, 0.82); border: 1px solid rgba(22, 119, 255, 0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.8); }
.settings-stat__label { display: block; margin-bottom: 10px; color: #667085; font-size: 13px; }
.settings-stat__value { display: inline-block; color: var(--accent); font-size: 24px; line-height: 1; }
.settings-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr); gap: 20px; align-items: start; }
.settings-column { display: flex; flex-direction: column; gap: 20px; }
.settings-panel { border-radius: 14px; }
.settings-panel .ant-card-head { min-height: 56px; }
.settings-panel .ant-card-head-title { font-size: 16px; font-weight: 700; }
.settings-form .ant-form-item { margin-bottom: 18px; }
.settings-form__compact { margin-bottom: 0; }
.build-mode-card { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 14px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e5e7eb; }
.build-mode-card__title { font-size: 15px; font-weight: 700; color: #1f1f1f; }
.build-mode-card__desc { margin-top: 4px; color: #667085; line-height: 1.6; }
.settings-inline-field { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
.settings-reset-link { padding-left: 0; }
.field-hint { margin: 6px 0 0; color: #8c8c8c; font-size: 12px; line-height: 1.5; }
.toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; background: #fafafa; }
.toggle-row__title { margin-bottom: 4px; font-weight: 600; color: #1f1f1f; }
.account-card { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; padding: 16px; border-radius: 14px; background: linear-gradient(135deg, #f6ffed, #ffffff); border: 1px solid #d9f7be; }
.account-card__profile { display: flex; align-items: center; gap: 14px; }
.account-card__name { font-size: 16px; font-weight: 700; color: #1f1f1f; }
.account-card__meta { margin-top: 4px; color: #667085; }
.settings-alert { margin-bottom: 16px; }
.settings-empty-state { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; background: #fafafa; color: #667085; }
.settings-empty-state p { margin: 0; }
.provider-list { display: grid; gap: 12px; }
.provider-card { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 14px; width: 100%; padding: 16px; border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; text-align: left; cursor: pointer; transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }
.provider-card:hover:enabled { border-color: #1677ff; transform: translateY(-1px); box-shadow: 0 10px 24px rgba(22, 119, 255, 0.08); }
.provider-card:disabled { opacity: 0.65; cursor: not-allowed; }
.provider-card__icon { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: #f5f7fa; font-size: 20px; }
.provider-card__body { display: flex; flex-direction: column; gap: 4px; color: #667085; }
.provider-card__body strong { color: #1f1f1f; font-size: 15px; }
.settings-section-copy { color: #667085; line-height: 1.6; }
.settings-section-copy p { margin: 0 0 16px; }
.settings-select { width: 100%; max-width: 280px; }
.cache-card { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 6px 0; }
.cache-card__count { margin: 0 0 6px; font-size: 32px; line-height: 1; font-weight: 700; color: #fa8c16; }

@media (max-width: 960px) {
  .header-content,
  .main-content { max-width: 100%; }
  .section-hero__content { flex-direction: column; }
  .quick-form { grid-template-columns: minmax(0, 1fr) 160px 120px; }
  .settings-overview-grid,
  .settings-grid { grid-template-columns: 1fr 1fr; }
  .settings-grid { align-items: stretch; }
}

@media (max-width: 720px) {
  .header { padding: 0 16px; }
  .header-content { flex-direction: column; justify-content: center; align-items: flex-start; gap: 12px; padding: 16px 0; }
  .main-content { padding: 16px; }
  .actions,
  .section-hero__content,
  .settings-hero__intro,
  .build-mode-card,
  .toggle-row,
  .account-card,
  .cache-card,
  .settings-empty-state { flex-direction: column; align-items: stretch; }
  .section-badge-grid,
  .settings-overview-grid,
  .settings-grid { grid-template-columns: 1fr; }
  .quick-form,
  .quick-form--category { grid-template-columns: 1fr; }
  .settings-inline-field { grid-template-columns: 1fr; }
  .category-row { flex-wrap: wrap; }
  .word-item__select { width: 96px; }
  .section-title,
  .settings-hero__title { font-size: 24px; }
  .provider-card { grid-template-columns: 40px minmax(0, 1fr); }
}
</style>
