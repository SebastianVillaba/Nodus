import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const deliveryService = {
    getDeliveryActivo: async (idTerminalWeb: number) => {
        const response = await axios.get(`${API_URL}/delivery/activo`, { params: { idTerminalWeb } });
        return response.data;
    },
};
