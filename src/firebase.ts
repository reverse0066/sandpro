/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Receipt, OrganizationSettings, User } from './types';

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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Failed to sign in with Google:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Failed to sign out:', error);
    throw error;
  }
}

export function subscribeToAuthChanges(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function saveReceiptToFirestore(receipt: Receipt, userId: string): Promise<void> {
  const path = 'receipts';
  try {
    const docRef = doc(db, path, receipt.id);
    const receiptData = {
      ...receipt,
      userId,
      createdAt: new Date().toISOString()
    };
    await setDoc(docRef, receiptData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteReceiptFromFirestore(receiptId: string): Promise<void> {
  const path = 'receipts';
  try {
    await deleteDoc(doc(db, path, receiptId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${receiptId}`);
  }
}

export async function clearUserReceiptsFromFirestore(userId: string): Promise<void> {
  const path = 'receipts';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserReceipts(
  userId: string, 
  onUpdate: (receipts: Receipt[]) => void, 
  onError?: (err: Error) => void
) {
  const path = 'receipts';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const receipts: Receipt[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Receipt;
        receipts.push(data);
      });
      // Sort descending by date or receiptNo
      receipts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      onUpdate(receipts);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        if (onError && err instanceof Error) {
          onError(err);
        }
      }
    }
  );
}

export async function saveSettingsToFirestore(settings: OrganizationSettings, userId: string): Promise<void> {
  const path = `settings`;
  try {
    const docRef = doc(db, path, userId);
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadSettingsFromFirestore(userId: string): Promise<OrganizationSettings | null> {
  const path = `settings`;
  try {
    const docRef = doc(db, path, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as OrganizationSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${userId}`);
    return null;
  }
}

export async function saveUsersToFirestore(users: User[], userId: string): Promise<void> {
  const path = `users_list`;
  try {
    const docRef = doc(db, path, userId);
    await setDoc(docRef, { users }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUsersFromFirestore(userId: string): Promise<User[] | null> {
  const path = `users_list`;
  try {
    const docRef = doc(db, path, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.users as User[];
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${userId}`);
    return null;
  }
}
