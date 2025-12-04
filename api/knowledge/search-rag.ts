import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applySecurityHeaders } from '../lib/security.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';
import { searchRagDirect, type PillarCategory, type KnowledgeChunk } from '../lib/ragUtils.js';

type SearchRagRequest = {
  query?: string;
  filters?: {
    pillar_category?: PillarCategory;
    doc_type?: string;
    document_id?: string;
  };
  limit?: number;
};

type SearchRagResponse = {
  chunks: KnowledgeChunk[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applySecurityHeaders(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, filters, limit }: SearchRagRequest = req.body || {};

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw createError('Falta la query de búsqueda', 400, 'BAD_REQUEST');
    }

    // Usar la función directa para evitar problemas de autenticación
    const chunks = await searchRagDirect(query, filters, limit ?? 5);

    const response: SearchRagResponse = {
      chunks,
    };

    return res.status(200).json(response);
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}


