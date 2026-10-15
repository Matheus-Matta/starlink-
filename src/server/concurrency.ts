import "server-only";

/**
 * Exclusão mútua para mutações (processo único). Serializa as operações de
 * leitura-modificação-gravação para impedir "lost updates".
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    // Mantém a fila andando mesmo se a tarefa falhar.
    this.tail = result.catch(() => undefined);
    return result;
  }
}
