import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/libro-iva`;

export type Libro = 'ventas' | 'compras';

/** Un comprobante del libro, con los campos de la RG 90/2021 (montos IVA incluido, enteros) */
export interface ComprobanteLibro {
  /** FACTURA | NC DEVOLUCION | NC MONTO */
  origen: string;
  idDocumento: number;
  fecha: string;
  /** 109 factura, 110 nota de crédito (Tabla 4) */
  tipoComprobante: number;
  timbrado: string | null;
  numero: string;
  /** 1 contado, 2 crédito (solo facturas) */
  condicion: number | null;
  /** Tabla 3: 11 RUC, 12 cédula, 13 pasaporte, 14 cédula extranjero, 15 sin nombre */
  tipoIdentificacion: number;
  numeroIdentificacion: string;
  nombre: string;
  gravado10: number;
  gravado5: number;
  exento: number;
  total: number;
  iva10: number;
  iva5: number;
  numeroAsociado: string | null;
  timbradoAsociado: string | null;
}

/** Comprobante con el libro al que pertenece (ventas = registro 1, compras = registro 2) */
export type FilaLibro = ComprobanteLibro & { libro: Libro };

export const esNotaCredito = (c: ComprobanteLibro) => c.tipoComprobante === 110;

export interface EmpresaInformante {
  nombre: string;
  ruc: string;
  dv: string | null;
}

export interface Imputacion {
  iva: boolean;
  ire: boolean;
  irp: boolean;
}

export const libroIvaService = {
  obtener: async (libro: Libro, desde: string, hasta: string): Promise<{ comprobantes: FilaLibro[]; empresa: EmpresaInformante | null }> => {
    const response = await axios.get(`${API_URL}/${libro}`, { params: { desde, hasta } });
    // Los montos decimales pueden llegar como texto: se pasan a número para que las sumas no concatenen
    const comprobantes = (response.data.comprobantes as ComprobanteLibro[]).map((c) => ({
      ...c,
      gravado10: Number(c.gravado10) || 0,
      gravado5: Number(c.gravado5) || 0,
      exento: Number(c.exento) || 0,
      total: Number(c.total) || 0,
      iva10: Number(c.iva10) || 0,
      iva5: Number(c.iva5) || 0,
      tipoComprobante: Number(c.tipoComprobante),
      tipoIdentificacion: Number(c.tipoIdentificacion),
      libro,
    }));
    return { comprobantes, empresa: response.data.empresa };
  },
};

// ─────────────────────────────── RG 90 ───────────────────────────────

const NUMERO_COMPROBANTE = /^\d{3}-\d{3}-\d{7}$/;

/** La fecha llega como 'AAAA-MM-DDTHH:mm...' con la hora local del servidor: se toma tal cual */
export const fechaDDMMAAAA = (fecha: string) => {
  const [a, m, d] = fecha.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** Período fiscal MMAAAA del comprobante (para el nombre del archivo) */
const periodoDe = (fecha: string) => `${fecha.slice(5, 7)}${fecha.slice(0, 4)}`;

/** Problemas que harían rechazar la fila en Marangatu */
export const observacionesRG90 = (c: ComprobanteLibro): string[] => {
  const obs: string[] = [];
  if (!/^\d{8}$/.test(c.timbrado ?? '')) obs.push('Timbrado inválido');
  if (!NUMERO_COMPROBANTE.test(c.numero ?? '')) obs.push('Número de comprobante inválido');
  if (!c.numeroIdentificacion) obs.push('Sin número de identificación');
  if (c.tipoIdentificacion === 11 && !/^\d+$/.test(c.numeroIdentificacion)) obs.push('RUC inválido');
  if (c.total <= 0) obs.push('Total en cero');
  if (esNotaCredito(c) && (!c.numeroAsociado || !/^\d{8}$/.test(c.timbradoAsociado ?? ''))) obs.push('Falta el comprobante asociado');
  return obs;
};

/**
 * Texto de un campo del CSV: la especificación no prevé comillas, así que se quitan los separadores
 * (coma, punto y coma), las comillas y los saltos de línea.
 */
const campo = (texto: string | number | null | undefined) =>
  String(texto ?? '').replace(/[,;"\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
const sn = (valor: boolean) => (valor ? 'S' : 'N');

/**
 * Una línea del archivo de importación, con los campos en el orden de la especificación técnica:
 * ventas 19 campos (tipo de registro 1), compras 20 campos (tipo de registro 2, con NO IMPUTA).
 * Montos enteros sin separador de miles.
 */
const lineaRG90 = (c: FilaLibro, imp: Imputacion): string => {
  const nc = esNotaCredito(c);
  // El nombre no se exige para RUC, cédula ni sin nombre (Marangatu lo toma de sus registros)
  const nombre = c.tipoIdentificacion === 15 ? '' : campo(c.nombre).slice(0, 250);
  const comunes = [
    c.libro === 'ventas' ? 1 : 2,
    c.tipoIdentificacion,
    campo(c.numeroIdentificacion),
    nombre,
    c.tipoComprobante,
    fechaDDMMAAAA(c.fecha),
    campo(c.timbrado),
    campo(c.numero),
    c.gravado10,
    c.gravado5,
    c.exento,
    c.gravado10 + c.gravado5 + c.exento,
    nc ? '' : (c.condicion ?? 1),
    'N',
    sn(imp.iva),
    sn(imp.ire),
    sn(imp.irp),
  ];
  const asociado = [nc ? campo(c.numeroAsociado) : '', nc ? campo(c.timbradoAsociado) : ''];
  const campos = c.libro === 'ventas' ? [...comunes, ...asociado] : [...comunes, 'N', ...asociado];
  return campos.join(',');
};

const descargar = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Siguiente identificador: incrementa el número final (V0001 → V0002) */
export const siguienteIdentificador = (id: string) => {
  const m = id.match(/^(.*?)(\d+)$/);
  if (!m) return `${id.slice(0, 4)}2`;
  const n = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  return `${m[1]}${n}`.slice(-5);
};

export const MAX_FILAS_RG90 = 5000;

/** Archivos que se van a generar: uno por período (mes) y por cada 5.000 filas */
export const planificarRG90 = (ruc: string, identificador: string, filas: FilaLibro[]) => {
  const porPeriodo = new Map<string, FilaLibro[]>();
  [...filas]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((f) => {
      const periodo = periodoDe(f.fecha);
      porPeriodo.set(periodo, [...(porPeriodo.get(periodo) ?? []), f]);
    });

  const archivos: { nombre: string; filas: FilaLibro[] }[] = [];
  porPeriodo.forEach((delPeriodo, periodo) => {
    let id = identificador;
    for (let i = 0; i < delPeriodo.length; i += MAX_FILAS_RG90) {
      archivos.push({ nombre: `${ruc}_REG_${periodo}_${id}`, filas: delPeriodo.slice(i, i + MAX_FILAS_RG90) });
      id = siguienteIdentificador(id);
    }
  });
  return archivos;
};

/**
 * Genera el archivo de importación del Registro de Comprobantes de Marangatu: CSV delimitado por comas,
 * UTF-8, sin encabezados. Con zip = true lo comprime en un ZIP con el mismo nombre (lo que se sube a
 * Marangatu); con zip = false descarga el CSV suelto (para el contador). El nombre es
 * <RUC>_REG_MMAAAA_<ID>: si el rango abarca varios meses o más de 5.000 filas se generan varios archivos.
 * Devuelve los nombres de los archivos generados.
 */
export const descargarRG90 = async (params: {
  ruc: string;
  identificador: string;
  filas: FilaLibro[];
  imputacion: Imputacion;
  zip: boolean;
}): Promise<string[]> => {
  const archivos = planificarRG90(params.ruc, params.identificador, params.filas);
  const nombres: string[] = [];
  for (const archivo of archivos) {
    const contenido = archivo.filas.map((f) => lineaRG90(f, params.imputacion)).join('\r\n') + '\r\n';
    if (params.zip) {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      zip.file(`${archivo.nombre}.csv`, contenido);
      descargar(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `${archivo.nombre}.zip`);
      nombres.push(`${archivo.nombre}.zip`);
    } else {
      descargar(new Blob([contenido], { type: 'text/csv;charset=utf-8' }), `${archivo.nombre}.csv`);
      nombres.push(`${archivo.nombre}.csv`);
    }
  }
  return nombres;
};

// ─────────────────────────────── Totales ───────────────────────────────

export interface TotalesLibro {
  gravado10: number;
  iva10: number;
  gravado5: number;
  iva5: number;
  exento: number;
  total: number;
}

/** Suma los comprobantes; con signoNC = -1 las notas de crédito restan */
export const sumar = (filas: ComprobanteLibro[], signoNC = 1): TotalesLibro => filas.reduce((acc, c) => {
  const s = esNotaCredito(c) ? signoNC : 1;
  return {
    gravado10: acc.gravado10 + s * c.gravado10,
    iva10: acc.iva10 + s * c.iva10,
    gravado5: acc.gravado5 + s * c.gravado5,
    iva5: acc.iva5 + s * c.iva5,
    exento: acc.exento + s * c.exento,
    total: acc.total + s * c.total,
  };
}, { gravado10: 0, iva10: 0, gravado5: 0, iva5: 0, exento: 0, total: 0 });

// ─────────────────────────────── Excel ───────────────────────────────

/**
 * Libro IVA en Excel: resumen (IVA débito y crédito netos), facturas de venta, facturas de compra y
 * notas de crédito (emitidas y recibidas).
 */
export const exportarLibroExcel = async (params: {
  empresa: EmpresaInformante | null;
  rango: string;
  ventas: FilaLibro[];
  compras: FilaLibro[];
  notas: FilaLibro[];
}) => {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nodus';
  wb.created = new Date();
  const empresaTxt = `${params.empresa?.nombre ?? ''} RUC ${params.empresa?.ruc ?? ''}${params.empresa?.dv ? `-${params.empresa.dv}` : ''}`;
  const MONEDA = '#,##0;[Red]-#,##0';

  // Resumen
  const ncEmitidas = params.notas.filter((n) => n.libro === 'ventas');
  const ncRecibidas = params.notas.filter((n) => n.libro === 'compras');
  const rs = wb.addWorksheet('Resumen');
  rs.columns = [{ width: 34 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }];
  rs.getCell('A1').value = `LIBRO IVA — ${empresaTxt}`;
  rs.getCell('A1').font = { bold: true, size: 13 };
  rs.getCell('A2').value = `Del ${params.rango}. Montos en guaraníes, IVA incluido.`;
  rs.addRow([]);
  rs.addRow(['Concepto', 'Gravado 10%', 'IVA 10%', 'Gravado 5%', 'IVA 5%', 'Exento', 'Total']).font = { bold: true };
  const filaResumen = (texto: string, t: TotalesLibro, negativo = false, negrita = false) => {
    const s = negativo ? -1 : 1;
    const r = rs.addRow([texto, s * t.gravado10, s * t.iva10, s * t.gravado5, s * t.iva5, s * t.exento, s * t.total]);
    if (negrita) r.font = { bold: true };
  };
  filaResumen('Facturas de venta', sumar(params.ventas));
  filaResumen('(-) Notas de crédito emitidas', sumar(ncEmitidas), true);
  filaResumen('Ventas netas (IVA débito)', sumar([...params.ventas, ...ncEmitidas], -1), false, true);
  rs.addRow([]);
  filaResumen('Facturas de compra', sumar(params.compras));
  filaResumen('(-) Notas de crédito recibidas', sumar(ncRecibidas), true);
  filaResumen('Compras netas (IVA crédito)', sumar([...params.compras, ...ncRecibidas], -1), false, true);
  [2, 3, 4, 5, 6, 7].forEach((i) => { rs.getColumn(i).numFmt = MONEDA; });

  const hoja = (titulo: string, filas: FilaLibro[], esNotas: boolean) => {
    const ws = wb.addWorksheet(titulo, { views: [{ state: 'frozen', ySplit: 4 }] });
    const columnas = [
      ...(esNotas ? [{ header: 'Libro', key: 'libro', width: 18 }] : []),
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Timbrado', key: 'timbrado', width: 11 },
      { header: 'Número', key: 'numero', width: 17 },
      { header: 'RUC / CI', key: 'ident', width: 14 },
      { header: 'Nombre o razón social', key: 'nombre', width: 38 },
      ...(esNotas ? [] : [{ header: 'Condición', key: 'condicion', width: 10 }]),
      { header: 'Gravado 10%', key: 'g10', width: 14 },
      { header: 'IVA 10%', key: 'iva10', width: 12 },
      { header: 'Gravado 5%', key: 'g5', width: 14 },
      { header: 'IVA 5%', key: 'iva5', width: 12 },
      { header: 'Exento', key: 'exento', width: 14 },
      { header: 'Total', key: 'total', width: 15 },
      ...(esNotas ? [{ header: 'Comprobante asociado', key: 'asociado', width: 32 }] : []),
    ];
    ws.columns = columnas.map(({ key, width }) => ({ key, width }));
    const ultimaCol = String.fromCharCode(64 + columnas.length);
    ws.mergeCells(`A1:${ultimaCol}1`);
    ws.getCell('A1').value = `${titulo.toUpperCase()} — ${empresaTxt}`;
    ws.getCell('A1').font = { bold: true, size: 13 };
    ws.mergeCells(`A2:${ultimaCol}2`);
    ws.getCell('A2').value = `Del ${params.rango}. Montos en guaraníes, IVA incluido.`;
    ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF666666' } };

    const encabezado = ws.getRow(4);
    encabezado.values = columnas.map((c) => c.header);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.eachCell((celda) => {
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    filas.forEach((c) => ws.addRow({
      libro: c.libro === 'ventas' ? 'Emitida (ventas)' : 'Recibida (compras)',
      fecha: fechaDDMMAAAA(c.fecha),
      timbrado: c.timbrado,
      numero: c.numero,
      ident: c.tipoIdentificacion === 15 ? 'SIN NOMBRE' : c.numeroIdentificacion,
      nombre: c.nombre,
      condicion: c.condicion === 2 ? 'CRÉDITO' : 'CONTADO',
      g10: c.gravado10,
      iva10: c.iva10,
      g5: c.gravado5,
      iva5: c.iva5,
      exento: c.exento,
      total: c.total,
      asociado: c.numeroAsociado ? `${c.numeroAsociado} (timb. ${c.timbradoAsociado ?? ''})` : '',
    }));

    const primera = 5;
    const ultima = ws.rowCount;
    const fila = ws.addRow({ nombre: 'TOTALES' });
    fila.font = { bold: true };
    ['g10', 'iva10', 'g5', 'iva5', 'exento', 'total'].forEach((key) => {
      const col = ws.getColumn(key);
      col.numFmt = MONEDA;
      ws.getCell(`${col.letter}${fila.number}`).value = ultima >= primera ? { formula: `SUM(${col.letter}${primera}:${col.letter}${ultima})` } : 0;
    });
    fila.eachCell((celda) => { celda.border = { top: { style: 'thin' } }; });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columnas.length } };
  };

  hoja('Ventas', params.ventas, false);
  hoja('Compras', params.compras, false);
  hoja('Notas de crédito', params.notas, true);

  const buffer = await wb.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Libro_IVA_${params.rango.replace(/\//g, '-').replace(' al ', '_al_')}.xlsx`);
};
