import express from 'express';
import multer from 'multer'

import { insertarProducto, buscarProductos, obtenerInfoProducto, obtenerTiposProducto, consultarPrecioProducto, modificarProducto, obtenerPrecioDescuento, insertarTipoProducto, consultarStockProducto } from '../controllers/producto.controller';
import { cargarReferenciasTmp, obtenerDetallesTmp, agregarDetalleTmp, eliminarDetalleTmp, guardarReferencias, limpiarTemporal, obtenerSugeridosProductoRef } from '../controllers/productoRef.controller';

const router = express.Router();

// Configuración de almacenamiento local para Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Renombrar archivo para evitar duplicados: ej. 1718293821-producto.jpg
    // La extensión sale del tipo validado, no del nombre que manda el cliente
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + EXTENSIONES_IMAGEN[file.mimetype]);
  }
});

const EXTENSIONES_IMAGEN: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype in EXTENSIONES_IMAGEN) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
  },
});

// Endpoint separado para la carga exclusiva de la imagen física
router.post('/upload-image', (req, res, next) => {
  upload.single('imagen')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen no puede superar los 5 MB'
        : 'Solo se permiten imágenes JPG, PNG, WEBP o GIF';
      return res.status(400).json({ success: false, message });
    }
    if (err) return next(err);
    next();
  });
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
  }
  // Retornamos la ruta relativa para guardarla luego en el formulario del producto
  const imagenUrl = `/uploads/${req.file.filename}`;
  res.status(200).json({ success: true, imagenUrl });
});

router.post('/', insertarProducto);
router.put('/', modificarProducto);
router.get('/consulta', buscarProductos);
router.get('/info', obtenerInfoProducto);
router.get('/tipoProducto', obtenerTiposProducto);
router.post('/tipoProducto', insertarTipoProducto);
router.get('/precio', consultarPrecioProducto);
router.get('/precioDescuento', obtenerPrecioDescuento);
router.get('/stock', consultarStockProducto);

// Rutas para Productos Referenciados
router.post('/ref/cargar', cargarReferenciasTmp);
router.get('/ref/detalle', obtenerDetallesTmp);
router.post('/ref/detalle', agregarDetalleTmp);
router.delete('/ref/detalle/:nro', eliminarDetalleTmp);
router.post('/ref/guardar', guardarReferencias);
router.post('/ref/limpiar', limpiarTemporal);
router.get('/ref/sugeridos/:idProductoRef', obtenerSugeridosProductoRef);

export default router;
