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
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_users_username` (`username`),
  UNIQUE KEY `ix_users_email` (`email`),
  UNIQUE KEY `ix_users_github_id` (`github_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 分类表
-- ============================================
CREATE TABLE `categories` (
  `id` VARCHAR(64) NOT NULL COMMENT '分类ID (UUID)',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `name` VARCHAR(128) NOT NULL COMMENT '分类名称',
  `color` VARCHAR(16) DEFAULT '#ffd54f' COMMENT '高亮颜色 (hex)',
  PRIMARY KEY (`id`),
  KEY `ix_categories_user_id` (`user_id`),
  CONSTRAINT `fk_categories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='单词分类表';

-- ============================================
-- 单词表
-- ============================================
CREATE TABLE `words` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `text` VARCHAR(256) NOT NULL COMMENT '单词文本',
  `category_id` VARCHAR(64) NOT NULL COMMENT '分类ID',
  `added_at` BIGINT NOT NULL COMMENT '添加时间戳 (毫秒)',
  PRIMARY KEY (`id`),
  KEY `ix_words_user_id` (`user_id`),
  KEY `ix_words_user_text` (`user_id`, `text`),
  CONSTRAINT `fk_words_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
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
  `collected_at` BIGINT NOT NULL COMMENT '收藏时间戳 (毫秒)',
  PRIMARY KEY (`id`),
  KEY `ix_collections_user_id` (`user_id`),
  CONSTRAINT `fk_collections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';
