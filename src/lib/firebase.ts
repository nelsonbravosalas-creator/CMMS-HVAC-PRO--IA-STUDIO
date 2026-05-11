/**
 * Módulo de configuración e inicialización de los servicios de Firebase Core.
 * Centraliza el acceso a Firestore y Auth para toda la aplicación.
 * 
 * @module lib/firebase
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicialización de la aplicación de Firebase
const app = initializeApp(firebaseConfig);

/**
 * Instancia global de Firestore Database.
 * Acceso directo a las colecciones: 'equipos', 'tickets', 'users'.
 */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Instancia global de Firebase Authentication.
 * Gestiona el estado de la sesión actual del usuario.
 */
export const auth = getAuth(app);

/**
 * Función autoejecutable que valida la conexión con el servidor al arrancar.
 * Asegura que el cliente no esté operando exclusivamente en modo offline por error de configuración.
 * 
 * @async
 * @function testConnection
 */
async function testConnection() {
  try {
    // Attempt to get a dummy doc to verify connection
    await getDocFromServer(doc(db, '_test_', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    } else {
      console.warn("Firebase initialized (Test connection handled):", error);
    }
  }
}

testConnection();
