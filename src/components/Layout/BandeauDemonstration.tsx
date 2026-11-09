import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Bandeau present sur tous les ecrans tant que des donnees de
// demonstration sont chargees (D-020, table sigtb_demonstration).
export const BandeauDemonstration = () => {
  const [signal, setSignal] = useState<{ chargee_le: string | null } | null>(null);

  useEffect(() => {
    let actif = true;
    supabase
      .from('sigtb_demonstration')
      .select('active, chargee_le')
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (actif) setSignal(data ? { chargee_le: data.chargee_le } : null);
      });
    return () => {
      actif = false;
    };
  }, []);

  if (!signal) return null;

  return (
    <div
      role="status"
      className="flex flex-shrink-0 items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,#7c2d12_0,#7c2d12_14px,#9a3412_14px,#9a3412_28px)] px-4 py-1.5 text-center text-sm font-semibold text-white"
    >
      <FlaskConical className="h-4 w-4 flex-shrink-0" />
      <span>
        DONNÉES DE DÉMONSTRATION : fictives, à purger avant l'exploitation réelle
        {signal.chargee_le
          ? ` · chargées le ${new Date(signal.chargee_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
          : ''}
      </span>
    </div>
  );
};
