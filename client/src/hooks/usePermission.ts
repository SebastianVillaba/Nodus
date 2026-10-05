import { useState, useEffect } from 'react';
import { obtenerMisPermisos } from '../services/auth';

/** Permisos del usuario logueado; null mientras cargan. */
export const usePermisos = () => {
    const [permisos, setPermisos] = useState<Set<string> | null>(null);

    useEffect(() => {
        let activo = true;
        obtenerMisPermisos()
            .then((p) => { if (activo) setPermisos(p); })
            .catch((error) => {
                console.error('Error al obtener permisos:', error);
                if (activo) setPermisos(new Set());
            });
        return () => { activo = false; };
    }, []);

    return permisos;
};

export const usePermission = (nombreSistema: string) => {
    const permisos = usePermisos();
    return {
        hasPermission: permisos ? permisos.has(nombreSistema) : null,
        loading: permisos === null,
    };
};
