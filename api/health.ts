/**
 * G2A Growth Engine – Vercel health check endpoint
 *
 * Minimális teszt endpoint, ami zero dependency-vel működik.
 * Cél: megerősíteni, hogy a Vercel api/ folder discovery + serverless
 * function deploy egyáltalán működik. Ha ez 200-at ad vissza, akkor
 * a függvény-deploy infra OK, és a probléma máshol van. Ha ez is 404,
 * akkor a Vercel project beállítások (Root Directory, Framework Preset)
 * a hibásak.
 */
export default function handler(_req: any, res: any): void {
  res.status(200).json({
    ok: true,
    service: "g2a-growth-engine",
    message: "Vercel serverless function deploy works",
  });
}
