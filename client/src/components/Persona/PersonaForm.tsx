import { useState, useEffect } from 'react';
import {
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Box,
  Stack,
  Paper,
  Autocomplete,
} from '@mui/material';
import TextField from '../UppercaseTextField';
import type { Persona } from '../../types/persona.types';
import type { Departamento, Distrito, Ciudad } from '../../types/ubicacion.types';
import { TipoPersonaForm } from './TipoPersonaForm';
import { ubicacionService } from '../../services/ubicacion.service';
import { esDepartamentoPorDefecto, esDistritoPorDefecto, esCiudadPorDefecto } from '../../config/ubicacionDefecto';

interface PersonaFormProps {
  formData: Persona;
  setFormData: React.Dispatch<React.SetStateAction<Persona>>;
}


const paises = [
  "PARAGUAY",
  "ARGENTINA",
  "BRASIL",
  "CHILE",
  "URUGUAY",
  "BOLIVIA"
];

const tiposDocumento = [
  { id: 1, nombre: 'Cédula paraguaya' },
  { id: 2, nombre: 'RUC' },
  { id: 3, nombre: 'Pasaporte' },
  { id: 4, nombre: 'Otro' },
];

export default function PersonaForm({ formData, setFormData }: PersonaFormProps): JSX.Element {
  // Estados para los datos de ubicación
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [loading, setLoading] = useState(false);
  const [valoresPorDefectoCargados, setValoresPorDefectoCargados] = useState(false);

  // Cargar departamentos al montar el componente
  useEffect(() => {
    const cargarDepartamentos = async () => {
      try {
        setLoading(true);
        const data = await ubicacionService.obtenerDepartamentos();
        setDepartamentos(data);

        // Establecer valores por defecto solo si es un nuevo registro
        if (!formData.idPersona && !valoresPorDefectoCargados) {
          // Buscar el departamento configurado por defecto
          const depDefecto = data.find(d => esDepartamentoPorDefecto(d.nombre));
          if (depDefecto) {
            setFormData(prev => ({
              ...prev,
              pais: 'PARAGUAY',
              idDepartamento: depDefecto.idDepartamento
            }));
          }
          setValoresPorDefectoCargados(true);
        }
      } catch (error) {
        console.error('Error al cargar departamentos:', error);
      } finally {
        setLoading(false);
      }
    };
    cargarDepartamentos();
  }, []);

  // Cargar distritos cuando cambia el departamento
  useEffect(() => {
    const cargarDistritos = async () => {
      if (formData.idDepartamento) {
        try {
          setLoading(true);
          const data = await ubicacionService.obtenerDistritosPorDepartamento(formData.idDepartamento);
          setDistritos(data);

          // Preseleccionar la ubicación configurada por defecto solo si es un nuevo registro y no tiene distrito
          if (!formData.idPersona && !formData.idDistrito && valoresPorDefectoCargados) {
            const ubicDefecto = data.find(d => esDistritoPorDefecto(d.nombre));
            if (ubicDefecto) {
              setFormData(prev => ({
                ...prev,
                idDistrito: ubicDefecto.idDistrito
              }));
            }
          }
        } catch (error) {
          console.error('Error al cargar distritos:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setDistritos([]);
        setCiudades([]);
      }
    };
    cargarDistritos();
  }, [formData.idDepartamento]);

  // Cargar ciudades cuando cambia el distrito
  useEffect(() => {
    const cargarCiudades = async () => {
      if (formData.idDistrito) {
        try {
          setLoading(true);
          const data = await ubicacionService.obtenerCiudadesPorDistrito(formData.idDistrito);
          setCiudades(data);

          // Preseleccionar la ubicación configurada por defecto solo si es un nuevo registro y no tiene ciudad
          if (!formData.idPersona && !formData.idCiudad && valoresPorDefectoCargados) {
            const ubicDefecto = data.find(c => esCiudadPorDefecto(c.nombreCiudad));
            if (ubicDefecto) {
              setFormData(prev => ({
                ...prev,
                idCiudad: ubicDefecto.idCiudad.toString()
              }));
            }
          }
        } catch (error) {
          console.error('Error al cargar ciudades:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setCiudades([]);
      }
    };
    cargarCiudades();
  }, [formData.idDistrito]);
  
  const handleChange = (field: keyof Persona) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  return (
    <Box>
      <Typography variant="caption" color="error" sx={{ my: 2, display: 'block' }}>
        * Datos Obligatorios
      </Typography>
      <Stack spacing={2.5}>
        {/* Fila 1: ID y Nombre */}
        <Stack direction="column" spacing={2}>
          <TextField
            label="ID"
            value={formData.idPersona || ''}
            disabled
            size="small"
            sx={{ width: '75px' }}
          />
          <TextField
            fullWidth
            label="Nombre y Apellido / Razón Social"
            value={formData.nombre}
            onChange={handleChange('nombre')}
            required
            size="small"
            error={!formData.nombre}
            helperText={!formData.nombre ? 'Campo obligatorio' : ''}
          />
        </Stack>

        {/* Fila 2: RUC, DV, Dirección */}
        <Stack direction="row" spacing={2}>
          <TextField
            label="RUC"
            value={formData.ruc || ''}
            onChange={handleChange('ruc')}
            size="small"
            sx={{ width: '200px' }}
          />
          <TextField
            label="DV"
            value={formData.dv || ''}
            onChange={handleChange('dv')}
            size="small"
            sx={{ width: '100px' }}
          />
          <TextField
            fullWidth
            label="Dirección"
            value={formData.direccion || ''}
            onChange={handleChange('direccion')}
            size="small"
          />
        </Stack>

        {/* Fila 3: País, Tipo de documento */}
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel>País</InputLabel>
            <Select
              value={formData.pais || ''}
              onChange={handleChange('pais')}
              label="País"
            >
              {paises.map((pais) => (
                <MenuItem key={pais} value={pais}>
                  {pais}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" required>
            <InputLabel>Tipo de documento</InputLabel>
            <Select
              value={formData.idTipoDocumento || ''}
              onChange={handleChange('idTipoDocumento')}
              label="Tipo de documento"
              required
            >
              {tiposDocumento.map((tipo) => (
                <MenuItem key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Fila 4: Departamento */}
        <Stack direction="row" spacing={2}>
          <Autocomplete
            fullWidth
            size="small"
            options={departamentos}
            getOptionLabel={(option) => option.nombre}
            value={departamentos.find(d => d.idDepartamento === formData.idDepartamento) || null}
            onChange={(_event, newValue) => {
              setFormData(prev => ({
                ...prev,
                idDepartamento: newValue?.idDepartamento,
                idDistrito: undefined,
                idCiudad: undefined
              }));
            }}
            disabled={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Departamento"
                placeholder="Buscar departamento..."
              />
            )}
            noOptionsText="No hay departamentos disponibles"
          />
        </Stack>

        {/* Fila 5: Distrito, Ciudad */}
        <Stack direction="row" spacing={2}>
          <Autocomplete
            fullWidth
            size="small"
            options={distritos}
            getOptionLabel={(option) => option.nombre}
            value={distritos.find(d => d.idDistrito === formData.idDistrito) || null}
            onChange={(_event, newValue) => {
              setFormData(prev => ({
                ...prev,
                idDistrito: newValue?.idDistrito,
                idCiudad: undefined
              }));
            }}
            disabled={!formData.idDepartamento || loading || distritos.length === 0}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Distrito"
                placeholder="Buscar distrito..."
              />
            )}
            noOptionsText={!formData.idDepartamento ? "Primero seleccione un departamento" : "No hay distritos disponibles"}
          />
          <Autocomplete
            fullWidth
            size="small"
            options={ciudades}
            getOptionLabel={(option) => option.nombreCiudad}
            value={ciudades.find(c => c.idCiudad.toString() === formData.idCiudad) || null}
            onChange={(_event, newValue) => {
              setFormData(prev => ({
                ...prev,
                idCiudad: newValue?.idCiudad?.toString()
              }));
            }}
            disabled={!formData.idDistrito || loading || ciudades.length === 0}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Ciudad"
                placeholder="Buscar ciudad..."
              />
            )}
            noOptionsText={!formData.idDistrito ? "Primero seleccione un distrito" : "No hay ciudades disponibles"}
          />
        </Stack>

        {/* Fila 6: Fecha Aniversario, Teléfonos */}
        <Stack direction="row" spacing={2}>
          <TextField
            label="Fecha Aniversario"
            type="date"
            value={formData.fechaNacimiento || ''}
            onChange={handleChange('fechaNacimiento')}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: '200px' }}
          />
          <TextField
            label="Teléfono"
            value={formData.telefono || ''}
            onChange={handleChange('telefono')}
            size="small"
            fullWidth
          />
        </Stack>

        {/* Fila 7: Celulares, Email */}
        <Stack direction="row" spacing={2}>
          <TextField
            label="Celular"
            value={formData.celular || ''}
            onChange={handleChange('celular')}
            size="small"
            fullWidth
          />
          <TextField
            fullWidth
            label="E-mail"
            type="email"
            value={formData.email || ''}
            onChange={handleChange('email')}
            size="small"
          />
        </Stack>
      </Stack>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, mt: 3 }}>
        <TipoPersonaForm formData={formData} setFormData={setFormData} />
      </Paper>
    </Box>
  );
}
