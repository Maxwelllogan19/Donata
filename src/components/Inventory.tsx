import React from 'react';
import { Plus, Search, Trash2, Edit2, Package, ImagePlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { equipmentService } from '../services/equipmentService';
import { Equipment } from '../types';
import { auth } from '../lib/firebase';

export default function Inventory() {
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return equipmentService.subscribe(setEquipments);
  }, []);

  const filtered = equipments.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataurl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataurl);
        };
        img.onerror = (err) => reject(new Error("Erro ao carregar imagem para compressão: " + err));
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      let imageUrl = formData.get('imageUrl') as string;
      
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        // Using base64 compression instead of Firebase Storage to bypass configuration issues
        imageUrl = await compressImage(file);
      }

      const data = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        category: formData.get('category') as string,
        imageUrl: imageUrl,
        unitPrice: Number(formData.get('unitPrice')),
        totalStock: Number(formData.get('totalStock')),
      };

      if (editingId) {
        await equipmentService.update(editingId, data);
      } else {
        await equipmentService.create(data);
      }
      setIsFormOpen(false);
      setEditingId(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error saving equipment:", error);
      alert("Erro ao salvar equipamento. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (deletingId) {
      await equipmentService.delete(deletingId);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estoque</h1>
          <p className="text-slate-500">Gerencie seus equipamentos e disponibilidade.</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setPreviewUrl(null); setIsFormOpen(true); }}
          className="btn btn-primary gap-2"
        >
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="flex gap-4 p-4 card items-center">
        <Search className="text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nome ou categoria..." 
          className="flex-1 bg-transparent outline-none text-slate-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <motion.div 
              layout
              key={item.id} 
              className="card group"
            >
              <div className="relative h-48 w-full overflow-hidden rounded-t-2xl bg-slate-100">
                {item.imageUrl ? (
                  <img 
                    src={item.imageUrl} 
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-300">
                    <Package size={48} strokeWidth={1} />
                  </div>
                )}
                {auth.currentUser?.uid === item.ownerId && (
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingId(item.id!); setPreviewUrl(null); setIsFormOpen(true); }}
                      className="p-2 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-blue-600 rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id!); }}
                      className="p-2 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-red-600 rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-blue-600 rounded-full shadow-sm">
                    {item.category}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-semibold text-slate-900 mb-1">{item.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">{item.description}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400">Preço Unitário</p>
                    <p className="font-bold text-slate-900">R$ {item.unitPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">No Estoque</p>
                    <p className="font-bold text-slate-900">{item.totalStock} un</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="lg:col-span-3 py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Package size={32} />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">Nenhum equipamento encontrado</p>
              <p className="text-slate-500">Comece cadastrando novos itens no estoque clicando em "Novo Item".</p>
            </div>
          </div>
        )}
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
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmar Exclusão</h3>
              <p className="text-slate-500 mb-6">Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.</p>
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
            >
              <form onSubmit={handleSubmit} className="p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-6">
                  {editingId ? 'Editar Item' : 'Novo Item de Inventário'}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                    <input name="name" required className="input-field" defaultValue={editingId ? equipments.find(e => e.id === editingId)?.name : ''} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                    <select name="category" className="input-field" defaultValue={editingId ? equipments.find(e => e.id === editingId)?.category : 'Móveis'}>
                      <option>Móveis</option>
                      <option>Tendas/Coberturas</option>
                      <option>Decoração</option>
                      <option>Som/Luz</option>
                      <option>Utensílios</option>
                      <option>Frete</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Foto do Equipamento</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="relative h-40 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 transition-colors bg-slate-50 overflow-hidden"
                    >
                      {previewUrl || (editingId && equipments.find(e => e.id === editingId)?.imageUrl) ? (
                        <img 
                          src={previewUrl || equipments.find(e => e.id === editingId)?.imageUrl} 
                          className="absolute inset-0 w-full h-full object-cover" 
                          alt="Preview"
                        />
                      ) : (
                        <>
                          <ImagePlus className="text-slate-400" size={32} />
                          <span className="text-xs text-slate-500 font-medium">Clique para fazer upload</span>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL da Imagem (Opcional)</label>
                    <input 
                      name="imageUrl" 
                      placeholder="https://exemplo.com/imagem.jpg"
                      className="input-field" 
                      defaultValue={editingId ? equipments.find(e => e.id === editingId)?.imageUrl : ''} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <textarea name="description" className="input-field h-24 resize-none" defaultValue={editingId ? equipments.find(e => e.id === editingId)?.description : ''}></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Preço Unitário (R$)</label>
                      <input type="number" step="0.01" name="unitPrice" required className="input-field" defaultValue={editingId ? equipments.find(e => e.id === editingId)?.unitPrice : ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Total</label>
                      <input type="number" name="totalStock" required className="input-field" defaultValue={editingId ? equipments.find(e => e.id === editingId)?.totalStock : ''} />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => { setIsFormOpen(false); setPreviewUrl(null); }} className="btn btn-secondary flex-1" disabled={uploading}>Cancelar</button>
                  <button type="submit" className="btn btn-primary flex-1" disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
