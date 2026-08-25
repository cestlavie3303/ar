import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDocFromServer
} from 'firebase/firestore';
import { db } from './firebase';
import { Order, TeamMessage } from './types';

export const ORDERS_COLLECTION = 'orders';
export const MESSAGES_COLLECTION = 'team_messages';
export const USERS_COLLECTION = 'users';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Validates connection to Firestore backend
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_health', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.info('Firestore operating in offline cache mode.');
    }
    return false;
  }
}

/**
 * Subscribe to real-time updates for orders from Firebase Firestore
 */
export function subscribeToOrders(
  onOrdersUpdated: (orders: Order[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, ORDERS_COLLECTION), orderBy('created_at', 'desc'), limit(1000));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          list.push({
            ...data,
            id: docSnap.id,
          });
        });
        onOrdersUpdated(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, ORDERS_COLLECTION);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, ORDERS_COLLECTION);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save an order to Firebase Firestore directly
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  const path = `${ORDERS_COLLECTION}/${order.id}`;
  try {
    const docRef = doc(db, ORDERS_COLLECTION, order.id);
    await setDoc(docRef, order, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Mark reservation as delivered in Firebase Firestore
 */
export async function updateOrderReservationStatusInFirestore(
  orderId: string, 
  status: 'pending' | 'delivered',
  deliveredBy?: string
): Promise<void> {
  const path = `${ORDERS_COLLECTION}/${orderId}`;
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await setDoc(docRef, {
      reservation_status: status,
      delivered_at: status === 'delivered' ? new Date().toISOString() : null,
      delivered_by: deliveredBy || null,
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete an order from Firebase Firestore
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const path = `${ORDERS_COLLECTION}/${orderId}`;
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Subscribe to team messages in real-time
 */
export function subscribeToTeamMessages(
  onMessagesUpdated: (messages: TeamMessage[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, MESSAGES_COLLECTION), orderBy('created_at', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: TeamMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as TeamMessage;
          list.push({
            ...data,
            id: docSnap.id,
          });
        });
        onMessagesUpdated(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, MESSAGES_COLLECTION);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, MESSAGES_COLLECTION);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Post a new team message to Firestore
 */
export async function saveTeamMessageToFirestore(message: TeamMessage): Promise<void> {
  const path = `${MESSAGES_COLLECTION}/${message.id}`;
  try {
    const docRef = doc(db, MESSAGES_COLLECTION, message.id);
    await setDoc(docRef, message);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Subscribe to users updates in Firestore
 */
export function subscribeToUsers(
  onUsersUpdated: (users: any[]) => void,
  onError?: (err: any) => void
) {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy('created_at', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({
            ...docSnap.data(),
            id: docSnap.id,
          });
        });
        onUsersUpdated(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, USERS_COLLECTION);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, USERS_COLLECTION);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save user to Firestore
 */
export async function saveUserToFirestore(user: any): Promise<void> {
  const path = `${USERS_COLLECTION}/${user.id}`;
  try {
    const docRef = doc(db, USERS_COLLECTION, user.id);
    await setDoc(docRef, user, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete user from Firestore
 */
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

