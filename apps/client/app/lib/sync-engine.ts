import { remoteApi } from "./api";
import { localApi, isDesktop } from "./local-first";

interface SyncOperation {
  id: string;
  type: "CREATE_PAGE" | "UPDATE_PAGE" | "UPLOAD_FILE";
  payload: any;
  timestamp: string;
}

// O SyncEngine roda em background no Desktop para sincronizar dados com o Servidor (Elysia)
export class SyncEngine {
  private static getQueue(): SyncOperation[] {
    const q = localStorage.getItem("orbe_sync_queue");
    return q ? JSON.parse(q) : [];
  }

  private static saveQueue(q: SyncOperation[]) {
    localStorage.setItem("orbe_sync_queue", JSON.stringify(q));
  }

  // 1. Enfileirar operação para ser enviada depois
  static enqueue(type: SyncOperation["type"], payload: any) {
    if (!isDesktop()) return; // Apenas desktop enfileira sincronização
    
    const q = this.getQueue();
    q.push({
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: new Date().toISOString()
    });
    this.saveQueue(q);
    this.startSync(); // Tenta sincronizar imediatamente
  }

  // 2. Processar a fila enviando para a Nuvem (Remote API)
  static async startSync() {
    if (!isDesktop() || !navigator.onLine) return;

    let q = this.getQueue();
    if (q.length === 0) return;

    console.log(`Iniciando sincronização de ${q.length} operações locais para a nuvem...`);

    const failed = [];
    for (const op of q) {
      try {
        if (op.type === "CREATE_PAGE") {
          await remoteApi.createPage(op.payload);
        } else if (op.type === "UPDATE_PAGE") {
          await remoteApi.updatePage(op.payload.id, op.payload.data);
        }
        // Marcar como sucesso (não coloca no failed)
      } catch (e) {
        console.error("Erro ao sincronizar operação:", op, e);
        failed.push(op); // Deixa para a próxima tentativa
      }
    }

    this.saveQueue(failed);
  }

  // 3. Puxar alterações da Nuvem (Remote) para a Máquina Local
  static async pullFromCloud() {
    if (!isDesktop() || !navigator.onLine) return;

    try {
      console.log("Baixando modificações mais recentes da nuvem para o disco local...");
      const remotePages = await remoteApi.pages();
      const localPages = await localApi.pages();

      for (const remotePage of remotePages) {
        const localMatch = localPages.find(p => p.id === remotePage.id);
        
        if (!localMatch) {
          // A página existe na nuvem mas não no local: Baixar e salvar
          await localApi.createPage({ ...remotePage });
        } else if (new Date(remotePage.updatedAt) > new Date(localMatch.updatedAt)) {
          // A página na nuvem é mais recente que a local
          await localApi.updatePage(remotePage.id, {
            title: remotePage.title,
            content: remotePage.content,
            isFavorite: remotePage.isFavorite
          });
        }
      }
    } catch (e) {
      console.error("Falha ao puxar da nuvem", e);
    }
  }
}

// Inicia o Pull automático a cada 5 minutos e quando fica online
if (typeof window !== 'undefined' && isDesktop()) {
  window.addEventListener('online', () => {
    SyncEngine.startSync();
    SyncEngine.pullFromCloud();
  });
  
  setInterval(() => {
    SyncEngine.startSync();
    SyncEngine.pullFromCloud();
  }, 5 * 60 * 1000);
}
