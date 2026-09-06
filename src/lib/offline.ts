/**
 * Offline-First System with Automatic Synchronization
 *
 * Provides offline capability for fleet management operations in areas with poor connectivity.
 * Implements a transaction queue that syncs automatically when connection is restored.
 */

import { supabase } from './supabase';

export interface OfflineTransaction {
  id: string;
  timestamp: number;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  error?: string;
}

const STORAGE_KEY = 'sigtb_offline_queue';
const MAX_RETRIES = 3;

class OfflineManager {
  private queue: OfflineTransaction[] = [];
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Set<(status: boolean) => void> = new Set();
  private syncListeners: Set<(queue: OfflineTransaction[]) => void> = new Set();

  constructor() {
    this.loadQueue();
    this.setupEventListeners();
    this.startPeriodicSync();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored');
      this.isOnline = true;
      this.notifyListeners(true);
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('🔌 Connection lost - switching to offline mode');
      this.isOnline = false;
      this.notifyListeners(false);
    });
  }

  private startPeriodicSync() {
    setInterval(() => {
      if (this.isOnline && !this.isSyncing && this.queue.length > 0) {
        this.syncQueue();
      }
    }, 30000); // Try sync every 30 seconds
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📦 Loaded ${this.queue.length} offline transactions`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      this.notifySyncListeners();
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  public addTransaction(
    table: string,
    operation: 'insert' | 'update' | 'delete',
    data: any
  ): string {
    const transaction: OfflineTransaction = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      table,
      operation,
      data,
      status: 'pending',
      retryCount: 0
    };

    this.queue.push(transaction);
    this.saveQueue();

    console.log(`➕ Added offline transaction: ${operation} on ${table}`);

    // Try immediate sync if online
    if (this.isOnline) {
      this.syncQueue();
    }

    return transaction.id;
  }

  public async syncQueue(): Promise<void> {
    if (this.isSyncing || this.queue.length === 0 || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    console.log(`🔄 Starting sync of ${this.queue.length} transactions...`);

    const pendingTransactions = this.queue.filter(t =>
      t.status === 'pending' || t.status === 'failed'
    );

    for (const transaction of pendingTransactions) {
      try {
        transaction.status = 'syncing';
        this.saveQueue();

        await this.executeTransaction(transaction);

        transaction.status = 'synced';
        console.log(`✅ Synced transaction ${transaction.id}`);
      } catch (error: any) {
        transaction.retryCount++;
        transaction.error = error.message;

        if (transaction.retryCount >= MAX_RETRIES) {
          transaction.status = 'failed';
          console.error(`❌ Transaction ${transaction.id} failed after ${MAX_RETRIES} retries:`, error);
        } else {
          transaction.status = 'pending';
          console.warn(`⚠️ Transaction ${transaction.id} failed (retry ${transaction.retryCount}/${MAX_RETRIES})`);
        }
      }

      this.saveQueue();
    }

    // Remove synced transactions older than 24h
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.queue = this.queue.filter(t =>
      t.status !== 'synced' || t.timestamp > oneDayAgo
    );
    this.saveQueue();

    this.isSyncing = false;
    console.log(`✨ Sync complete. ${this.queue.filter(t => t.status === 'pending').length} pending transactions remaining`);
  }

  private async executeTransaction(transaction: OfflineTransaction): Promise<void> {
    const { table, operation, data } = transaction;

    switch (operation) {
      case 'insert': {
        const { error: insertError } = await supabase
          .from(table)
          .insert(data);
        if (insertError) throw insertError;
        break;
      }

      case 'update': {
        const { id, ...updateData } = data;
        const { error: updateError } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', id);
        if (updateError) throw updateError;
        break;
      }

      case 'delete': {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', data.id);
        if (deleteError) throw deleteError;
        break;
      }
    }
  }

  public getQueueStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(t => t.status === 'pending').length,
      syncing: this.queue.filter(t => t.status === 'syncing').length,
      synced: this.queue.filter(t => t.status === 'synced').length,
      failed: this.queue.filter(t => t.status === 'failed').length,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }

  public getQueue(): OfflineTransaction[] {
    return [...this.queue];
  }

  public clearQueue() {
    this.queue = [];
    this.saveQueue();
    console.log('🗑️ Offline queue cleared');
  }

  public retryFailed() {
    this.queue.forEach(t => {
      if (t.status === 'failed') {
        t.status = 'pending';
        t.retryCount = 0;
        t.error = undefined;
      }
    });
    this.saveQueue();
    this.syncQueue();
  }

  public onConnectionChange(callback: (isOnline: boolean) => void) {
    this.listeners.add(callback);
    callback(this.isOnline); // Immediate callback with current status
    return () => this.listeners.delete(callback);
  }

  public onSyncUpdate(callback: (queue: OfflineTransaction[]) => void) {
    this.syncListeners.add(callback);
    callback(this.queue); // Immediate callback with current queue
    return () => this.syncListeners.delete(callback);
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(callback => callback(isOnline));
  }

  private notifySyncListeners() {
    this.syncListeners.forEach(callback => callback(this.queue));
  }
}

// Singleton instance
export const offlineManager = new OfflineManager();

/**
 * Wrapper for Supabase operations with offline support
 */
export const offlineSupabase = {
  async insert(table: string, data: any) {
    if (!navigator.onLine) {
      const id = offlineManager.addTransaction(table, 'insert', data);
      return { data: { ...data, id }, error: null };
    }

    const result = await supabase.from(table).insert(data).select();

    // If online but request fails, queue for retry
    if (result.error && result.error.message.includes('network')) {
      offlineManager.addTransaction(table, 'insert', data);
    }

    return result;
  },

  async update(table: string, id: string, data: any) {
    if (!navigator.onLine) {
      offlineManager.addTransaction(table, 'update', { id, ...data });
      return { data: { id, ...data }, error: null };
    }

    const result = await supabase.from(table).update(data).eq('id', id).select();

    if (result.error && result.error.message.includes('network')) {
      offlineManager.addTransaction(table, 'update', { id, ...data });
    }

    return result;
  },

  async delete(table: string, id: string) {
    if (!navigator.onLine) {
      offlineManager.addTransaction(table, 'delete', { id });
      return { error: null };
    }

    const result = await supabase.from(table).delete().eq('id', id);

    if (result.error && result.error.message.includes('network')) {
      offlineManager.addTransaction(table, 'delete', { id });
    }

    return result;
  },

  // Read operations use regular Supabase (can use local cache if needed)
  from: supabase.from.bind(supabase)
};
