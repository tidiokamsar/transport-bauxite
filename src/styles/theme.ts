export const theme = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    warning: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    info: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  }
};

export const statusColors = {
  active: 'bg-green-100 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-700 border-gray-200',
  maintenance: 'bg-orange-100 text-orange-700 border-orange-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
};

export const buttonStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors',
  success: 'bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm',
  danger: 'bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm',
  warning: 'bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm',
  outline: 'border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors',
};

export const cardStyles = 'bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow';

export const inputStyles = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';

export const labelStyles = 'block text-sm font-medium text-gray-700 mb-1';

export const tableStyles = {
  container: 'bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden',
  header: 'bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200',
  headerCell: 'px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider',
  row: 'border-b border-gray-100 hover:bg-gray-50 transition-colors',
  cell: 'px-6 py-4 text-sm text-gray-900',
};
