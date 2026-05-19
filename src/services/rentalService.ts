import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  orderBy,
  onSnapshot,
  where
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Rental, RentalStatus } from '../types';
import { handleFirestoreError, OperationType } from '../errorUtils';

const COLLECTION_NAME = 'rentals';

export const rentalService = {
  async getAll() {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      const q = query(collection(db, COLLECTION_NAME), where('ownerId', '==', user.uid), orderBy('startDate', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rental));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      return [];
    }
  },

  subscribe(callback: (rentals: Rental[]) => void) {
    const user = auth.currentUser;
    if (!user) return () => {};
    const q = query(collection(db, COLLECTION_NAME), where('ownerId', '==', user.uid), orderBy('startDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const rentals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rental));
      callback(rentals);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    });
  },

  async getById(id: string) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as Rental;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${id}`);
      return null;
    }
  },

  async create(rental: Omit<Rental, 'id' | 'ownerId'>) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    
    // Check availability for each item before creating
    for (const item of rental.items) {
      const available = await this.getAvailableStock(item.equipmentId, rental.startDate, rental.endDate);
      if (item.quantity > available) {
        throw new Error(`Estoque insuficiente para ${item.name}. Disponível: ${available}`);
      }
    }

    try {
      return await addDoc(collection(db, COLLECTION_NAME), { ...rental, ownerId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  async getAvailableStock(equipmentId: string, startDate: string, endDate: string): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    // 1. Get equipment total stock
    const equipRef = doc(db, 'equipments', equipmentId);
    const equipSnap = await getDoc(equipRef);
    if (!equipSnap.exists()) return 0;
    const totalStock = equipSnap.data().totalStock || 0;

    // 2. Get all overlapping rentals (not cancelled)
    // Overlap condition: (rental.startDate <= endDate) AND (rental.endDate >= startDate)
    const q = query(
      collection(db, COLLECTION_NAME),
      where('ownerId', '==', user.uid),
      where('status', 'not-in', [RentalStatus.CANCELLED, RentalStatus.RETURNED])
    );

    const snapshot = await getDocs(q);
    const overlappingRentals = snapshot.docs.filter(doc => {
      const rental = doc.data();
      return rental.startDate <= endDate && rental.endDate >= startDate;
    });

    // 3. Sum used quantity
    let usedQuantity = 0;
    overlappingRentals.forEach(doc => {
      const rental = doc.data() as Rental;
      const item = rental.items.find(i => i.equipmentId === equipmentId);
      if (item) {
        usedQuantity += item.quantity;
      }
    });

    return Math.max(0, totalStock - usedQuantity);
  },

  async update(id: string, rental: Partial<Rental>) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, { ...rental, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  async delete(id: string) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  }
};
