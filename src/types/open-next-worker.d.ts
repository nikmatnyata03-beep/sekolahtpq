// Deklarasi tipe untuk hasil build OpenNext (di-gitignore, dibuat saat build).
declare module '*/.open-next/worker.js' {
  const worker: {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>
  }
  export default worker
}
