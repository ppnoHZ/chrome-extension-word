<script setup lang="ts">
import type { Category } from '@/shared/types';

defineProps<{
  value: string;
  selectedCategory: string;
  categories: Category[];
  wordsCount: number;
  placeholder: string;
  submitText: string;
}>();

defineEmits<{
  'update:value': [value: string];
  'update:selectedCategory': [value: string];
  submit: [];
}>();
</script>

<template>
  <section class="panel-card">
    <div class="panel-card__heading">
      <div>
        <p class="panel-card__eyebrow">Quick Add</p>
        <h2 class="panel-card__title">快速加入词库</h2>
      </div>
      <span class="panel-card__meta">共 {{ wordsCount }} 个单词</span>
    </div>

    <div class="quick-form">
      <input
        :value="value"
        class="quick-form__input"
        :placeholder="placeholder"
        @input="$emit('update:value', ($event.target as HTMLInputElement).value)"
        @keydown.enter="$emit('submit')"
      />
      <select
        :value="selectedCategory"
        class="quick-form__select"
        @change="$emit('update:selectedCategory', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="c in categories" :key="c.id" :value="c.id">
          {{ c.name }}
        </option>
      </select>
      <button class="quick-form__button" :disabled="!value.trim()" @click="$emit('submit')">{{ submitText }}</button>
    </div>
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
  color: #fa8c16;
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

.quick-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.quick-form__input,
.quick-form__select,
.quick-form__button {
  width: 100%;
  box-sizing: border-box;
  border-radius: 12px;
  font: inherit;
}

.quick-form__input,
.quick-form__select {
  border: 1px solid #dbe3ef;
  padding: 11px 12px;
  background: #fbfcfe;
  color: var(--popup-text);
}

.quick-form__input:focus,
.quick-form__select:focus {
  outline: 2px solid rgba(22, 119, 255, 0.18);
  border-color: #9fc4ff;
}

.quick-form__button {
  border: 0;
  padding: 11px 14px;
  background: linear-gradient(135deg, #1677ff, #0f5bd7);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.quick-form__button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>