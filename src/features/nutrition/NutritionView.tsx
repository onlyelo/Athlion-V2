import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Target { date: string; dayTss: number; kcal: number; protein_g: number; carb_g: number; fat_g: number; }
interface MenuDay { date: string; jour: string; petit_dej?: string; dejeuner?: string; diner?: string; collation?: string; }
interface BatchDay { jour: string; taches: string[]; }
interface ShoppingItem { item: string; prix_eur: number | null; }
interface ShoppingObj { items: ShoppingItem[]; total_eur: number | null; budget_max_eur: number | null; }
type ShoppingList = string[] | ShoppingObj;
interface NutritionData {
  week: string;
  dates: string[];
  batchDays: Record<string, string>;
  targets: Target[];
  plan: { menu: MenuDay[]; batch_plan: BatchDay[]; shopping_list: ShoppingList; status: string } | null;
}

// La liste de courses peut être un tableau de chaînes (ancien format) ou un objet enrichi.
function normShopping(sl: ShoppingList | undefined): ShoppingObj {
  if (!sl) return { items: [], total_eur: null, budget_max_eur: null };
  if (Array.isArray(sl)) return { items: sl.map(s => ({ item: String(s), prix_eur: null })), total_eur: null, budget_max_eur: null };
  return { items: sl.items ?? [], total_eur: sl.total_eur ?? null, budget_max_eur: sl.budget_max_eur ?? null };
}

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' });

export function NutritionView() {
  const qc = useQueryClient();
  const [gen, setGen] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [budget, setBudget] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['nutrition'], queryFn: () => api.get<NutritionData>('/nutrition') });

  const shopping = normShopping(data?.plan?.shopping_list);

  // Préremplit le budget depuis le dernier plan généré.
  useEffect(() => {
    if (shopping.budget_max_eur != null) setBudget(String(shopping.budget_max_eur));
  }, [shopping.budget_max_eur]);

  async function generate() {
    setGen(true);
    try {
      const budgetMax = budget.trim() ? Number(budget) : undefined;
      await api.post('/nutrition/generate', budgetMax ? { budgetMax } : {});
      await qc.invalidateQueries({ queryKey: ['nutrition'] });
    } catch {
      alert("La génération a échoué. Réessaie dans un instant.");
    } finally { setGen(false); }
  }

  if (isLoading) return <span className="label">Chargement…</span>;
  const targets = data?.targets ?? [];
  const menu = data?.plan?.menu ?? [];
  const batch = data?.plan?.batch_plan ?? [];
  const courses = shopping.items;
  const menuByDate = Object.fromEntries(menu.map(m => [m.date, m]));
  const weekKcal = targets.reduce((s, t) => s + t.kcal, 0);
  const overBudget = shopping.total_eur != null && shopping.budget_max_eur != null && shopping.total_eur > shopping.budget_max_eur;

  return (
    <div className="stack">
      <div className="row between">
        <h1 className="heading-1">Nutrition</h1>
        <button className="btn btn--primary btn--sm" onClick={generate} disabled={gen}>
          {gen ? <span className="spin" /> : '✦ Générer mes menus'}
        </button>
      </div>

      <p className="body-sm" style={{ marginTop: -6 }}>Semaine prochaine · besoins calés sur ta charge d'entraînement. Idéal à configurer jeudi/vendredi.</p>

      {/* Besoins de la semaine */}
      <div className="card-glass">
        <div className="section-label">Besoins — semaine</div>
        <div className="row between">
          <div><span className="gauge text-plasma">{Math.round(weekKcal / 7)}</span><span className="body-sm" style={{ marginLeft: 6 }}>kcal/j moy.</span></div>
          <span className="body-sm">{Math.round(weekKcal / 1000)}k kcal / semaine</span>
        </div>
      </div>

      {/* Budget courses */}
      <div className="card">
        <div className="section-label">💶 Budget courses</div>
        <div className="row between" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="body-sm" style={{ display: 'block', marginBottom: 4 }}>Plafond / semaine (€)</span>
            <input className="input" type="number" inputMode="decimal" min={0} step={5}
              placeholder="ex : 60" value={budget} onChange={e => setBudget(e.target.value)} />
          </div>
          {shopping.total_eur != null && (
            <div style={{ textAlign: 'right' }}>
              <div className={`gauge ${overBudget ? 'text-danger' : 'text-success'}`} style={{ fontSize: 30 }}>
                {shopping.total_eur.toFixed(0)}<span style={{ fontSize: 15 }}> €</span>
              </div>
              <span className="body-sm">estimé{shopping.budget_max_eur != null ? ` · plafond ${shopping.budget_max_eur} €` : ''}</span>
            </div>
          )}
        </div>
        {overBudget && <p className="body-sm text-danger" style={{ marginTop: 8 }}>Au-dessus du plafond — relance la génération pour des menus plus économiques.</p>}
        {shopping.total_eur == null && <p className="body-sm" style={{ marginTop: 8, color: 'var(--text-muted)' }}>Fixe un plafond (optionnel) puis génère : l'IA estime le coût et adapte les menus pour le respecter.</p>}
      </div>

      {/* Batch cooking */}
      <div className="card">
        <div className="section-label">🍲 Batch cooking</div>
        {batch.length > 0 ? (
          <div className="stack" style={{ gap: 10 }}>
            {batch.map((b, i) => (
              <div key={i}>
                <div className="heading-3" style={{ marginBottom: 4 }}>{b.jour}</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {b.taches.map((t, j) => <li key={j} className="body-sm" style={{ marginBottom: 2 }}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {Object.values(data?.batchDays ?? {}).map((label, i) => <span key={i} className="body-sm">• {label}</span>)}
            <span className="body-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>Génère tes menus pour obtenir les tâches de prépa.</span>
          </div>
        )}
      </div>

      {/* Jours : cibles + menu */}
      <div className="section-label" style={{ marginBottom: 0 }}>Jour par jour</div>
      <div className="stack" style={{ gap: 8 }}>
        {targets.map(t => {
          const md = menuByDate[t.date];
          const isOpen = openDay === t.date;
          return (
            <div key={t.date} className="card" style={{ padding: '12px 14px' }}>
              <div className="row between" style={{ cursor: md ? 'pointer' : 'default' }} onClick={() => md && setOpenDay(o => o === t.date ? null : t.date)}>
                <div>
                  <div className="activity-title" style={{ textTransform: 'capitalize' }}>{shortDay(t.date)}</div>
                  <div className="activity-sub">{t.dayTss ? `charge ${t.dayTss} TSS` : 'repos'} · {t.carb_g}g glucides</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="mono">{t.kcal} kcal</span>
                  <div className="activity-sub">{t.protein_g}P · {t.carb_g}G · {t.fat_g}L</div>
                </div>
              </div>
              {md && isOpen && (
                <div className="stack" style={{ gap: 6, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--glass-border)' }}>
                  <Meal label="Petit-déj" v={md.petit_dej} />
                  <Meal label="Déjeuner" v={md.dejeuner} />
                  <Meal label="Dîner" v={md.diner} />
                  <Meal label="Collation" v={md.collation} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Liste de courses */}
      {courses.length > 0 && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 4 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>🛒 Liste de courses</div>
            {shopping.total_eur != null && <span className="mono">{shopping.total_eur.toFixed(2)} €</span>}
          </div>
          <div className="stack" style={{ gap: 3 }}>
            {courses.map((c, i) => (
              <div key={i} className="row between">
                <span className="body-sm">• {c.item}</span>
                {c.prix_eur != null && <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.prix_eur.toFixed(2)} €</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Meal({ label, v }: { label: string; v?: string }) {
  if (!v) return null;
  return <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}><span className="label" style={{ minWidth: 64, paddingTop: 2 }}>{label}</span><span className="body-sm" style={{ flex: 1, color: 'var(--text-primary)' }}>{v}</span></div>;
}
