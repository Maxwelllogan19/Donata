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
import { Equipment } from '../types';
import { handleFirestoreError, OperationType } from '../errorUtils';

const COLLECTION_NAME = 'equipments';

export const equipmentService = {
  async getAll() {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      return [];
    }
  },

  subscribe(callback: (equipments: Equipment[]) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
    return onSnapshot(q, (snapshot) => {
      const equipments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
      callback(equipments);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    });
  },

  async getById(id: string) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as Equipment;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${id}`);
      return null;
    }
  },

  async create(equipment: Omit<Equipment, 'id' | 'ownerId'>) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    try {
      return await addDoc(collection(db, COLLECTION_NAME), { ...equipment, ownerId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  async update(id: string, equipment: Partial<Equipment>) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, equipment);
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
