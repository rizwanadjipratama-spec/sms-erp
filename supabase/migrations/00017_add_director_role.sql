-- Migration: Add director role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'director';
