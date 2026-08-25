// Admin media library + uploads (validated images).
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { storeImage, deleteStored } from '../../lib/storage';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';
import { config } from '../../config';

export const mediaRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadMaxMb * 1024 * 1024, files: 10 },
});

mediaRouter.get('/', requirePermission('media.manage'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30));
  const q = String(req.query.q || '');
  const kind = String(req.query.kind || 'image');
  const where = {
    ...(q ? { OR: [{ filename: { contains: q, mode: 'insensitive' as const } }, { alt: { contains: q, mode: 'insensitive' as const } }] } : {}),
    ...(kind !== 'all' ? { kind } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  res.json({ success: true, data: { items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

mediaRouter.post('/upload', requirePermission('media.manage'), upload.array('files', 10), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) throw AppError.badRequest('No files uploaded');
  const results = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      const stored = await storeImage(
        { buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype, size: f.size },
        'media',
        { kind: 'image' }
      );
      const asset = await prisma.mediaAsset.create({
        data: {
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          size: stored.size,
          kind: 'image',
          createdBy: res.locals.admin.id,
          width: null,
          height: null,
        },
      });
      results.push(asset);
    } catch (err) {
      errors.push(`${f.originalname}: ${(err as Error).message}`);
    }
  }
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'MEDIA_UPLOADED', entityType: 'MediaAsset', details: { count: results.length, errors }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: { items: results, errors } });
});

mediaRouter.patch('/:id', requirePermission('media.manage'), async (req, res) => {
  const { alt } = req.body || {};
  const asset = await prisma.mediaAsset.update({
    where: { id: Number(req.params.id) },
    data: { ...(typeof alt === 'string' ? { alt } : {}) },
  });
  res.json({ success: true, data: asset });
});

mediaRouter.delete('/:id', requirePermission('media.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) throw AppError.notFound('Asset not found');
  await deleteStored(asset.url);
  await prisma.mediaAsset.delete({ where: { id } });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'MEDIA_DELETED', entityType: 'MediaAsset', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Asset deleted' } });
});
