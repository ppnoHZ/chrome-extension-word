<script setup lang="ts">
defineProps<{
  enabled: boolean;
  wordsCount: number;
  collectionsCount: number;
  isLoggedIn?: boolean;
  userName?: string;
  userAvatar?: string;
  pendingSyncCount?: number;
}>();

defineEmits<{
  toggle: [];
  openOptions: [];
  sync: [];
}>();
</script>

<template>
  <section class="hero-card">
    <div class="hero-card__top">
      <div>
        <p class="hero-card__eyebrow">Word Learn</p>
        <h1 class="hero-card__title">网页单词高亮助手</h1>
        <p class="hero-card__desc">在当前页面持续高亮重点词，并把新收集内容快速归档进词库。</p>
      </div>
      <button class="toggle-pill" :class="{ 'toggle-pill--on': enabled }" @click="$emit('toggle')">
        {{ enabled ? '已开启' : '已暂停' }}
      </button>
    </div>

    <!-- 登录状态和同步提示 -->
    <div v-if="isLoggedIn" class="auth-status auth-status--logged-in">
      <div class="auth-status__user">
        <img v-if="userAvatar" :src="userAvatar" class="auth-status__avatar" alt="avatar" />
        <span v-else class="auth-status__avatar-placeholder">👤</span>
        <span class="auth-status__name">{{ userName || '已登录' }}</span>
      </div>
      <div v-if="pendingSyncCount && pendingSyncCount > 0" class="sync-hint" @click="$emit('openOptions')">
        <span class="sync-hint__badge">{{ pendingSyncCount }}</span>
        <span class="sync-hint__text">条待同步</span>
      </div>
    </div>
    <div v-else class="auth-status auth-status--logged-out" @click="$emit('openOptions')">
      <span class="auth-status__hint">💡 登录后可云同步数据</span>
    </div>

    <div class="hero-card__stats">
      <div class="hero-stat">
        <span>追踪词数</span>
        <strong>{{ wordsCount }}</strong>
      </div>
      <div class="hero-stat">
        <span>最近收藏</span>
        <strong>{{ collectionsCount }}</strong>
      </div>
    </div>

    <button class="ghost-button" @click="$emit('openOptions')">进入完整管理页</button>
  </section>
</template>

<style scoped>
.hero-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(145deg, #eef6ff 0%, #ffffff 55%, #fff7ec 100%);
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.hero-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.hero-card__eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--popup-accent);
}

.hero-card__title {
  margin: 0;
  font-size: 20px;
  line-height: 1.25;
  color: var(--popup-text);
}

.hero-card__desc {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--popup-muted);
}

.hero-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.hero-stat {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.hero-stat span {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--popup-muted);
}

.hero-stat strong {
  font-size: 22px;
  line-height: 1;
  color: var(--popup-text);
}

.toggle-pill {
  flex-shrink: 0;
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  background: #eef2f7;
  color: #42526b;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.toggle-pill--on {
  background: #153a2b;
  color: #f3fff8;
}

.ghost-button {
  width: 100%;
  border: 1px solid rgba(22, 119, 255, 0.14);
  border-radius: 14px;
  padding: 11px 14px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--popup-accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

/* Auth status styles */
.auth-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.auth-status--logged-out {
  cursor: pointer;
  transition: background 0.2s;
}

.auth-status--logged-out:hover {
  background: rgba(22, 119, 255, 0.08);
}

.auth-status__hint {
  font-size: 12px;
  color: var(--popup-muted);
}

.auth-status__user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auth-status__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.auth-status__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e8f0fe;
  font-size: 14px;
}

.auth-status__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--popup-text);
}

.sync-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  background: linear-gradient(135deg, #fff7e6 0%, #ffe4b8 100%);
  border: 1px solid rgba(250, 140, 22, 0.2);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.sync-hint:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(250, 140, 22, 0.2);
}

.sync-hint__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #fa8c16;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.sync-hint__text {
  font-size: 12px;
  font-weight: 600;
  color: #d46b08;
}
</style>