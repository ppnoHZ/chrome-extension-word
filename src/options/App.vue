<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getAll, set, update } from '@/shared/storage';
import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';
import { authenticateWithGitHub, authenticateWithOAuth2, getAuthProviders, logout as logoutOAuth } from '@/shared/oauth';
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

// 后端 API 地址（固定配置）
const DEFAULT_API_URL = 'https://auth.zhoudd.top';
const apiUrl = ref(DEFAULT_API_URL);

// 自动同步
const autoSync = ref(false);

// 可用的认证方式列表
const authProviders = ref<AuthProvider[]>([]);

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
  apiUrl.value = all.apiUrl || DEFAULT_API_URL;
  autoSync.value = all.autoSync || false;
  if (categories.value[0]) newWordCat.value = categories.value[0].id;
  
  // 自动加载可用的认证方式
  authProviders.value = await getAuthProviders(apiUrl.value);
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

// 保存后端设置
async function saveBackendSettings() {
  await set('apiUrl', apiUrl.value);
  await set('autoSync', autoSync.value);
  
  // 重新加载可用的认证方式
  await refreshAuthProviders();
}

// 刷新认证方式列表
async function refreshAuthProviders() {
  if (apiUrl.value) {
    authProviders.value = await getAuthProviders(apiUrl.value);
  } else {
    authProviders.value = [];
  }
}

// 登录相关函数
async function loginWithProvider(provider: AuthProvider) {
  if (!apiUrl.value.trim()) {
    loginError.value = '请先配置后端 API 地址';
    return;
  }
  isLoggingIn.value = true;
  loginError.value = '';
  try {
    let result;
    if (provider.id === 'github') {
      result = await authenticateWithGitHub(apiUrl.value.trim());
    } else {
      result = await authenticateWithOAuth2(apiUrl.value.trim());
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
          <a-card :bordered="false" class="mb-4 shadow-sm">
            <a-form layout="inline" @finish="addWord">
              <a-form-item>
                <a-input v-model:value="newWordText" :placeholder="t('options_wordPlaceholder')" style="width: 300px" />
              </a-form-item>
              <a-form-item>
                <a-select v-model:value="newWordCat" style="width: 150px">
                  <a-select-option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-button type="primary" html-type="submit" :disabled="!newWordText.trim()">{{ t('options_addWord') }}</a-button>
              </a-form-item>
            </a-form>
          </a-card>

          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :md="12" :lg="8" v-for="cat in categories" :key="cat.id">
              <a-card size="small" class="cat-card shadow-sm">
                <template #title>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="swatch" :style="{ backgroundColor: cat.color }"></span>
                    <span>{{ cat.name }} ({{ wordsByCategory.get(cat.id)?.length ?? 0 }})</span>
                  </div>
                </template>
                <a-list size="small" :dataSource="wordsByCategory.get(cat.id) ?? []">
                  <template #renderItem="{ item }">
                    <a-list-item>
                      <span style="flex: 1; font-weight: 500;">{{ item.text }}</span>
                      <a-select :value="item.categoryId" @change="moveWord(item.text, $event as string)" size="small" style="width: 100px; margin-right: 8px;">
                        <a-select-option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</a-select-option>
                      </a-select>
                      <a-button danger size="small" type="text" @click="deleteWord(item.text)">×</a-button>
                    </a-list-item>
                  </template>
                </a-list>
              </a-card>
            </a-col>
          </a-row>
        </a-tab-pane>

        <!-- Categories Tab -->
        <a-tab-pane key="categories" :tab="`${t('options_tabCategories')} (${categories.length})`">
          <a-card :bordered="false" class="mb-4 shadow-sm">
            <a-form layout="inline" @finish="addCategory">
              <a-form-item>
                <a-input v-model:value="newCatName" :placeholder="t('options_categoryNamePlaceholder')" style="width: 250px" />
              </a-form-item>
              <a-form-item>
                <input v-model="newCatColor" type="color" style="height: 32px; border: 1px solid #d9d9d9; padding: 0 4px; border-radius: 6px;" />
              </a-form-item>
              <a-form-item>
                <a-button type="primary" html-type="submit" :disabled="!newCatName.trim()">{{ t('options_addWord') }}</a-button>
              </a-form-item>
            </a-form>
          </a-card>

          <a-list bordered :dataSource="categories" class="bg-white shadow-sm">
            <template #renderItem="{ item }">
              <a-list-item>
                <div style="display: flex; align-items: center; gap: 16px; width: 100%">
                  <input type="color" :value="item.color" @change="updateCategoryColor(item.id, ($event.target as HTMLInputElement).value)" style="height: 32px; border: 1px solid #d9d9d9; padding: 0 4px; border-radius: 6px;" />
                  <span style="flex: 1; font-weight: 600;">{{ item.name }}</span>
                  <a-button v-if="item.id !== 'default'" danger @click="deleteCategory(item.id)">{{ t('options_delete') }}</a-button>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </a-tab-pane>

        <!-- Collections Tab -->
        <a-tab-pane key="collections" :tab="`${t('options_tabCollections')} (${collections.length})`">
          <a-list v-if="collections.length" item-layout="vertical" :dataSource="collections" class="collection-list">
            <template #renderItem="{ item }">
              <a-list-item class="bg-white shadow-sm mb-4" style="border-radius: 8px; padding: 16px;">
                <template #actions>
                  <a-button type="primary" size="small" @click="promoteCollection(item)">{{ t('options_promote') }}</a-button>
                  <a-button danger size="small" @click="deleteCollection(item.id)">{{ t('options_delete') }}</a-button>
                </template>
                <a-list-item-meta>
                  <template #title>
                    <span style="font-size: 16px; font-weight: 600;">{{ item.text }}</span>
                  </template>
                  <template #description>
                    <div style="margin-bottom: 8px;">
                      <a :href="item.sourceUrl" target="_blank" rel="noopener" style="margin-right: 16px;">{{ item.sourceTitle || item.sourceUrl }}</a>
                      <span style="color: #888;">· {{ new Date(item.collectedAt).toLocaleString() }}</span>
                      <span style="color: #888; margin-left: 8px;">· {{ categoryName(item.categoryId) }}</span>
                    </div>
                  </template>
                </a-list-item-meta>
                <div v-if="item.context" style="color: #555; font-style: italic; background: #f9f9f9; padding: 8px; border-radius: 4px; border-left: 3px solid #ccc;">
                  "{{ item.context }}"
                </div>
              </a-list-item>
            </template>
          </a-list>
          <a-empty v-else :description="t('options_noCollections')" style="margin-top: 60px;" />
        </a-tab-pane>

        <!-- Settings Tab -->
        <a-tab-pane key="settings" :tab="t('options_tabSettings')">
          <!-- 后端服务设置 -->
          <a-card title="后端服务" class="mb-4 shadow-sm" :bordered="false">
            <a-form layout="vertical">
              <a-form-item label="后端 API 地址">
                <a-input-group compact>
                  <a-input v-model:value="apiUrl" placeholder="http://localhost:8000" style="width: calc(100% - 80px);" @blur="saveBackendSettings" @pressEnter="saveBackendSettings" />
                  <a-button type="primary" @click="saveBackendSettings">保存</a-button>
                </a-input-group>
                <p style="color: #888; font-size: 12px; margin-top: 4px;">部署后端服务后填写地址，用于数据同步和登录</p>
              </a-form-item>
              <a-form-item>
                <a-checkbox v-model:checked="autoSync" @change="saveBackendSettings">自动同步数据到后端</a-checkbox>
              </a-form-item>
            </a-form>
          </a-card>

          <!-- 登录设置 -->
          <a-card title="账户登录" class="mb-4 shadow-sm" :bordered="false">
            <template v-if="userInfo">
              <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                <a-avatar v-if="userInfo.avatar" :src="userInfo.avatar" :size="48" />
                <a-avatar v-else :size="48">{{ userInfo.name?.[0] || 'U' }}</a-avatar>
                <div>
                  <div style="font-weight: 600; font-size: 16px;">{{ userInfo.name || userInfo.id }}</div>
                  <div style="color: #888;">{{ userInfo.email || `已通过 ${authProvider} 登录` }}</div>
                </div>
              </div>
              <a-button danger @click="logout">退出登录</a-button>
            </template>
            <template v-else>
              <a-alert v-if="loginError" type="error" :message="loginError" style="margin-bottom: 16px;" closable @close="loginError = ''" />
              
              <!-- OAuth 登录按钮 -->
              <div v-if="authProviders.length === 0" style="color: #888;">
                <p style="margin-bottom: 8px;">正在加载认证方式...</p>
                <a-button size="small" @click="refreshAuthProviders">刷新</a-button>
              </div>
              <a-space v-else direction="vertical" style="width: 100%;">
                <a-button 
                  v-for="provider in authProviders" 
                  :key="provider.id"
                  :type="provider.id === authProviders[0]?.id ? 'primary' : 'default'"
                  :loading="isLoggingIn" 
                  @click="loginWithProvider(provider)" 
                  style="width: 220px;"
                >
                  <template #icon><span style="margin-right: 8px;">{{ provider.icon }}</span></template>
                  使用 {{ provider.name }} 登录
                </a-button>
              </a-space>
            </template>
          </a-card>

          <a-card :title="t('settings_dictApi')" class="mb-4 shadow-sm" :bordered="false">
            <p style="color: #666; margin-bottom: 16px;">{{ t('settings_dictApiDesc') }}</p>
            <a-select v-model:value="dictApi" style="width: 240px" @change="saveDictApi">
              <a-select-option value="auto">{{ t('settings_apiAuto') }}</a-select-option>
              <a-select-option value="youdao">{{ t('settings_apiYoudao') }}</a-select-option>
              <a-select-option value="iciba">{{ t('settings_apiIciba') }}</a-select-option>
              <a-select-option value="freedict">{{ t('settings_apiFreeDictionary') }}</a-select-option>
            </a-select>
          </a-card>

          <a-card :title="t('settings_cache')" class="shadow-sm" :bordered="false">
            <p style="color: #666; margin-bottom: 16px;">{{ t('settings_cacheDesc', String(cacheCount)) }}</p>
            <a-button @click="clearDictCache">{{ t('settings_clearCache') }}</a-button>
          </a-card>
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
.mb-4 { margin-bottom: 16px; }
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03); border-radius: 8px; }
.bg-white { background: #fff; }
.swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.15); }
.cat-card .ant-card-head { min-height: 40px; padding: 0 12px; }
.cat-card .ant-card-body { padding: 0; }
.cat-card .ant-list-item { padding: 8px 12px; }
.collection-list .ant-list-item-meta-title { margin-bottom: 4px; }
</style>
