-- Words Backend DDL for MySQL
-- 数据库: words
-- 字符集: utf8mb4

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `words` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `words`;

-- ============================================
-- 用户表 (支持多种认证方式)
-- ============================================
CREATE TABLE `users` (
  `id` VARCHAR(64) NOT NULL COMMENT '用户ID (GitHub user id 或 UUID)',
  `username` VARCHAR(64) DEFAULT NULL COMMENT '用户名 (本地认证)',
  `password_hash` VARCHAR(256) DEFAULT NULL COMMENT '密码哈希 (本地认证)',
  `name` VARCHAR(128) DEFAULT NULL COMMENT '显示名称',
  `email` VARCHAR(256) DEFAULT NULL COMMENT '邮箱',
  `avatar` VARCHAR(512) DEFAULT NULL COMMENT '头像URL',
  `auth_provider` VARCHAR(32) DEFAULT 'local' COMMENT '认证提供商: local, github, custom',
  `github_id` VARCHAR(64) DEFAULT NULL COMMENT 'GitHub 用户ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_users_username` (`username`),
  UNIQUE KEY `ix_users_email` (`email`),
  UNIQUE KEY `ix_users_github_id` (`github_id`),
  KEY `ix_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 分类表
-- ============================================
CREATE TABLE `categories` (
  `id` VARCHAR(64) NOT NULL COMMENT '分类ID (UUID)',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `name` VARCHAR(128) NOT NULL COMMENT '分类名称',
  `color` VARCHAR(16) DEFAULT '#ffd54f' COMMENT '高亮颜色 (hex)',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `ix_categories_user_id` (`user_id`),
  KEY `ix_categories_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='单词分类表';

-- ============================================
-- 单词表
-- ============================================
CREATE TABLE `words` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `text` VARCHAR(256) NOT NULL COMMENT '单词文本',
  `category_id` VARCHAR(64) NOT NULL COMMENT '分类ID',
  `domain` VARCHAR(256) DEFAULT NULL COMMENT '来源域名 (如 economist.com)',
  `added_at` BIGINT NOT NULL COMMENT '添加时间戳 (毫秒)',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `ix_words_user_id` (`user_id`),
  KEY `ix_words_user_text` (`user_id`, `text`),
  KEY `ix_words_domain` (`user_id`, `domain`),
  KEY `ix_words_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='单词表';

-- ============================================
-- 收藏表
-- ============================================
CREATE TABLE `collections` (
  `id` VARCHAR(64) NOT NULL COMMENT '收藏ID (UUID)',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `text` TEXT NOT NULL COMMENT '收藏文本',
  `category_id` VARCHAR(64) DEFAULT NULL COMMENT '分类ID',
  `source_url` TEXT NOT NULL COMMENT '来源URL',
  `source_title` VARCHAR(512) NOT NULL COMMENT '来源页面标题',
  `context` TEXT DEFAULT NULL COMMENT '上下文片段',
  `domain` VARCHAR(256) DEFAULT NULL COMMENT '来源域名 (如 economist.com)',
  `collected_at` BIGINT NOT NULL COMMENT '收藏时间戳 (毫秒)',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `ix_collections_user_id` (`user_id`),
  KEY `ix_collections_domain` (`user_id`, `domain`),
  KEY `ix_collections_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

-- ============================================
-- 系统分类表 (主数据，无 user_id)
-- ============================================
CREATE TABLE `system_categories` (
  `id` VARCHAR(64) NOT NULL COMMENT '分类ID (UUID)',
  `name` VARCHAR(128) NOT NULL COMMENT '分类名称 (如 GRE核心词汇, TOEFL高频词)',
  `color` VARCHAR(16) DEFAULT '#4caf50' COMMENT '高亮颜色 (hex)',
  `description` TEXT DEFAULT NULL COMMENT '分类描述',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_system_categories_name` (`name`),
  KEY `ix_system_categories_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统分类表 (主数据)';

-- ============================================
-- 系统单词表 (主数据，无 user_id)
-- ============================================
CREATE TABLE `system_words` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `text` VARCHAR(256) NOT NULL COMMENT '单词文本',
  `category_id` VARCHAR(64) NOT NULL COMMENT '分类ID',
  `phonetic_uk` VARCHAR(128) DEFAULT NULL COMMENT '英式音标',
  `phonetic_us` VARCHAR(128) DEFAULT NULL COMMENT '美式音标',
  `definition` TEXT DEFAULT NULL COMMENT '基础释义',
  `added_at` BIGINT NOT NULL COMMENT '添加时间戳 (毫秒)',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (`id`),
  KEY `ix_system_words_text` (`text`),
  KEY `ix_system_words_category` (`category_id`),
  KEY `ix_system_words_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统单词表 (主数据)';

-- ============================================
-- AI 分析缓存表
-- ============================================
CREATE TABLE `ai_analyses` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `word` VARCHAR(256) NOT NULL COMMENT '单词文本',
  `analysis_type` ENUM('meaning', 'examples', 'roots', 'synonyms', 'memory', 'full') NOT NULL COMMENT '分析类型',
  `content` JSON NOT NULL COMMENT '分析内容 (JSON格式)',
  `model` VARCHAR(64) DEFAULT NULL COMMENT 'AI模型名称',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_ai_word_type` (`word`, `analysis_type`),
  KEY `ix_ai_word` (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI分析缓存表';
