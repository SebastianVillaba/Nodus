import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material';
import TextField from '../UppercaseTextField';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import SearchProductModal from '../SearchProductModal';
import type { ProductoResultado } from '../SearchProductModal';
import { productoService } from '../../services/producto.service';

interface ProductosReferenciadosTabProps {
  idProductoRef: number;
  idTerminalWeb: number;
  onSaveSuccess?: () => void;
}

export default function ProductosReferenciadosTab({
  idProductoRef,
  idTerminalWeb,
  onSaveSuccess,
}: ProductosReferenciadosTabProps): JSX.Element {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Estados para agregar producto
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductoResultado | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [cantidad, setCantidad] = useState<string>('1');
  // false = combo sin stock propio (al vender descuenta los componentes); true = con stock propio (se arma por adelantado)
  const [controlaStock, setControlaStock] = useState<boolean>(false);

  // Refs para flujo de foco
  const buscadorRef = useRef<HTMLInputElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const agregarBtnRef = useRef<HTMLButtonElement>(null);

  // Obtener ID del usuario logueado
  const getUsuarioId = (): number => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      return user ? user.idUsuario : 1;
    } catch {
      return 1;
    }
  };

  // Cargar detalles desde la base de datos temporal
  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const details = await productoService.obtenerDetallesTmp(idTerminalWeb);
      setItems(details || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al obtener productos referenciados temporales');
    } finally {
      setLoading(false);
    }
  }, [idTerminalWeb]);

  // Al montar, cargamos la composición guardada del combo en la temporal y la mostramos.
  // No se limpia la temporal al desmontar: cada carga ya la reemplaza, y una limpieza asíncrona
  // podía llegar después de la carga siguiente (doble montaje de React) y dejar el combo vacío.
  useEffect(() => {
    let cancelado = false;
    const initializeTempTable = async () => {
      setLoading(true);
      setError('');
      try {
        const config = await productoService.cargarReferenciasTmp(idTerminalWeb, idProductoRef);
        if (cancelado) return;
        setControlaStock(!!config?.controlaStock);
        setItems(config?.detalle || []);
      } catch (err: any) {
        if (cancelado) return;
        console.error(err);
        setError(err.message || 'Error al inicializar la tabla temporal de referencias');
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    if (idProductoRef && idTerminalWeb) {
      initializeTempTable();
    }
    return () => { cancelado = true; };
  }, [idProductoRef, idTerminalWeb]);

  // Seleccionar producto del modal o búsqueda directa
  const handleProductSelect = (product: ProductoResultado) => {
    setSelectedProduct(product);
    setSearchText(`[${product.codigo}] ${product.nombreMercaderia}`);
    setSearchModalOpen(false);
    // Enfocar cantidad
    setTimeout(() => {
      cantidadRef.current?.focus();
    }, 100);
  };

  // Buscar productos directamente en el input al presionar Enter
  const handleSearchKeyPress = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const term = searchText.trim();
      if (!term) {
        setSearchModalOpen(true);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const results = await productoService.consultarPrecioProducto(term, idTerminalWeb);
        if (results.length === 1) {
          handleProductSelect(results[0]);
        } else if (results.length > 1) {
          setSearchModalOpen(true);
        } else {
          setError('No se encontraron productos con ese criterio');
          setTimeout(() => {
            buscadorRef.current?.focus();
          }, 100);
        }
      } catch (err: any) {
        console.error('Error al buscar productos:', err);
        setError(err.message || 'Error al buscar productos');
      } finally {
        setLoading(false);
      }
    }
  };

  // Limpiar el input al recibir foco si ya había un producto seleccionado
  const handleFocusSearch = () => {
    if (selectedProduct) {
      setSelectedProduct(null);
      setSearchText('');
    }
  };

  // Agregar detalle a la temporal
  const handleAgregar = async () => {
    if (!selectedProduct) {
      setError('Debe seleccionar un producto');
      return;
    }
    const cantNum = Number(cantidad.replace(',', '.'));
    if (!Number.isFinite(cantNum) || cantNum <= 0) {
      setError('La cantidad debe ser mayor a 0');
      cantidadRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await productoService.agregarDetalleTmp(idTerminalWeb, selectedProduct.idProducto, cantNum);
      setSelectedProduct(null);
      setSearchText('');
      setCantidad('1');
      await loadDetails();
      // Volver el foco al buscador
      setTimeout(() => {
        buscadorRef.current?.focus();
      }, 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al agregar producto referenciado');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar detalle de la temporal
  const handleEliminarItem = async (nro: number) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await productoService.eliminarDetalleTmp(idTerminalWeb, nro);
      await loadDetails();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al eliminar producto referenciado');
    } finally {
      setLoading(false);
    }
  };

  // Guardar todas las referencias de la temporal a la persistida
  const handleGuardar = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const idUsuario = getUsuarioId();
      await productoService.guardarReferencias(idUsuario, idTerminalWeb, idProductoRef, controlaStock);
      setSuccess('Productos referenciados guardados con éxito');
      await loadDetails();
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al guardar productos referenciados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f9f9f9' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: '500', mb: 2 }}>
          Asociar Nuevo Producto Referenciado
        </Typography>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                label="Producto a Referenciar"
                placeholder="Ingrese nombre, código o barra..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                onFocus={handleFocusSearch}
                inputRef={buscadorRef}
              />
            </Stack>
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Cantidad"
              inputRef={cantidadRef}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarBtnRef.current?.focus();
                }
              }}
              inputProps={{ min: 0, step: 'any' }}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <Button
              ref={agregarBtnRef}
              fullWidth
              variant="contained"
              color="success"
              startIcon={<AddIcon />}
              onClick={handleAgregar}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAgregar();
                }
              }}
              disabled={loading || !selectedProduct}
            >
              Agregar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Tipo de combo</Typography>
        <RadioGroup value={controlaStock ? '1' : '0'} onChange={(e) => setControlaStock(e.target.value === '1')}>
          <FormControlLabel value="0" control={<Radio size="small" />} label={
            <Typography variant="body2"><b>Sin stock propio</b> — al venderlo se descuentan sus componentes (ej: gaseosa + snack). Se puede vender mientras haya componentes.</Typography>
          } />
          <FormControlLabel value="1" control={<Radio size="small" />} label={
            <Typography variant="body2"><b>Con stock propio</b> — se arma por adelantado en Mercadería → Armado de Combos (salen los componentes y entra el combo); al venderlo se descuenta solo el combo (ej: canasta navideña).</Typography>
          } />
        </RadioGroup>
      </Paper>

      <Typography variant="h6" gutterBottom sx={{ fontWeight: '500', mb: 1 }}>
        Listado de Productos Referenciados
      </Typography>

      <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 3 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Nro</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Código</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Producto</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Cantidad</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acción</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No hay productos referenciados asociados a este artículo.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow 
                  key={item.nro}
                  sx={{ '&:hover': { backgroundColor: '#f5f5f5', transition: 'background-color 0.2s' } }}
                >
                  <TableCell>{item.nro}</TableCell>
                  <TableCell>{item.codigo}</TableCell>
                  <TableCell>{item.nombreMercaderia}</TableCell>
                  <TableCell align="right">{item.cantidad}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleEliminarItem(item.nro)}
                      disabled={loading}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="success"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleGuardar}
          disabled={loading}
          sx={{ minWidth: 150 }}
        >
          {loading ? 'Guardando...' : 'Guardar Referencias'}
        </Button>
      </Box>

      {/* Modal de Búsqueda de Productos */}
      <SearchProductModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        idTerminalWeb={idTerminalWeb}
        onSelectProduct={handleProductSelect}
        busqueda={searchText}
      />
    </Box>
  );
}
