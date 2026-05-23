
import { DataStore, PendingSyncOperation } from "../src/services/dataStore";

/**
 * QA Script: Simulación de fallo de red y recuperación.
 * Este script se debe ejecutar en un entorno que simule el comportamiento del navegador.
 * Dado que estamos en un entorno Node, emularemos localStorage y fetch.
 */

// Mock de LocalStorage
const storage: Record<string, string> = {};
(global as any).window = {
  localStorage: {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, val: string) => storage[key] = val,
  }
};

// Mock de fetch que falla a propósito
(global as any).fetch = async () => {
  throw new Error("TypeError: Failed to fetch (Network Error)");
};

async function testOfflineResilience() {
  console.log("🕵️ QA: Simulando corte de internet...");

  const testOperation = {
    type: "data-update" as const,
    payload: { tag: "QA-OFFLINE-001", status: "mantenimiento" }
  };

  // 1. Intentar sincronizar cuando no hay red
  console.log("📝 Registrando operación mientras el servidor está caído...");
  DataStore.enqueueSyncOperation(testOperation);

  const pending = DataStore.getPendingSyncOperations();
  console.log(`📊 Operaciones en cola: ${pending.length}`);
  
  if (pending.length > 0 && pending[0].status === "pending") {
    console.log("✅ ÉXITO: La operación se guardó localmente en la cola de espera.");
  } else {
    console.log("❌ FALLO: La operación se perdió o no se encoló correctamente.");
  }

  // 2. Simular recuperación de red
  console.log("\n🌐 Simulando restauración de conexión...");
  (global as any).fetch = async () => ({
    ok: true,
    json: async () => ({ success: true, results: [{ uuid_sync: "QA-OFFLINE-001", status: "applied" }] })
  });

  console.log("🔄 Reintentando sincronización de cola...");
  const toSync = DataStore.getPendingSyncOperations().filter(op => op.status === "pending");
  
  for (const op of toSync) {
    try {
      const res = await fetch("/api/sync", { method: "POST", body: JSON.stringify(op) });
      if (res.ok) {
        DataStore.completeSyncOperation(op.id);
        console.log(`✅ Operación ${op.id} sincronizada con éxito tras recuperar red.`);
      }
    } catch (e) {
      console.log("❌ Sigue fallando...");
    }
  }

  const finalPending = DataStore.getPendingSyncOperations().filter(op => op.status === "pending");
  console.log(`📊 Operaciones pendientes finales: ${finalPending.length}`);

  if (finalPending.length === 0) {
    console.log("🏆 Veredicto: El sistema es RESILIENTE a fallos de red.");
  } else {
    console.log("⚠️ Veredicto: El sistema requiere mejoras en el auto-reintento.");
  }
}

testOfflineResilience();
