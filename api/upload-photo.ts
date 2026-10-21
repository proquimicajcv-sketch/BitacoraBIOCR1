import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export default function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, filename, prefix } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No se envió imagen' });
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const ext = base64Data.startsWith('data:image/png')
      ? 'png'
      : base64Data.startsWith('data:image/webp')
      ? 'webp'
      : 'jpg';
    const cleanPrefix = (prefix || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseName = filename ? filename.replace(/[^a-zA-Z0-9_.-]/g, '_') : `foto.${ext}`;
    const safeName = `${cleanPrefix}_${Date.now()}_${baseName}`;

    // Try saving to /tmp or public/uploads
    const UPLOADS_DIR = path.resolve('public', 'uploads');
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);
      return res.json({
        success: true,
        url: `/uploads/${safeName}`,
        filename: safeName,
        size: buffer.length,
      });
    } catch {
      // If filesystem is read-only in serverless, return compressed data URL directly
      return res.json({
        success: true,
        url: base64Data,
        filename: safeName,
        size: buffer.length,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
