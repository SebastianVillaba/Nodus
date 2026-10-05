import axios from 'axios';
import type { Usuario, UsuarioSearchResult } from '../types/usuario.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const usuarioService = {
    buscarUsuarios: async (busqueda: string): Promise<UsuarioSearchResult[]> => {
        const response = await axios.get(`${API_BASE_URL}/usuario/buscar`, {
            params: { busqueda }
        });
        return response.data;
    },

    obtenerUsuario: async (idUsuario: number): Promise<Usuario> => {
        const response = await axios.get(`${API_BASE_URL}/usuario/${idUsuario}`);
        return response.data;
    },

    crearUsuario: async (usuario: Usuario): Promise<{ success: boolean; message: string }> => {
        const response = await axios.post(`${API_BASE_URL}/usuario`, usuario);
        return response.data;
    },

    modificarUsuario: async (usuario: Usuario): Promise<{ success: boolean; message: string }> => {
        const response = await axios.put(`${API_BASE_URL}/usuario`, usuario);
        return response.data;
    },

    buscarPersonaParaUsuario: async (busqueda: string): Promise<any[]> => {
        const response = await axios.get(`${API_BASE_URL}/usuario/buscar-persona`, {
            params: { busqueda }
        });
        return response.data;
    },
    obtenerPersonalesSinUsuario: async (): Promise<any[]> => {
        const response = await axios.get(`${API_BASE_URL}/usuario/personales-sin-usuario`);
        return response.data;
    },
    validarVendedor: async (username: string, password: string): Promise<{ success: boolean; result?: { idVendedor: number; nombre: string }; message?: string }> => {
        const response = await axios.post(`${API_BASE_URL}/usuario/validar-vendedor`, { username, password });
        return response.data;
    }
};
