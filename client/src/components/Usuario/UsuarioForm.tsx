import {
    TextField as MuiTextField, // Alias for password field
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Typography,
    Box,
    Stack,
    Checkbox,
    FormControlLabel,
    Button,
    InputAdornment,
    IconButton,
    Grid
} from '@mui/material';
import TextField from '../UppercaseTextField'; // Custom Uppercase TextField
import { useState, useEffect } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import type { Usuario } from '../../types/usuario.types';
import { rolService, type Rol } from '../../services/rol.service';
import SearchPersonaModal from '../SearchPersonaModal';

interface UsuarioFormProps {
    formData: Usuario;
    setFormData: React.Dispatch<React.SetStateAction<Usuario>>;
    isNewMode: boolean;
}

export default function UsuarioForm({ formData, setFormData, isNewMode }: UsuarioFormProps): JSX.Element {
    const [roles, setRoles] = useState<Rol[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [openPersonaModal, setOpenPersonaModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const fetchRoles = async () => {
            setLoading(true);
            try {
                const data = await rolService.obtenerRoles();
                setRoles(data);
            } catch (error) {
                console.error('Error al cargar roles:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRoles();
    }, []);

    const handleChange = (field: keyof Usuario) => (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
    ) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handlePersonaSelected = (persona: any) => {
        setFormData((prev) => ({
            ...prev,
            idPersona: persona.idPersona,
            nombrePersona: persona.nombre.trim(),
            ruc: persona.ruc || persona.documento
        }));
    };

    const handleClickShowPassword = () => setShowPassword((show) => !show);

    return (
        <Box>
            <Typography variant="caption" color="error" sx={{ my: 2, display: 'block' }}>
                * Datos Obligatorios
            </Typography>
            <Stack spacing={2.5}>

                {/* Persona Selection */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                        fullWidth
                        label="Persona"
                        value={formData.nombrePersona || ''}
                        disabled
                        size="small"
                        helperText={!formData.idPersona ? 'Debe seleccionar una persona' : ''}
                        error={!formData.idPersona}
                    />
                    <Button
                        variant="contained"
                        onClick={() => setOpenPersonaModal(true)}
                        sx={{ minWidth: 'auto', p: 1 }}
                        disabled={!isNewMode} // Only allow changing person in new mode? Or maybe allow changing but careful with ID
                    >
                        <SearchIcon />
                    </Button>
                </Box>

                {/* Username */}
                <TextField
                    fullWidth
                    label="Nombre de Usuario"
                    value={formData.username}
                    onChange={handleChange('username')}
                    required
                    size="small"
                    error={!formData.username}
                    helperText={!formData.username ? 'Campo obligatorio' : ''}
                />

                {/* Password */}
                <MuiTextField
                    fullWidth
                    label={isNewMode ? "Contraseña" : "Nueva Contraseña (dejar en blanco para mantener)"}
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password || ''}
                    onChange={handleChange('password')}
                    required={isNewMode}
                    size="small"
                    error={isNewMode && !formData.password}
                    helperText={isNewMode && !formData.password ? 'Campo obligatorio' : ''}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle password visibility"
                                    onClick={handleClickShowPassword}
                                    edge="end"
                                >
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />

                {/* Rol */}
                <FormControl fullWidth size="small" error={!formData.idRol}>
                    <InputLabel>Rol</InputLabel>
                    <Select
                        value={formData.idRol || ''}
                        onChange={handleChange('idRol')}
                        label="Rol"
                        disabled={loading}
                    >
                        {roles.map((rol) => (
                            <MenuItem key={rol.idRol} value={rol.idRol}>
                                {rol.nombreRol}
                            </MenuItem>
                        ))}
                    </Select>
                    {!formData.idRol && <Typography variant="caption" color="error" sx={{ ml: 2 }}>Campo obligatorio</Typography>}
                </FormControl>

                {/* Activo (Only if editing) */}
                {!isNewMode && (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={formData.activo === true || formData.activo === undefined} 
                                onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                                name="activo"
                            />
                        }
                        label="Activo"
                    />
                )}

                {/* Permisos Especiales */}
                <Box sx={{ mt: 1, p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#1e293b' }}>
                        Permisos Especiales de Anulación
                    </Typography>
                    <Grid container spacing={1}>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularCompra}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularCompra: e.target.checked }))}
                                    />
                                }
                                label="Anular Compra"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularVenta}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularVenta: e.target.checked }))}
                                    />
                                }
                                label="Anular Venta"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularRemision}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularRemision: e.target.checked }))}
                                    />
                                }
                                label="Anular Remisión"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularRecepcion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularRecepcion: e.target.checked }))}
                                    />
                                }
                                label="Anular Recepción"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularAjuste}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularAjuste: e.target.checked }))}
                                    />
                                }
                                label="Anular Ajuste"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularCargaProducto}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularCargaProducto: e.target.checked }))}
                                    />
                                }
                                label="Anular Carga de Producto"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularCobro}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularCobro: e.target.checked }))}
                                    />
                                }
                                label="Anular Cobro de Créditos"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularNotaCredito}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularNotaCredito: e.target.checked }))}
                                    />
                                }
                                label="Anular Notas de Crédito"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={!!formData.anularNotaCreditoProveedor}
                                        onChange={(e) => setFormData(prev => ({ ...prev, anularNotaCreditoProveedor: e.target.checked }))}
                                    />
                                }
                                label="Anular Notas de Crédito de Proveedor"
                            />
                        </Grid>
                    </Grid>
                </Box>
            </Stack>

            <SearchPersonaModal
                open={openPersonaModal}
                onClose={() => setOpenPersonaModal(false)}
                onPersonaSelected={handlePersonaSelected}
            />
        </Box>
    );
}
