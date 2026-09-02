import React, { useState } from 'react';
import { X, Save, Bell, AlertTriangle, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface NotificationModalProps {
  notification: any;
  onClose: () => void;
  onSave: () => void;
}

export default function NotificationModal({ notification, onClose, onSave }: NotificationModalProps) {
  const [formData, setFormData] = useState({
    notification_type: notification?.notification_type || 'custom',
    category: notification?.category || 'info',
    priority: notification?.priority || 5,
    title: notification?.title || '',
    message: notification?.message || '',
    action_url: notification?.action_url || '',
    action_label: notification?.action_label || '',
    expires_at: notification?.expires_at?.split('T')[0] || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dataToSave = {
        ...formData,
        user_id: user.id,
        is_read: notification?.is_read || false,
        is_dismissed: false,
        metadata: { custom: true }
      };

      if (notification?.id) {
        await supabase
          .from('smart_notifications')
          .update(dataToSave)
          .eq('id', notification.id);
      } else {
        await supabase
          .from('smart_notifications')
          .insert(dataToSave);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving notification:', error);
      alert('Error saving notification');
    } finally {
      setLoading(false);
    }
  };

  const notificationTypes = [
    { value: 'custom', label: 'Custom' },
    { value: 'maintenance_due', label: 'Maintenance Due' },
    { value: 'fuel_alert', label: 'Fuel Alert' },
    { value: 'driver_performance', label: 'Driver Performance' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'cost_savings', label: 'Cost Savings' },
    { value: 'predictive_alert', label: 'Predictive Alert' },
    { value: 'achievement', label: 'Achievement' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl border-b border-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6" />
              <h2 className="text-2xl font-bold">
                {notification?.id ? 'Edit Notification' : 'Create Notification'}
              </h2>
            </div>
            <button onClick={onClose} className="text-white hover:bg-blue-500 p-2 rounded-lg transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Type
              </label>
              <select
                value={formData.notification_type}
                onChange={(e) => setFormData({ ...formData, notification_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {notificationTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="critical">Critical (Red)</option>
                <option value="warning">Warning (Yellow)</option>
                <option value="info">Info (Blue)</option>
                <option value="success">Success (Green)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Star className="inline h-4 w-4 mr-1" />
                Priority (1-10) *
              </label>
              <input
                type="range"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                min="1"
                max="10"
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Low (1)</span>
                <span className="font-bold text-lg">{formData.priority}</span>
                <span>Critical (10)</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Enter notification title..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message *
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={4}
                placeholder="Enter notification message..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Action Label
              </label>
              <input
                type="text"
                value={formData.action_label}
                onChange={(e) => setFormData({ ...formData, action_label: e.target.value })}
                placeholder="e.g., View Details"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Action URL
              </label>
              <input
                type="text"
                value={formData.action_url}
                onChange={(e) => setFormData({ ...formData, action_url: e.target.value })}
                placeholder="/dashboard"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Expiration Date (Optional)
              </label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Leave empty for no expiration
              </p>
            </div>
          </div>

          <div className={`rounded-lg p-4 border-l-4 ${
            formData.category === 'critical' ? 'bg-red-50 border-red-500' :
            formData.category === 'warning' ? 'bg-yellow-50 border-yellow-500' :
            formData.category === 'success' ? 'bg-green-50 border-green-500' :
            'bg-blue-50 border-blue-500'
          }`}>
            <h3 className="font-semibold mb-2">Preview</h3>
            <div className="font-bold">{formData.title || 'Notification Title'}</div>
            <div className="text-sm mt-1">{formData.message || 'Notification message will appear here...'}</div>
            {formData.action_label && (
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium"
              >
                {formData.action_label}
              </button>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use Critical for urgent matters requiring immediate action</li>
              <li>• Priority 8+ notifications show a star icon</li>
              <li>• Action buttons help users take quick action</li>
              <li>• Set expiration dates for time-sensitive notifications</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {loading ? 'Saving...' : (notification?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}