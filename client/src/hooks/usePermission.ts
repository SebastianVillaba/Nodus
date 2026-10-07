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

/** nombreSistema admite alternativas separadas por '|': 'ACCESO_NC_DEVOLUCION|ACCESO_NC_MONTO' */
export const tienePermiso = (permisos: Set<string>, nombreSistema: string) =>
    nombreSistema.split('|').some((p) => permisos.has(p));

export const usePermission = (nombreSistema: string) => {
    const permisos = usePermisos();
    return {
        hasPermission: permisos ? tienePermiso(permisos, nombreSistema) : null,
        loading: permisos === null,
    };
};
