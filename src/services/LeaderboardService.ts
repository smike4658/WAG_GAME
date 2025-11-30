/**
 * LeaderboardService
 * Handles communication with Supabase for leaderboard data
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Leaderboard entry from database
 */
export interface LeaderboardEntry {
  id: string;
  player_name: string;
  time_ms: number;
  created_at: string;
  updated_at: string;
}

/**
 * Result of submitting a score
 */
export interface SubmitResult {
  success: boolean;
  isNewRecord: boolean;
  isImprovement: boolean;
  previousTime?: number;
  previousRank?: number;
  currentRank: number;
  error?: string;
}

/**
 * Database row type for Supabase
 */
interface LeaderboardRow {
  id: string;
  player_name: string;
  time_ms: number;
  created_at: string;
  updated_at: string;
}

/**
 * LeaderboardService - Singleton for leaderboard operations
 */
export class LeaderboardService {
  private static instance: LeaderboardService | null = null;
  private supabase: SupabaseClient | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService();
    }
    return LeaderboardService.instance;
  }

  /**
   * Initialize Supabase client
   */
  public initialize(): void {
    if (this.initialized) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[LeaderboardService] Supabase credentials not configured. Leaderboard disabled.');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initialized = true;
    console.log('[LeaderboardService] Initialized');
  }

  /**
   * Check if service is available
   */
  public isAvailable(): boolean {
    return this.supabase !== null;
  }

  /**
   * Get top 10 scores
   */
  public async getTopScores(limit = 10): Promise<LeaderboardEntry[]> {
    if (!this.supabase) {
      console.warn('[LeaderboardService] Not initialized');
      return [];
    }

    const { data, error } = await this.supabase
      .from('leaderboard')
      .select('*')
      .order('time_ms', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[LeaderboardService] Error fetching scores:', error);
      return [];
    }

    return (data as LeaderboardRow[]) || [];
  }

  /**
   * Get player's existing score by name
   */
  public async getPlayerScore(name: string): Promise<LeaderboardEntry | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('leaderboard')
      .select('*')
      .eq('player_name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - not an error
        return null;
      }
      console.error('[LeaderboardService] Error fetching player score:', error);
      return null;
    }

    return data as LeaderboardRow;
  }

  /**
   * Get rank for a given time (1-based)
   */
  public async getRankForTime(timeMs: number): Promise<number> {
    if (!this.supabase) return 1;

    const { count, error } = await this.supabase
      .from('leaderboard')
      .select('*', { count: 'exact', head: true })
      .lt('time_ms', timeMs);

    if (error) {
      console.error('[LeaderboardService] Error getting rank:', error);
      return 1;
    }

    return (count || 0) + 1;
  }

  /**
   * Submit a score (insert or update if better)
   */
  public async submitScore(name: string, timeMs: number): Promise<SubmitResult> {
    if (!this.supabase) {
      return {
        success: false,
        isNewRecord: false,
        isImprovement: false,
        currentRank: 0,
        error: 'Leaderboard not available',
      };
    }

    const trimmedName = name.trim().substring(0, 20);
    const roundedTimeMs = Math.round(timeMs); // Ensure integer for database

    if (!trimmedName) {
      return {
        success: false,
        isNewRecord: false,
        isImprovement: false,
        currentRank: 0,
        error: 'Name is required',
      };
    }

    // Check existing score
    const existingScore = await this.getPlayerScore(trimmedName);

    if (existingScore) {
      // Player exists - check if new time is better
      if (roundedTimeMs >= existingScore.time_ms) {
        // Not an improvement
        const currentRank = await this.getRankForTime(existingScore.time_ms);
        return {
          success: true,
          isNewRecord: false,
          isImprovement: false,
          previousTime: existingScore.time_ms,
          previousRank: currentRank,
          currentRank: currentRank,
        };
      }

      // Better time - update
      const previousRank = await this.getRankForTime(existingScore.time_ms);

      const { error } = await this.supabase
        .from('leaderboard')
        .update({
          time_ms: roundedTimeMs,
          updated_at: new Date().toISOString(),
        })
        .eq('player_name', trimmedName);

      if (error) {
        console.error('[LeaderboardService] Error updating score:', error);
        return {
          success: false,
          isNewRecord: false,
          isImprovement: false,
          currentRank: 0,
          error: 'Failed to update score',
        };
      }

      const currentRank = await this.getRankForTime(roundedTimeMs);

      return {
        success: true,
        isNewRecord: false,
        isImprovement: true,
        previousTime: existingScore.time_ms,
        previousRank: previousRank,
        currentRank: currentRank,
      };
    }

    // New player - insert
    const { error } = await this.supabase
      .from('leaderboard')
      .insert({
        player_name: trimmedName,
        time_ms: roundedTimeMs,
      });

    if (error) {
      console.error('[LeaderboardService] Error inserting score:', error);
      return {
        success: false,
        isNewRecord: false,
        isImprovement: false,
        currentRank: 0,
        error: 'Failed to save score',
      };
    }

    const currentRank = await this.getRankForTime(roundedTimeMs);

    return {
      success: true,
      isNewRecord: true,
      isImprovement: false,
      currentRank: currentRank,
    };
  }
}
