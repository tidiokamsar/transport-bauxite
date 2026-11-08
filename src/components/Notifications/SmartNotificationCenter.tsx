import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, Info, X, Star, Filter, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import NotificationModal from './NotificationModal';

interface Notification {
  id: string;
  notification_type: string;
  category: string;
  priority: number;
  title: string;
  message: string;
  action_url: string;
  action_label: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  expires_at: string;
}

export default function SmartNotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [filterCategory, showUnreadOnly]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('smart_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      if (showUnreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data } = await query;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('smart_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    loadNotifications();
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('smart_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);
    loadNotifications();
  };

  const dismissNotification = async (id: string) => {
    await supabase
      .from('smart_notifications')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', id);
    loadNotifications();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'warning':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'success':
        return 'border-l-4 border-green-500 bg-green-50';
      default:
        return 'border-l-4 border-blue-500 bg-blue-50';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-600" />
            Smart Notification Center
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-semibold px-3 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">Intelligent priority-based alerts and updates</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setSelectedNotification(null); setShowModal(true); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            New
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Unread only</span>
        </label>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Bell className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 text-lg">No notifications</p>
            <p className="text-sm text-gray-500 mt-1">
              {showUnreadOnly
                ? 'All caught up! No unread notifications.'
                : 'Click "Generate Notifications" to create smart alerts'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${
                !notification.is_read ? 'shadow-md' : ''
              }`}
            >
              <div className={`p-5 ${getCategoryStyle(notification.category)}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getCategoryIcon(notification.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          {notification.title}
                          {notification.priority >= 8 && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                          {!notification.is_read && (
                            <span className="bg-blue-500 h-2 w-2 rounded-full"></span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          Priority: {notification.priority}/10
                        </span>
                        <button
                          onClick={() => dismissNotification(notification.id)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Dismiss"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                      {notification.action_label && (
                        <button className="text-xs font-semibold text-gray-900 bg-white px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                          {notification.action_label}
                        </button>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Notification Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{notifications.length}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
              <div className="text-sm text-gray-600">Unread</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {notifications.filter(n => n.category === 'critical').length}
              </div>
              <div className="text-sm text-gray-600">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {notifications.filter(n => n.priority >= 7).length}
              </div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <NotificationModal
          notification={selectedNotification}
          onClose={() => setShowModal(false)}
          onSave={loadNotifications}
        />
      )}
    </div>
  );
}