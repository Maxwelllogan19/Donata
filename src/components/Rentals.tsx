import React from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  Calendar, 
  Trash2,
  XCircle,
  Users,
  Package,
  ArrowRight,
  AlertCircle,
  MessageCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { rentalService } from '../services/rentalService';
import { equipmentService } from '../services/equipmentService';
import { Rental, RentalStatus, Equipment, RentalItem } from '../types';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Rentals() {
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // Form State
  const [selectedItems, setSelectedItems] = React.useState<(RentalItem & { available?: number })[]>([]);
  const [discount, setDiscount] = React.useState(0);
  const [deliveryFee, setDeliveryFee] = React.useState(0);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const days = React.useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = differenceInDays(end, start);
    return Math.max(1, diff);
  }, [startDate, endDate]);

  React.useEffect(() => {
    const unsubRentals = rentalService.subscribe(setRentals);
    const unsubEquipments = equipmentService.subscribe(setEquipments);
    return () => { unsubRentals(); unsubEquipments(); };
  }, []);

  // Update availability when dates change
  React.useEffect(() => {
    if (startDate && endDate && selectedItems.length > 0) {
      const updateAvailabilities = async () => {
        const updated = await Promise.all(selectedItems.map(async (item) => {
          const avail = await rentalService.getAvailableStock(item.equipmentId, startDate, endDate);
          return { ...item, available: avail };
        }));
        setSelectedItems(updated);
      };
      updateAvailabilities();
    }
  }, [startDate, endDate]);

  const filtered = rentals.filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = selectedItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const total = subtotal + deliveryFee - discount;

  // Recalculate item prices when days change
  React.useEffect(() => {
    setSelectedItems(prev => prev.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice * days
    })));
  }, [days]);

  const handleAddItem = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const equipId = e.target.value;
    if (!equipId) return;

    if (!startDate || !endDate) {
      alert("Por favor, selecione as datas de início e fim primeiro.");
      e.target.value = "";
      return;
    }
    
    const equip = equipments.find(eq => eq.id === equipId);
    if (!equip) return;

    if (selectedItems.find(i => i.equipmentId === equipId)) return;

    const available = await rentalService.getAvailableStock(equipId, startDate, endDate);

    setSelectedItems([...selectedItems, {
      equipmentId: equipId,
      name: equip.name,
      quantity: 1,
      unitPrice: equip.unitPrice,
      totalPrice: equip.unitPrice * days,
      available: available
    }]);

    e.target.value = "";
  };

  const updateItemQuantity = (id: string, qty: number) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.equipmentId === id) {
        const newQty = Math.max(1, qty);
        return {
          ...item,
          quantity: newQty,
          totalPrice: newQty * item.unitPrice * days
        };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setSelectedItems(selectedItems.filter(i => i.equipmentId !== id));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    const hasInventoryIssue = selectedItems.some(item => item.quantity > (item.available ?? 0));
    if (hasInventoryIssue) {
      setError("Um ou mais itens excedem a disponibilidade para estas datas.");
      setIsSubmitting(false);
      return;
    }

    const rentalData = {
      customerName: formData.get('customerName') as string,
      customerPhone: formData.get('customerPhone') as string,
      startDate: startDate,
      endDate: endDate,
      items: selectedItems.map(({ available, ...rest }) => rest),
      discount: discount,
      deliveryFee: deliveryFee,
      subtotal: subtotal,
      totalAmount: total,
      status: RentalStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await rentalService.create(rentalData);
      setIsFormOpen(false);
      setSelectedItems([]);
      setDiscount(0);
      setDeliveryFee(0);
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      setError(err.message || "Erro ao criar reserva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: RentalStatus) => {
    await rentalService.update(id, { status });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (deletingId) {
      await rentalService.delete(deletingId);
      setDeletingId(null);
    }
  };

  const shareViaWhatsApp = (rental: Rental) => {
    const itemsText = rental.items.map(i => `• ${i.quantity}x ${i.name}`).join('%0A');
    const message = `Olá ${rental.customerName}! 📝 segue o resumo do seu aluguel:%0A%0A` +
      `*Itens:*%0A${itemsText}%0A%0A` +
      `*Período:* ${format(new Date(rental.startDate), 'dd/MM/yyyy')} até ${format(new Date(rental.endDate), 'dd/MM/yyyy')}%0A` +
      `*Total:* R$ ${rental.totalAmount.toFixed(2)}%0A%0A` +
      `Status: ${rental.status.toUpperCase()}%0A%0A` +
      `Obrigado! 🙏`;
    
    const phone = rental.customerPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone.startsWith('55') ? phone : '55' + phone}?text=${message}`, '_blank');
  };

  const generateReceipt = (rental: Rental) => {
    const doc = new jsPDF();
    const daysCount = differenceInDays(new Date(rental.endDate), new Date(rental.startDate));

    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('RECIBO DE LOCAÇÃO', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data de Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 30);
    doc.text(`ID do Aluguel: ${rental.id}`, 20, 35);

    // Customer Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text('Informações do Cliente', 20, 50);
    doc.setFontSize(11);
    doc.text(`Nome: ${rental.customerName}`, 20, 60);
    doc.text(`Telefone: ${rental.customerPhone}`, 20, 67);
    doc.text(`Período: ${format(new Date(rental.startDate), 'dd/MM/yyyy')} até ${format(new Date(rental.endDate), 'dd/MM/yyyy')} (${daysCount} dias)`, 20, 74);

    // Items Table
    autoTable(doc, {
      startY: 85,
      head: [['Equipamento', 'Qtd', 'Vlr Unit. (por dia)', 'Total']],
      body: rental.items.map(item => [
        item.name,
        item.quantity,
        `R$ ${item.unitPrice.toFixed(2)}`,
        `R$ ${item.totalPrice.toFixed(2)}`
      ]),
      foot: [
        ['', '', 'Subtotal:', `R$ ${rental.subtotal.toFixed(2)}`],
        ['', '', 'Frete:', `R$ ${rental.deliveryFee.toFixed(2)}`],
        ['', '', 'Desconto:', `- R$ ${rental.discount.toFixed(2)}`],
        ['', '', 'TOTAL:', `R$ ${rental.totalAmount.toFixed(2)}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    // Signatures
    const finalY = (doc as any).lastAutoTable.finalY + 40;
    
    if (finalY < 270) {
      doc.line(20, finalY, 90, finalY);
      doc.text('Assinatura do Locador', 55, finalY + 5, { align: 'center' });
      
      doc.line(120, finalY, 190, finalY);
      doc.text('Assinatura do Locatário', 155, finalY + 5, { align: 'center' });
    }

    doc.save(`recibo_${rental.customerName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Aluguéis</h1>
          <p className="text-slate-500">Controle de reservas e devoluções.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="btn btn-primary gap-2"
        >
          <Plus size={20} /> Nova Reserva
        </button>
      </div>

      <div className="flex gap-4 p-4 card items-center">
        <Search className="text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por cliente..." 
          className="flex-1 bg-transparent outline-none text-slate-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-bottom border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Período</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Itens</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Total</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((rental) => (
              <tr key={rental.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-semibold text-slate-900">{rental.customerName}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Phone size={12} /> {rental.customerPhone}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar size={14} className="text-slate-400" />
                    <span>{format(new Date(rental.startDate), 'dd/MM')}</span>
                    <span className="text-slate-300">→</span>
                    <span>{format(new Date(rental.endDate), 'dd/MM')}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {differenceInDays(new Date(rental.endDate), new Date(rental.startDate))} diárias
                  </p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-2">
                    {rental.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600" title={item.name}>
                        {item.quantity}
                      </div>
                    ))}
                    {rental.items.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-600">
                        +{rental.items.length - 3}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-slate-900">
                  <div className="flex flex-col">
                    <span>R$ {rental.totalAmount.toFixed(2)}</span>
                    {rental.deliveryFee > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal">Incl. R$ {rental.deliveryFee} frete</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={rental.status} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <select 
                      className="text-xs border border-slate-200 rounded p-1 bg-white outline-none"
                      value={rental.status}
                      onChange={(e) => updateStatus(rental.id!, e.target.value as RentalStatus)}
                    >
                      <option value={RentalStatus.PENDING}>Pendente</option>
                      <option value={RentalStatus.CONFIRMED}>Confirmado</option>
                      <option value={RentalStatus.ACTIVE}>Com o Cliente</option>
                      <option value={RentalStatus.RETURNED}>Devolvido</option>
                      <option value={RentalStatus.CANCELLED}>Cancelado</option>
                    </select>
                    <button 
                      onClick={() => generateReceipt(rental)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Gerar Recibo"
                    >
                      <FileText size={16} />
                    </button>
                    <button 
                      onClick={() => shareViaWhatsApp(rental)}
                      className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Enviar via WhatsApp"
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(rental.id!)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white p-6 rounded-2xl shadow-xl"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Aluguel</h3>
              <p className="text-slate-500 mb-6">Deseja excluir este aluguel permanentemente? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="btn btn-secondary flex-1">Cancelar</button>
                <button onClick={confirmDelete} className="btn bg-red-600 hover:bg-red-700 text-white flex-1 font-semibold py-2 px-4 rounded-xl transition-all">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}

        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">Nova Locação</h2>
                <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle /></button>
              </div>

              <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Users size={18} className="text-blue-600" /> Dados do Cliente
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                        <input name="customerName" required className="input-field" placeholder="Ex: João Silva" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                        <input name="customerPhone" required className="input-field" placeholder="(00) 00000-0000" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Início</label>
                          <input 
                            type="date" 
                            name="startDate" 
                            required 
                            className="input-field" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Fim</label>
                          <input 
                            type="date" 
                            name="endDate" 
                            required 
                            className="input-field" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Package size={18} className="text-blue-600" /> Itens da Locação
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Adicionar Equipamento</label>
                      <select className="input-field" onChange={handleAddItem} value="">
                        <option value="">Selecione...</option>
                        {equipments.map(e => (
                          <option key={e.id} value={e.id}>{e.name} (R$ {e.unitPrice})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {selectedItems.map((item) => (
                        <div key={item.equipmentId} className={`flex items-center gap-3 p-3 rounded-lg border ${item.quantity > (item.available ?? 999) ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">R$ {item.unitPrice} / un</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.quantity > (item.available ?? 999) ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                Disp: {item.available ?? '...'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              className={`w-16 px-2 py-1 text-sm border rounded bg-white ${item.quantity > (item.available ?? 999) ? 'border-red-500 text-red-600' : 'border-slate-200'}`}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.equipmentId, parseInt(e.target.value))}
                            />
                            <button 
                              type="button" 
                              onClick={() => removeItem(item.equipmentId)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {selectedItems.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                          <Package size={32} className="mx-auto mb-2 opacity-20" />
                          <p className="text-sm">Nenhum item selecionado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="p-6 bg-slate-900 rounded-2xl text-white">
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal ({days} {days === 1 ? 'dia' : 'dias'})</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Frete / Entrega</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">R$</span>
                        <input 
                          type="number" 
                          className="w-24 bg-slate-800 border-none rounded px-2 py-1 text-right outline-none focus:ring-1 focus:ring-blue-500"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value)))}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Desconto</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">R$</span>
                        <input 
                          type="number" 
                          className="w-24 bg-slate-800 border-none rounded px-2 py-1 text-right outline-none focus:ring-1 focus:ring-blue-500"
                          value={discount}
                          onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                        />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xl font-bold">
                      <span className="text-blue-400 uppercase tracking-wider text-sm">Total a Pagar</span>
                      <span className="text-2xl">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 ${isSubmitting ? 'bg-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Confirmar Reserva <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
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

  const labels: any = {
    [RentalStatus.PENDING]: 'Pendente',
    [RentalStatus.CONFIRMED]: 'Confirmado',
    [RentalStatus.ACTIVE]: 'Com o Cliente',
    [RentalStatus.RETURNED]: 'Devolvido',
    [RentalStatus.CANCELLED]: 'Cancelado',
  };

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full whitespace-nowrap ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
