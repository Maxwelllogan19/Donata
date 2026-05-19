import React from 'react';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign, 
  ArrowUpRight,
  ChevronRight,
  Package
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { rentalService } from '../services/rentalService';
import { equipmentService } from '../services/equipmentService';
import { Rental, RentalStatus, Equipment } from '../types';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsubRentals = rentalService.subscribe(setRentals);
    const unsubEquipments = equipmentService.subscribe(setEquipments);
    return () => {
      unsubRentals();
      unsubEquipments();
    };
  }, []);

  const stats = React.useMemo(() => {
    const active = rentals.filter(r => r.status === RentalStatus.ACTIVE).length;
    const totalRevenue = rentals
      .filter(r => r.status === RentalStatus.RETURNED || r.status === RentalStatus.ACTIVE)
      .reduce((acc, r) => acc + r.totalAmount, 0);
    const pending = rentals.filter(r => r.status === RentalStatus.PENDING).length;
    const totalEquipment = equipments.reduce((acc, e) => acc + e.totalStock, 0);
    
    return { active, totalRevenue, pending, total: rentals.length, totalEquipment };
  }, [rentals, equipments]);

  const chartData = React.useMemo(() => {
    // Last 6 months
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now,
    });

    return months.map(m => {
      const monthStart = startOfMonth(m);
      const monthEnd = endOfMonth(m);
      const monthRentals = rentals.filter(r => {
        const d = new Date(r.startDate);
        return d >= monthStart && d <= monthEnd;
      });

      return {
        name: format(m, 'MMM', { locale: ptBR }),
        value: monthRentals.reduce((acc, r) => acc + r.totalAmount, 0),
      };
    });
  }, [rentals]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center text-slate-900">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-500">Visão geral do seu negócio de aluguéis.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-slate-900">
        <StatCard 
          label="Total Receita" 
          value={`R$ ${stats.totalRevenue.toLocaleString()}`} 
          icon={DollarSign} 
          color="blue"
        />
        <StatCard 
          label="Aluguéis Ativos" 
          value={stats.active} 
          icon={Calendar} 
          color="green"
        />
        <StatCard 
          label="Equipamentos" 
          value={stats.totalEquipment} 
          icon={Package} 
          color="orange"
        />
        <StatCard 
          label="Total de Locações" 
          value={stats.total} 
          icon={TrendingUp} 
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-slate-800">Faturamento Mensal</h2>
            <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
              Últimos 6 meses <ArrowUpRight size={14} />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === chartData.length - 1 ? '#4F46E5' : '#E2E8F0'} 
                      className="transition-all duration-300"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity & Inventory Link */}
        <div className="space-y-8">
          <div className="card p-6">
            <h2 className="font-semibold text-slate-800 mb-6">Aluguéis Recentes</h2>
            <div className="space-y-4">
              {rentals.length > 0 ? (
                rentals.slice(0, 5).map((rental) => (
                  <div key={rental.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{rental.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(rental.startDate), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">R$ {rental.totalAmount}</p>
                      <StatusBadge status={rental.status} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum aluguel recente.</p>
              )}
              <button 
                onClick={() => navigate('/rentals')}
                className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
              >
                Ver todos <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="card p-6 bg-blue-600 text-white border-none shadow-blue-200">
            <div className="flex items-center justify-between mb-4">
              <Package size={32} strokeWidth={1.5} />
              <button 
                onClick={() => navigate('/inventory')}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                title="Ver Estoque"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <h2 className="font-bold text-lg mb-1">Catálogo de Itens</h2>
            <p className="text-blue-100 text-sm mb-4">Veja todos os equipamentos disponíveis para locação.</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{equipments.length}</span>
              <span className="text-blue-200 text-sm">Itens diferentes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: RentalStatus }) {
  const styles: any = {
    [RentalStatus.PENDING]: 'bg-slate-100 text-slate-700',
    [RentalStatus.CONFIRMED]: 'bg-blue-100 text-blue-700',
    [RentalStatus.ACTIVE]: 'bg-yellow-100 text-yellow-700',
    [RentalStatus.RETURNED]: 'bg-emerald-100 text-emerald-700',
    [RentalStatus.CANCELLED]: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${styles[status]}`}>
      {status === RentalStatus.PENDING ? 'Pendente' : 
       status === RentalStatus.CONFIRMED ? 'Confirmado' :
       status === RentalStatus.ACTIVE ? 'Com o Cliente' :
       status === RentalStatus.RETURNED ? 'Devolvido' : 'Cancelado'}
    </span>
  );
}
