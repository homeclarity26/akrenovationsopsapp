-- Migration: A1 — Enable pgvector extension
-- Required for all vector/embedding columns in the memory layer.
-- Must be run before any table with vector(1536) columns is created.

create extension if not exists vector;
