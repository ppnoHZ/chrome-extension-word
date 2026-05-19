<script setup lang="ts">
import type { Collection } from '@/shared/types';

defineProps<{
  recent: Collection[];
  emptyText: string;
}>();
</script>

<template>
  <section class="panel-card">
    <div class="panel-card__heading">
      <div>
        <p class="panel-card__eyebrow">Collection</p>
        <h2 class="panel-card__title">最近收藏</h2>
      </div>
      <span class="panel-card__meta">{{ recent.length }} 条</span>
    </div>

    <ul v-if="recent.length" class="recent-list">
      <li v-for="item in recent" :key="item.id" class="recent-item">
        <div class="recent-item__text">{{ item.text }}</div>
        <a class="recent-item__source" :href="item.sourceUrl" target="_blank" rel="noopener">
          {{ item.sourceTitle || item.sourceUrl }}
        </a>
      </li>
    </ul>

    <div v-else class="empty-state">{{ emptyText }}</div>
  </section>
</template>

<style scoped>
.panel-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
}

.panel-card__heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.panel-card__eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #13c2c2;
}

.panel-card__title {
  margin: 0;
  font-size: 16px;
  color: var(--popup-text);
}

.panel-card__meta {
  color: var(--popup-muted);
  font-size: 12px;
}

.recent-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 224px;
  overflow-y: auto;
}

.recent-item {
  padding: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #ebf0f6;
}

.recent-item__text {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--popup-text);
}

.recent-item__source {
  color: var(--popup-accent);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
  text-decoration: none;
}

.empty-state {
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  color: var(--popup-muted);
  font-size: 13px;
  line-height: 1.6;
}
</style>