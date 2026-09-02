import { AlertCircle } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  description: string;
  icon?: any;
}

export const PlaceholderView = ({ title, description, icon: Icon = AlertCircle }: PlaceholderViewProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-600 mt-1">{description}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-slate-100 rounded-full mb-4">
            <Icon className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Module en cours de développement</h3>
          <p className="text-slate-600 max-w-md">
            Cette fonctionnalité sera disponible prochainement. Le système SIGTB est conçu pour
            être extensible et évolutif.
          </p>
        </div>
      </div>
    </div>
  );
};
